import { Injectable, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { S3Service } from '../../shared/services/s3.service';
import { FileCategory } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Readable } from 'stream';
import { encode } from 'blurhash';

// Dangerous file extensions that should be blocked
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.php', '.asp', '.aspx', '.jsp',
  '.cgi', '.pl', '.py', '.rb', '.js', '.mjs', '.ts', '.ps1',
  '.vbs', '.wsf', '.hta', '.scr', '.pif', '.com', '.jar', '.war',
];

/**
 * Storage Service
 *
 * Centralized service for managing user file storage:
 * - Upload files to S3 with organized paths
 * - Track file usage in database
 * - Enforce storage limits
 * - Handle file deletion and cleanup
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';

  // Storage limits (in bytes)
  private readonly DEFAULT_STORAGE_LIMIT = 5 * 1024 * 1024 * 1024; // 5GB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
  private readonly MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB for avatars

  // Image processing settings
  private readonly AVATAR_SIZE = 400;
  private readonly COVER_WIDTH = 1400;
  private readonly COVER_HEIGHT = 400;

  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  // ==================== Entity Ownership Validation ====================

  /**
   * Validate that a form belongs to the user
   */
  private async validateFormOwnership(userId: string, formId: string): Promise<void> {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId },
      select: { id: true },
    });
    if (!form) {
      throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا النموذج');
    }
  }

  /**
   * Validate that an event belongs to the user
   */
  private async validateEventOwnership(userId: string, eventId: string): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      select: { id: true },
    });
    if (!event) {
      throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا الحدث');
    }
  }

  /**
   * Validate that a product belongs to the user (via store)
   */
  private async validateProductOwnership(userId: string, productId: string): Promise<void> {
    const product = await this.prisma.products.findFirst({
      where: { 
        id: productId,
        stores: { userId },
      },
      select: { id: true },
    });
    if (!product) {
      throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المنتج');
    }
  }

  /**
   * Validate file extension is not dangerous
   */
  private validateFileExtension(filename: string): void {
    if (!filename) return;
    const lowerName = filename.toLowerCase();
    for (const ext of BLOCKED_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        throw new BadRequestException(`امتداد الملف ${ext} غير مسموح به`);
      }
    }
  }

  // ==================== BlurHash Generation ====================

  /**
   * Generate BlurHash from image buffer for progressive loading
   * BlurHash is a compact representation of a placeholder for an image
   * @param buffer - Image buffer
   * @returns BlurHash string (e.g., "LEHV6nWB2yk8pyo0adR*.7kCMdnj")
   */
  private async generateBlurHash(buffer: Buffer): Promise<string | null> {
    try {
      // Resize to small size for faster BlurHash computation
      const { data, info } = await sharp(buffer)
        .resize(32, 32, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // BlurHash components (4x3 is a good balance of quality vs size)
      const componentX = 4;
      const componentY = 3;

      const blurHash = encode(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        componentX,
        componentY,
      );

      return blurHash;
    } catch (error) {
      this.logger.warn(`Failed to generate BlurHash: ${error.message}`);
      return null;
    }
  }

  /**
   * Get image dimensions from buffer
   */
  private async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
      };
    } catch {
      return null;
    }
  }

  // ==================== Storage Usage ====================

  /**
   * Get user's storage usage and limit.
   * trashUsed = مجموع أحجام الملفات في سلة المهملات (تُحسب ضمن used حتى الحذف النهائي).
   */
  async getStorageUsage(userId: string): Promise<{
    used: number;
    limit: number;
    available: number;
    percentage: number;
    files: number;
    trashUsed: number;
    categoryBreakdown: Record<string, number>;
  }> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { storageUsed: true, storageLimit: true },
    });

    const fileCount = await this.prisma.userFile.count({
      where: { userId, deletedAt: null },
    });

    const used = Number(profile?.storageUsed || 0);
    const limit = Number(profile?.storageLimit || this.DEFAULT_STORAGE_LIMIT);
    const available = Math.max(0, limit - used);
    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

    const trashAgg = await this.prisma.userFile.aggregate({
      where: { userId, deletedAt: { not: null } },
      _sum: { fileSize: true },
    });
    const trashUsed = Number(trashAgg._sum.fileSize || 0);

    const byCategory = await this.prisma.userFile.groupBy({
      by: ['category'],
      where: { userId, deletedAt: null },
      _sum: { fileSize: true },
    });
    const categoryBreakdown: Record<string, number> = {};
    for (const row of byCategory) {
      categoryBreakdown[row.category] = Number(row._sum.fileSize || 0);
    }

    return {
      used,
      limit,
      available,
      percentage,
      files: fileCount,
      trashUsed,
      categoryBreakdown,
    };
  }

  /**
   * Check if user has enough storage for a file
   */
  async checkStorageLimit(userId: string, fileSize: number): Promise<boolean> {
    const { available } = await this.getStorageUsage(userId);
    return fileSize <= available;
  }

  // ==================== Direct S3 Upload ====================

  /**
   * Request a presigned PUT URL for direct S3 upload
   * This allows clients to upload directly to S3 without going through the server
   */
  async requestDirectUpload(
    userId: string,
    category: FileCategory,
    contentType: string,
    fileName: string,
    entityId?: string,
  ): Promise<{
    uploadUrl: string;
    key: string;
    expiresIn: number;
    maxFileSize: number;
  }> {
    // Validate content type
    if (!this.ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw new BadRequestException('نوع الملف غير مسموح');
    }

    // Validate file extension
    this.validateFileExtension(fileName);

    // Validate entity ownership if entityId provided
    if (entityId) {
      await this.validateEntityOwnership(userId, category, entityId);
    }

    // Check storage limit (use MAX_FILE_SIZE as estimate)
    const hasSpace = await this.checkStorageLimit(userId, this.MAX_FILE_SIZE);
    if (!hasSpace) {
      throw new BadRequestException('لا توجد مساحة تخزين كافية');
    }

    // Generate unique key based on category
    const filename = `${uuidv4()}.${this.getExtensionFromMime(contentType)}`;
    const key = this.generateKeyForCategory(userId, category, filename, entityId);

    // Generate presigned PUT URL (15 minutes expiry)
    const expiresIn = 900;
    const uploadUrl = await this.s3Service.getPresignedPutUrl(
      this.bucket,
      key,
      contentType,
      expiresIn,
    );

    return {
      uploadUrl,
      key,
      expiresIn,
      maxFileSize: this.MAX_FILE_SIZE,
    };
  }

  /**
   * Confirm direct upload completion and track the file
   */
  async confirmDirectUpload(
    userId: string,
    key: string,
    category: FileCategory,
    fileName: string,
    fileSize: bigint,
    entityId?: string,
  ): Promise<{
    id: string;
    key: string;
    url: string;
    blurHash: string | null;
    width: number | null;
    height: number | null;
  }> {
    // Verify the file exists in S3
    const exists = await this.s3Service.objectExists(this.bucket, key);
    if (!exists) {
      throw new BadRequestException('الملف غير موجود في S3');
    }

    // Check storage limit with actual file size
    const hasSpace = await this.checkStorageLimit(userId, Number(fileSize));
    if (!hasSpace) {
      // Delete the uploaded file since user doesn't have space
      await this.s3Service.deleteObject(this.bucket, key);
      throw new BadRequestException('لا توجد مساحة تخزين كافية');
    }

    // Download file to generate BlurHash
    let blurHash: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    try {
      const buffer = await this.s3Service.getObject(this.bucket, key);
      if (buffer) {
        const [hash, dims] = await Promise.all([
          this.generateBlurHash(buffer),
          this.getImageDimensions(buffer),
        ]);
        blurHash = hash;
        width = dims?.width ?? null;
        height = dims?.height ?? null;
      }
    } catch (error) {
      this.logger.warn(`Failed to process uploaded file for BlurHash: ${error.message}`);
    }

    // Delete old file if single-file category
    if (category === FileCategory.AVATAR || category === FileCategory.COVER) {
      await this.deleteFileByCategory(userId, category);
    } else if (entityId && (category === FileCategory.FORM_COVER || category === FileCategory.EVENT_COVER)) {
      await this.deleteFileByEntityAndCategory(userId, entityId, category);
    }

    // Track file in database
    const fileRecord = await this.prisma.$transaction(async (tx) => {
      const record = await tx.userFile.create({
        data: {
          userId,
          key,
          fileName,
          fileType: this.getMimeFromKey(key),
          fileSize,
          category,
          entityId,
          blurHash,
          width,
          height,
        },
      });

      await tx.profile.update({
        where: { userId },
        data: { storageUsed: { increment: fileSize } },
      });

      return record;
    });

    const url = await this.getPresignedUrl(key);

    return {
      id: fileRecord.id,
      key,
      url,
      blurHash,
      width,
      height,
    };
  }

  /**
   * Validate entity ownership based on category
   */
  private async validateEntityOwnership(
    userId: string,
    category: FileCategory,
    entityId: string,
  ): Promise<void> {
    switch (category) {
      case FileCategory.FORM_COVER:
      case FileCategory.FORM_BANNER:
        await this.validateFormOwnership(userId, entityId);
        break;
      case FileCategory.EVENT_COVER:
        await this.validateEventOwnership(userId, entityId);
        break;
      case FileCategory.PRODUCT_IMAGE:
        await this.validateProductOwnership(userId, entityId);
        break;
    }
  }

  /**
   * Generate S3 key based on category
   */
  private generateKeyForCategory(
    userId: string,
    category: FileCategory,
    filename: string,
    entityId?: string,
  ): string {
    switch (category) {
      case FileCategory.AVATAR:
        return this.s3Service.getAvatarKey(userId, filename);
      case FileCategory.COVER:
        return this.s3Service.getCoverKey(userId, filename);
      case FileCategory.FORM_COVER:
        return this.s3Service.getFormFileKey(userId, entityId!, 'cover', filename);
      case FileCategory.FORM_BANNER:
        return this.s3Service.getFormFileKey(userId, entityId!, 'banner', filename);
      case FileCategory.EVENT_COVER:
        return this.s3Service.getEventFileKey(userId, entityId!, 'cover', filename);
      case FileCategory.PRODUCT_IMAGE:
        return this.s3Service.getProductFileKey(userId, entityId!, filename);
      default:
        return `users/${userId}/files/${filename}`;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    return map[mime] || 'bin';
  }

  /**
   * Get MIME type from S3 key
   */
  private getMimeFromKey(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    return map[ext || ''] || 'application/octet-stream';
  }

  // ==================== File Upload Methods ====================

  /**
   * Upload avatar to S3 with processing
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Validate file extension
    this.validateFileExtension(file?.originalname);

    // Normalize file buffer (supports memory/disk/stream shapes)
    const buffer = await this.normalizeFileToBuffer(file);

    // Determine incoming size
    const incomingSize =
      (file && (file.size ?? buffer.length)) || buffer.length;

    // Validate file size
    if (incomingSize > this.MAX_AVATAR_SIZE) {
      throw new BadRequestException('حجم الملف يتجاوز 5MB');
    }

    // Check storage limit
    const hasSpace = await this.checkStorageLimit(userId, incomingSize);
    if (!hasSpace) {
      throw new BadRequestException('لا توجد مساحة تخزين كافية');
    }

    // Validate file type
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !this.ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
      throw new BadRequestException(
        'نوع الملف غير مسموح. يُسمح فقط بـ JPEG, PNG, WebP, GIF',
      );
    }

    // Process image with sharp - removes EXIF metadata by default
    const processedImage = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .resize(this.AVATAR_SIZE, this.AVATAR_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 90 })
      .toBuffer();

    // Generate BlurHash and get dimensions
    const [blurHash, dimensions] = await Promise.all([
      this.generateBlurHash(processedImage),
      this.getImageDimensions(processedImage),
    ]);

    // Generate S3 key
    const filename = `${uuidv4()}.webp`;
    const key = this.s3Service.getAvatarKey(userId, filename);

    // Delete old avatar if exists
    await this.deleteFileByCategory(userId, FileCategory.AVATAR);

    // Upload to S3
    await this.s3Service.uploadBuffer(
      this.bucket,
      key,
      processedImage,
      'image/webp',
    );

    // Track file in database
    await this.trackFile(userId, {
      key,
      fileName: file.originalname,
      fileType: 'image/webp',
      fileSize: BigInt(processedImage.length),
      category: FileCategory.AVATAR,
      blurHash,
      width: dimensions?.width,
      height: dimensions?.height,
    });

    this.logger.log(`Avatar uploaded for user ${userId}: ${key}`);
    return key;
  }

  /**
   * Upload cover image to S3 with processing
   */
  async uploadCover(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Validate file extension
    this.validateFileExtension(file?.originalname);

    // Normalize buffer
    const buffer = await this.normalizeFileToBuffer(file);

    const incomingSize =
      (file && (file.size ?? buffer.length)) || buffer.length;

    if (incomingSize > this.MAX_FILE_SIZE) {
      throw new BadRequestException('حجم الملف يتجاوز 10MB');
    }

    // Check storage limit
    const hasSpace = await this.checkStorageLimit(userId, incomingSize);
    if (!hasSpace) {
      throw new BadRequestException('لا توجد مساحة تخزين كافية');
    }

    // Validate file type
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !this.ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
      throw new BadRequestException(
        'نوع الملف غير مسموح. يُسمح فقط بـ JPEG, PNG, WebP, GIF',
      );
    }

    // Process image with sharp - removes EXIF metadata by default
    const processedImage = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .resize(this.COVER_WIDTH, this.COVER_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate BlurHash and get dimensions
    const [blurHash, dimensions] = await Promise.all([
      this.generateBlurHash(processedImage),
      this.getImageDimensions(processedImage),
    ]);

    // Generate S3 key
    const filename = `${uuidv4()}.webp`;
    const key = this.s3Service.getCoverKey(userId, filename);

    // Delete old cover if exists
    await this.deleteFileByCategory(userId, FileCategory.COVER);

    // Upload to S3
    await this.s3Service.uploadBuffer(
      this.bucket,
      key,
      processedImage,
      'image/webp',
    );

    // Track file in database
    await this.trackFile(userId, {
      key,
      fileName: file.originalname,
      fileType: 'image/webp',
      fileSize: BigInt(processedImage.length),
      category: FileCategory.COVER,
      blurHash,
      width: dimensions?.width,
      height: dimensions?.height,
    });

    this.logger.log(`Cover uploaded for user ${userId}: ${key}`);
    return key;
  }

  /**
   * Upload form cover image
   */
  async uploadFormCover(
    userId: string,
    formId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Validate ownership and file extension
    await this.validateFormOwnership(userId, formId);
    this.validateFileExtension(file?.originalname);

    const buffer = await this.normalizeFileToBuffer(file);
    const incomingSize =
      (file && (file.size ?? buffer.length)) || buffer.length;

    if (incomingSize > this.MAX_FILE_SIZE) {
      throw new BadRequestException('حجم الملف يتجاوز 10MB');
    }

    const hasSpace = await this.checkStorageLimit(userId, incomingSize);
    if (!hasSpace) {
      throw new BadRequestException('لا توجد مساحة تخزين كافية');
    }

    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !this.ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
      throw new BadRequestException('نوع الملف غير مسموح');
    }

    // Process image with sharp - removes EXIF metadata
    const processedImage = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate BlurHash and get dimensions
    const [blurHash, dimensions] = await Promise.all([
      this.generateBlurHash(processedImage),
      this.getImageDimensions(processedImage),
    ]);

    const filename = `${uuidv4()}.webp`;
    const key = this.s3Service.getFormFileKey(
      userId,
      formId,
      'cover',
      filename,
    );

    // Delete old form cover if exists
    await this.deleteFileByEntityAndCategory(
      userId,
      formId,
      FileCategory.FORM_COVER,
    );

    await this.s3Service.uploadBuffer(
      this.bucket,
      key,
      processedImage,
      'image/webp',
    );

    await this.trackFile(userId, {
      key,
      fileName: file.originalname,
      fileType: 'image/webp',
      fileSize: BigInt(processedImage.length),
      category: FileCategory.FORM_COVER,
      entityId: formId,
      blurHash,
      width: dimensions?.width,
      height: dimensions?.height,
    });

    return key;
  }

  /**
   * Upload form banner images
   */
  async uploadFormBanners(
    userId: string,
    formId: string,
    files: Express.Multer.File[],
  ): Promise<string[]> {
    // Validate ownership
    await this.validateFormOwnership(userId, formId);

    const keys: string[] = [];

    for (const file of files) {
      // Validate file extension
      this.validateFileExtension(file?.originalname);

      const buffer = await this.normalizeFileToBuffer(file);
      const incomingSize =
        (file && (file.size ?? buffer.length)) || buffer.length;

      if (incomingSize > this.MAX_FILE_SIZE) {
        throw new BadRequestException('حجم الملف يتجاوز 10MB');
      }

      const hasSpace = await this.checkStorageLimit(userId, incomingSize);
      if (!hasSpace) {
        throw new BadRequestException('لا توجد مساحة تخزين كافية');
      }

      const fileType = await fileTypeFromBuffer(buffer);
      if (!fileType || !this.ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
        continue; // Skip invalid files
      }

      // Process image with sharp - removes EXIF metadata
      const processedImage = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(1400, 400, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();

      // Generate BlurHash and get dimensions
      const [blurHash, dimensions] = await Promise.all([
        this.generateBlurHash(processedImage),
        this.getImageDimensions(processedImage),
      ]);

      const filename = `${uuidv4()}.webp`;
      const key = this.s3Service.getFormFileKey(
        userId,
        formId,
        'banner',
        filename,
      );

      await this.s3Service.uploadBuffer(
        this.bucket,
        key,
        processedImage,
        'image/webp',
      );

      await this.trackFile(userId, {
        key,
        fileName: file.originalname,
        fileType: 'image/webp',
        fileSize: BigInt(processedImage.length),
        category: FileCategory.FORM_BANNER,
        entityId: formId,
        blurHash,
        width: dimensions?.width,
        height: dimensions?.height,
      });

      keys.push(key);
    }

    return keys;
  }

  /**
   * Upload event cover image
   */
  async uploadEventCover(
    userId: string,
    eventId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Validate ownership and file extension
    await this.validateEventOwnership(userId, eventId);
    this.validateFileExtension(file?.originalname);

    const buffer = await this.normalizeFileToBuffer(file);
    const incomingSize =
      (file && (file.size ?? buffer.length)) || buffer.length;

    if (incomingSize > this.MAX_FILE_SIZE) {
      throw new BadRequestException('حجم الملف يتجاوز 10MB');
    }

    const hasSpace = await this.checkStorageLimit(userId, incomingSize);
    if (!hasSpace) {
      throw new BadRequestException('لا توجد مساحة تخزين كافية');
    }

    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !this.ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
      throw new BadRequestException('نوع الملف غير مسموح');
    }

    // Process image with sharp - removes EXIF metadata
    const processedImage = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(1200, 630, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate BlurHash and get dimensions
    const [blurHash, dimensions] = await Promise.all([
      this.generateBlurHash(processedImage),
      this.getImageDimensions(processedImage),
    ]);

    const filename = `${uuidv4()}.webp`;
    const key = this.s3Service.getEventFileKey(
      userId,
      eventId,
      'cover',
      filename,
    );

    await this.deleteFileByEntityAndCategory(
      userId,
      eventId,
      FileCategory.EVENT_COVER,
    );

    await this.s3Service.uploadBuffer(
      this.bucket,
      key,
      processedImage,
      'image/webp',
    );

    await this.trackFile(userId, {
      key,
      fileName: file.originalname,
      fileType: 'image/webp',
      fileSize: BigInt(processedImage.length),
      category: FileCategory.EVENT_COVER,
      entityId: eventId,
      blurHash,
      width: dimensions?.width,
      height: dimensions?.height,
    });

    return key;
  }

  /**
   * Upload product image
   */
  async uploadProductImage(
    userId: string,
    productId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Validate ownership and file extension
    await this.validateProductOwnership(userId, productId);
    this.validateFileExtension(file?.originalname);

    const buffer = await this.normalizeFileToBuffer(file);
    const incomingSize =
      (file && (file.size ?? buffer.length)) || buffer.length;

    if (incomingSize > this.MAX_FILE_SIZE) {
      throw new BadRequestException('حجم الملف يتجاوز 10MB');
    }

    const hasSpace = await this.checkStorageLimit(userId, incomingSize);
    if (!hasSpace) {
      throw new BadRequestException('لا توجد مساحة تخزين كافية');
    }

    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !this.ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
      throw new BadRequestException('نوع الملف غير مسموح');
    }

    // Process image with sharp - removes EXIF metadata
    const processedImage = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate BlurHash and get dimensions
    const [blurHash, dimensions] = await Promise.all([
      this.generateBlurHash(processedImage),
      this.getImageDimensions(processedImage),
    ]);

    const filename = `${uuidv4()}.webp`;
    const key = this.s3Service.getProductFileKey(userId, productId, filename);

    await this.s3Service.uploadBuffer(
      this.bucket,
      key,
      processedImage,
      'image/webp',
    );

    await this.trackFile(userId, {
      key,
      fileName: file.originalname,
      fileType: 'image/webp',
      fileSize: BigInt(processedImage.length),
      category: FileCategory.PRODUCT_IMAGE,
      entityId: productId,
      blurHash,
      width: dimensions?.width,
      height: dimensions?.height,
    });

    return key;
  }

  /**
   * Normalize various file shapes into a Buffer.
   * Supports multer memory (`file.buffer`), disk (`file.path`), stream, Blob-like, and serialized Buffer shapes.
   */
  private async normalizeFileToBuffer(file: any): Promise<Buffer> {
    // Try direct buffer-like properties first
    const fb = file?.buffer ?? file?.content ?? file;

    const normalize = (input: any): Buffer | null => {
      if (!input) return null;
      try {
        if (Buffer.isBuffer(input)) return input;
        if (input instanceof Uint8Array) return Buffer.from(input);
        if (typeof input.arrayBuffer === 'function') {
          const arr = Buffer.from(new Uint8Array(input.arrayBuffer()));
          return arr;
        }
        // Serialized Node Buffer: { type: 'Buffer', data: [...] }
        if (Array.isArray(input.data)) return Buffer.from(input.data);
        // Nested buffer: { buffer: { type: 'Buffer', data: [...] } }
        if (input.buffer && Array.isArray(input.buffer.data))
          return Buffer.from(input.buffer.data);
        // Array-like numeric object
        const keys = Object.keys(input || {})
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b));
        if (keys.length > 0) {
          const arr = new Uint8Array(keys.length);
          for (let idx = 0; idx < keys.length; idx++) {
            const k = keys[idx];
            arr[idx] = Number(input[k]) || 0;
          }
          return Buffer.from(arr);
        }
      } catch (e) {
        // ignore
      }
      return null;
    };

    let buf = normalize(fb);

    // Multer diskStorage -> file.path
    if (!buf && file?.path) {
      const p = file.path;
      if (existsSync(p)) {
        buf = await readFile(p);
      }
    }

    // Readable stream
    if (!buf && file?.stream) {
      const stream: Readable = file.stream;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      buf = Buffer.concat(chunks);
    }

    // Fallback: try normalize again on full file object
    if (!buf) buf = normalize(file);

    if (!buf) {
      throw new BadRequestException('Invalid file buffer provided');
    }

    return buf;
  }

  /**
   * Get presigned URL for a file
   */
  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!key) return '';
    if (key.startsWith('http')) return key;
    return this.s3Service.getPresignedGetUrl(
      this.bucket,
      key,
      expiresInSeconds,
    );
  }

  /**
   * Track a file in the database
   */
  private async trackFile(
    userId: string,
    data: {
      key: string;
      fileName: string;
      fileType: string;
      fileSize: bigint;
      category: FileCategory;
      entityId?: string;
      blurHash?: string | null;
      width?: number | null;
      height?: number | null;
    },
  ): Promise<void> {
    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Create file record
      await tx.userFile.create({
        data: {
          userId,
          key: data.key,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          category: data.category,
          entityId: data.entityId,
          blurHash: data.blurHash,
          width: data.width,
          height: data.height,
        },
      });

      // Update storage usage
      await tx.profile.update({
        where: { userId },
        data: {
          storageUsed: { increment: data.fileSize },
        },
      });
    });
  }

  /**
   * Delete a file by category (for single-file categories like avatar, cover)
   */
  async deleteFileByCategory(
    userId: string,
    category: FileCategory,
  ): Promise<void> {
    const files = await this.prisma.userFile.findMany({
      where: { userId, category, deletedAt: null },
    });

    for (const file of files) {
      await this.deleteFile(userId, file.id);
    }
  }

  /**
   * Delete a file by entity and category
   */
  async deleteFileByEntityAndCategory(
    userId: string,
    entityId: string,
    category: FileCategory,
  ): Promise<void> {
    const files = await this.prisma.userFile.findMany({
      where: { userId, entityId, category, deletedAt: null },
    });

    for (const file of files) {
      await this.deleteFile(userId, file.id);
    }
  }

  /** مدة الاحتفاظ بالمحذوفات قبل الحذف النهائي (بالأيام) */
  private readonly DELETED_RETENTION_DAYS = 30;

  /**
   * حذف ناعم: تعيين deletedAt فقط، الملف يبقى في S3 حتى انتهاء المدة ثم يُحذف نهائياً
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await this.prisma.userFile.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) return;
    if (file.deletedAt) return; // already soft-deleted

    await this.prisma.userFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Soft-deleted file ${file.key} for user ${userId}`);
  }

  /**
   * استرداد ملف من سلة المهملات (إلغاء الحذف الناعم)
   */
  async restoreFile(userId: string, fileId: string): Promise<void> {
    const file = await this.prisma.userFile.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) return;
    if (!file.deletedAt) return;

    await this.prisma.userFile.update({
      where: { id: fileId },
      data: { deletedAt: null },
    });

    this.logger.log(`Restored file ${file.key} for user ${userId}`);
  }

  /**
   * حذف نهائي لملف (من S3 وقاعدة البيانات وتحديث storageUsed)
   * يُستخدم داخلياً بعد انتهاء مدة الاحتفاظ أو عند حذف الحساب.
   */
  async permanentDeleteFile(userId: string, fileId: string): Promise<void> {
    const file = await this.prisma.userFile.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) return;

    await this.s3Service.deleteObject(this.bucket, file.key);
    await this.prisma.profile.update({
      where: { userId },
      data: { storageUsed: { decrement: file.fileSize } },
    });
    await this.prisma.userFile.delete({
      where: { id: fileId },
    });
    this.logger.log(`Permanently deleted file ${file.key} for user ${userId}`);
  }

  /**
   * Delete all files for a user (account deletion)
   */
  async deleteAllUserFiles(userId: string): Promise<void> {
    // Delete from S3
    await this.s3Service.deleteUserFiles(this.bucket, userId);

    // Delete all records
    await this.prisma.userFile.deleteMany({
      where: { userId },
    });

    // Reset storage usage
    await this.prisma.profile.update({
      where: { userId },
      data: { storageUsed: 0 },
    });

    this.logger.log(`Deleted all files for user ${userId}`);
  }

  /**
   * Get list of user files (active only by default; use deletedOnly for trash)
   */
  async getUserFiles(
    userId: string,
    options?: {
      category?: FileCategory;
      entityId?: string;
      page?: number;
      limit?: number;
      deletedOnly?: boolean;
    },
  ): Promise<{
    files: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options?.category) where.category = options.category;
    if (options?.entityId) where.entityId = options.entityId;
    if (options?.deletedOnly) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    const [files, total] = await Promise.all([
      this.prisma.userFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userFile.count({ where }),
    ]);

    const filesWithUrls = await Promise.all(
      files.map(async (file) => ({
        ...file,
        fileSize: Number(file.fileSize),
        url: await this.getPresignedUrl(file.key),
        deletedAt: file.deletedAt?.toISOString() ?? null,
      })),
    );

    return {
      files: filesWithUrls,
      total,
      page,
      limit,
    };
  }

  /**
   * Delete files by entity (when deleting form, event, product) — soft delete
   */
  async deleteFilesByEntity(userId: string, entityId: string): Promise<void> {
    const files = await this.prisma.userFile.findMany({
      where: { userId, entityId, deletedAt: null },
    });

    for (const file of files) {
      await this.deleteFile(userId, file.id);
    }
  }

  /**
   * حذف نهائي لجميع الملفات التي انتهت مدة الاحتفاظ (deletedAt + 30 يوم)
   * يُستدعى من Cron أو Scheduler يومياً.
   */
  async purgeExpiredDeletedFiles(): Promise<{ purged: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.DELETED_RETENTION_DAYS);

    const expired = await this.prisma.userFile.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
    });

    for (const file of expired) {
      await this.permanentDeleteFile(file.userId, file.id);
    }

    this.logger.log(`Purged ${expired.length} expired deleted files`);
    return { purged: expired.length };
  }

  /**
   * إعادة احتساب storageUsed لمستخدم واحد من مجموع أحجام UserFile (النشطة فقط، غير المحذوفة).
   * يُصلح أي فرق ناتج عن increment/decrement أو مسارات قديمة.
   */
  async recalculateStorageUsed(userId: string): Promise<{ used: number }> {
    const agg = await this.prisma.userFile.aggregate({
      where: { userId, deletedAt: null },
      _sum: { fileSize: true },
    });
    const used = Number(agg._sum.fileSize || 0);

    await this.prisma.profile.update({
      where: { userId },
      data: { storageUsed: BigInt(used) },
    });

    this.logger.debug(`Recalculated storage for user ${userId}: ${used} bytes`);
    return { used };
  }

  /**
   * إعادة احتساب storageUsed لجميع المستخدمين الذين لديهم ملفات.
   * يُستدعى من Cron يومي لتصحيح أي انحراف.
   */
  async recalculateStorageUsedForAllUsers(): Promise<{ usersUpdated: number }> {
    const userIds = await this.prisma.userFile
      .findMany({ select: { userId: true }, distinct: ['userId'] })
      .then((rows) => [...new Set(rows.map((r) => r.userId))]);

    for (const userId of userIds) {
      await this.recalculateStorageUsed(userId);
    }

    this.logger.log(`Recalculated storage for ${userIds.length} user(s)`);
    return { usersUpdated: userIds.length };
  }
}
