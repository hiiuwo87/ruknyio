import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../../shared/services/s3.service';
import { ImageProcessorService } from '../../shared/services/image-processor.service';
import { VideoProcessorService } from '../../shared/services/video-processor.service';
import { UploadProgressService } from '../../shared/services/upload-progress.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { FileCategory } from '@prisma/client';
import { extname } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import {
  FileTooLargeException,
  InvalidFileTypeException,
  TooManyFilesException,
  NoFilesProvidedException,
} from '../../shared/exceptions/upload.exceptions';

// Supported image formats (animated included)
const ANIMATED_MIME_TYPES = ['image/gif', 'image/webp', 'image/png', 'image/avif'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

// Supported video formats
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

// Combined media types
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Media type detection
type MediaType = 'image' | 'video' | 'unknown';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly bucket: string;
  private readonly maxFiles: number;
  private readonly maxFileSizeMB: number;
  private readonly maxVideoSizeMB: number;
  private readonly maxVideoDurationSeconds: number;

  constructor(
    private readonly s3Service: S3Service,
    private readonly imageProcessor: ImageProcessorService,
    private readonly videoProcessor: VideoProcessorService,
    private readonly uploadProgress: UploadProgressService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('S3_BUCKET', '');
    this.maxFiles = this.configService.get<number>('S3_UPLOAD_MAX_FILES', 3);
    this.maxFileSizeMB = this.configService.get<number>('S3_UPLOAD_MAX_MB', 5);
    this.maxVideoSizeMB = this.configService.get<number>('VIDEO_MAX_SIZE_MB', 50);
    this.maxVideoDurationSeconds = this.configService.get<number>('VIDEO_MAX_DURATION_SECONDS', 30);
  }

  /**
   * Detect media type from mime type
   */
  private getMediaType(mimetype: string): MediaType {
    if (ALLOWED_IMAGE_TYPES.includes(mimetype)) return 'image';
    if (ALLOWED_VIDEO_TYPES.includes(mimetype)) return 'video';
    return 'unknown';
  }

  /**
   * Check if file is a video
   */
  isVideo(mimetype: string): boolean {
    return ALLOWED_VIDEO_TYPES.includes(mimetype);
  }

  /**
   * Check if file is an image
   */
  isImage(mimetype: string): boolean {
    return ALLOWED_IMAGE_TYPES.includes(mimetype);
  }

  /**
   * Get user's banner URLs as presigned URLs (works with private S3 buckets)
   * URLs are valid for 1 hour
   */
  async getBannerUrls(
    userId: string,
  ): Promise<{ keys: string[]; urls: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannerUrls: true },
    });
    const keys: string[] = user?.bannerUrls || [];
    if (keys.length === 0) {
      return { keys: [], urls: [] };
    }
    // Generate presigned GET URLs for each key
    const urls = await this.s3Service.getPresignedGetUrls(
      this.bucket,
      keys,
      3600,
    );
    return { keys, urls };
  }

  /**
   * Validate uploaded files
   * Now supports: JPEG, PNG, WebP, GIF (animated), AVIF
   */
  validateFiles(files: Express.Multer.File[], options?: { allowAnimated?: boolean }) {
    const allowAnimated = options?.allowAnimated ?? true;

    if (!files || files.length === 0) {
      throw new NoFilesProvidedException();
    }

    if (files.length > this.maxFiles) {
      throw new TooManyFilesException(this.maxFiles, files.length);
    }

    const maxSizeBytes = this.maxFileSizeMB * 1024 * 1024;

    for (const file of files) {
      // Check file type - now includes GIF and AVIF
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new InvalidFileTypeException(file.mimetype, ALLOWED_MIME_TYPES);
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        throw new FileTooLargeException(
          this.maxFileSizeMB,
          file.size / (1024 * 1024),
        );
      }

      // If animated not allowed, check for GIF specifically
      if (!allowAnimated && file.mimetype === 'image/gif') {
        throw new InvalidFileTypeException(file.mimetype, ['image/jpeg', 'image/png', 'image/webp']);
      }
    }
  }

  /**
   * Check if a file is potentially animated
   */
  isAnimatedType(mimetype: string): boolean {
    return ANIMATED_MIME_TYPES.includes(mimetype);
  }

  /**
   * Build S3 key for uploaded file
   */
  buildKey(userId: string, index: number, originalname: string, format?: string) {
    // Use provided format or extract from original name
    const ext = format ? `.${format}` : (extname(originalname) || '.webp');
    // Remove extension from filename before sanitizing
    const nameWithoutExt = originalname.replace(/\.[^.]+$/, '');
    const safe = nameWithoutExt
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-]/g, '');
    return `users/${userId}/banners/${Date.now()}-${index}-${safe}${ext}`;
  }

  /**
   * Normalize file content to Buffer
   */
  private async normalizeFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    const fb = (file as any).buffer ?? (file as any).content ?? file;

    // Direct Buffer
    if (Buffer.isBuffer(fb)) return fb;

    // Uint8Array
    if (fb instanceof Uint8Array) return Buffer.from(fb);

    // Blob-like with arrayBuffer
    if (typeof fb?.arrayBuffer === 'function') {
      const ab = await fb.arrayBuffer();
      return Buffer.from(new Uint8Array(ab));
    }

    // Serialized Buffer: { type: 'Buffer', data: [...] }
    if (Array.isArray(fb?.data)) return Buffer.from(fb.data);

    // Nested buffer
    if (fb?.buffer && Array.isArray(fb.buffer.data)) {
      return Buffer.from(fb.buffer.data);
    }

    // ArrayBuffer-like
    if (fb?.byteLength && fb?.buffer) {
      return Buffer.from(new Uint8Array(fb.buffer));
    }

    // Numeric keyed object
    if (fb && typeof fb === 'object') {
      const keys = Object.keys(fb).filter((k) => /^\d+$/.test(k));
      if (keys.length > 0) {
        const arr = new Uint8Array(keys.length);
        keys.sort((a, b) => Number(a) - Number(b));
        for (let i = 0; i < keys.length; i++) {
          arr[i] = Number(fb[keys[i]]) || 0;
        }
        return Buffer.from(arr);
      }
    }

    // Multer diskStorage -> file.path
    if ((file as any).path && existsSync((file as any).path)) {
      return readFile((file as any).path);
    }

    // Readable stream
    if ((file as any).stream) {
      const stream: Readable = (file as any).stream;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    throw new BadRequestException('Invalid buffer provided for upload');
  }

  /**
   * Upload banners with image processing and progress tracking
   * Supports: JPEG, PNG, WebP, GIF (animated), AVIF
   */
  async uploadBanners(
    userId: string,
    files: Express.Multer.File[],
    options?: { preserveAnimation?: boolean },
  ) {
    const preserveAnimation = options?.preserveAnimation ?? true;

    // Validate files
    this.validateFiles(files, { allowAnimated: preserveAnimation });

    const uploadedKeys: string[] = [];
    const batchId = uuidv4();

    // Get existing keys
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannerUrls: true },
    });
    const oldKeys: string[] = user?.bannerUrls || [];

    // Start batch progress tracking
    const batchFiles = files.map((file, i) => ({
      uploadId: `${batchId}-${i}`,
      fileName: file.originalname,
      fileSize: file.size,
    }));
    this.uploadProgress.startBatch(batchId, userId, batchFiles);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = `${batchId}-${i}`;

      try {
        // Mark as processing
        this.uploadProgress.markProcessing(uploadId);

        // Normalize buffer
        const rawBuffer = await this.normalizeFileBuffer(file);

        // Check if animated
        const isAnimated = await this.imageProcessor.isAnimated(rawBuffer);

        // Process image
        let processed;
        if (isAnimated && preserveAnimation) {
          // Process animated image (preserve frames)
          processed = await this.imageProcessor.processAnimated(rawBuffer, {
            maxWidth: 1400,
            quality: 80,
          });
          this.logger.debug(
            `Processed animated image: ${file.originalname} (${processed.format}, ${processed.size} bytes)`,
          );
        } else {
          // Process as static banner
          processed = await this.imageProcessor.processBanner(rawBuffer, 1400, 400);
        }

        // Build key with correct format
        const key = this.buildKey(userId, i, file.originalname, processed.format);

        // Upload to S3
        const contentType = `image/${processed.format}`;
        await this.s3Service.uploadBuffer(this.bucket, key, processed.buffer, contentType);

        uploadedKeys.push(key);

        // Track file in database
        await this.prisma.userFile.create({
          data: {
            userId,
            key,
            fileName: file.originalname,
            fileType: contentType,
            fileSize: BigInt(processed.size),
            category: FileCategory.BANNER,
          },
        });

        // Update storage usage
        await this.prisma.profile.update({
          where: { userId },
          data: {
            storageUsed: { increment: BigInt(processed.size) },
          },
        });

        // Mark upload as complete
        this.uploadProgress.completeUpload(uploadId, {
          key,
          format: processed.format,
          size: processed.size,
          isAnimated: processed.isAnimated,
          compressionRatio: processed.compressionRatio,
        });

        this.logger.log(
          `Uploaded banner: ${key} (${processed.isAnimated ? 'animated' : 'static'}, ` +
            `compression: ${processed.compressionRatio.toFixed(2)}x)`,
        );
      } catch (error: any) {
        this.uploadProgress.failUpload(uploadId, error.message);
        this.logger.error(`Failed to upload banner ${file.originalname}: ${error.message}`);
        throw error;
      }
    }

    // Merge new keys with existing ones
    const mergedKeys = Array.from(new Set([...oldKeys, ...uploadedKeys])).slice(
      0,
      this.maxFiles,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { bannerUrls: mergedKeys },
      select: { id: true, bannerUrls: true },
    });

    const region = this.configService.get<string>('AWS_REGION', 'eu-north-1');
    return {
      keys: mergedKeys,
      urls: mergedKeys.map(
        (k) => `https://${this.bucket}.s3.${region}.amazonaws.com/${k}`,
      ),
      batch: this.uploadProgress.getBatch(batchId),
    };
  }

  /**
   * Generate presigned URLs for direct upload
   * Supports: JPEG, PNG, WebP, GIF, AVIF
   */
  async generatePresignedUrls(
    userId: string,
    files: { name: string; type: string; size: number }[],
  ) {
    if (!files || files.length === 0) {
      throw new NoFilesProvidedException();
    }

    if (files.length > this.maxFiles) {
      throw new TooManyFilesException(this.maxFiles, files.length);
    }

    const maxSizeBytes = this.maxFileSizeMB * 1024 * 1024;
    const result: { key: string; url: string; isAnimated: boolean }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];

      // Validate file type - now includes GIF and AVIF
      if (!ALLOWED_MIME_TYPES.includes(f.type)) {
        throw new InvalidFileTypeException(f.type, ALLOWED_MIME_TYPES);
      }

      // Validate file size
      if (f.size > maxSizeBytes) {
        throw new FileTooLargeException(this.maxFileSizeMB, f.size / (1024 * 1024));
      }

      const key = this.buildKey(userId, i, f.name);
      const presigned = await this.s3Service.getPresignedPutUrl(
        this.bucket,
        key,
        f.type,
      );

      result.push({
        key,
        url: presigned,
        isAnimated: this.isAnimatedType(f.type),
      });
    }

    return result;
  }

  /**
   * Confirm uploaded keys and save to user profile
   */
  async confirmKeys(userId: string, keys: string[]) {
    if (!keys || keys.length === 0) {
      throw new BadRequestException('No keys provided');
    }

    // Get existing keys to merge with new ones
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannerUrls: true },
    });
    const existingKeys: string[] = user?.bannerUrls || [];

    // Merge: keep existing + add new (deduplicate and limit to max)
    const mergedKeys = Array.from(new Set([...existingKeys, ...keys])).slice(
      0,
      this.maxFiles,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { bannerUrls: mergedKeys },
      select: { id: true, bannerUrls: true },
    });

    return { ok: true, keys: mergedKeys };
  }

  /**
   * Delete uploaded files from S3
   */
  async deleteKeys(keys: string[]) {
    if (!keys || keys.length === 0) {
      return { ok: true, deleted: 0 };
    }

    let deletedCount = 0;
    for (const key of keys) {
      const deleted = await this.s3Service.deleteObject(this.bucket, key);
      if (deleted) deletedCount++;
    }

    return { ok: true, deleted: deletedCount };
  }

  // ===== Video Upload Methods =====

  /**
   * Upload video as avatar (short, square, muted)
   * Returns video URL and thumbnail URL
   */
  async uploadVideoAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{
    videoKey: string;
    videoUrl: string;
    thumbnailKey: string;
    thumbnailUrl: string;
    duration: number;
    isVideo: true;
  }> {
    // Validate video
    if (!this.isVideo(file.mimetype)) {
      throw new InvalidFileTypeException(file.mimetype, ALLOWED_VIDEO_TYPES);
    }

    const maxSizeBytes = this.maxVideoSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new FileTooLargeException(this.maxVideoSizeMB, file.size / (1024 * 1024));
    }

    const uploadId = uuidv4();
    this.uploadProgress.startUpload(uploadId, userId, file.originalname, file.size);

    try {
      this.uploadProgress.markProcessing(uploadId);

      // Normalize buffer
      const rawBuffer = await this.normalizeFileBuffer(file);

      // Process video for avatar (short, square, muted)
      const processed = await this.videoProcessor.processAvatar(rawBuffer, 400);

      // Build keys
      const timestamp = Date.now();
      const videoKey = `users/${userId}/profile/avatar/${timestamp}.mp4`;
      const thumbnailKey = `users/${userId}/profile/avatar/${timestamp}_thumb.jpg`;

      // Upload video
      await this.s3Service.uploadBuffer(this.bucket, videoKey, processed.buffer, 'video/mp4');

      // Upload thumbnail
      if (processed.thumbnail) {
        await this.s3Service.uploadBuffer(
          this.bucket,
          thumbnailKey,
          processed.thumbnail.buffer,
          'image/jpeg',
        );
      }

      // Track files in database
      await this.prisma.userFile.create({
        data: {
          userId,
          key: videoKey,
          fileName: file.originalname,
          fileType: 'video/mp4',
          fileSize: BigInt(processed.size),
          category: FileCategory.AVATAR,
        },
      });

      // Update storage usage
      const totalSize = processed.size + (processed.thumbnail?.size || 0);
      await this.prisma.profile.update({
        where: { userId },
        data: { storageUsed: { increment: BigInt(totalSize) } },
      });

      this.uploadProgress.completeUpload(uploadId, {
        videoKey,
        thumbnailKey,
        duration: processed.duration,
      });

      const region = this.configService.get<string>('AWS_REGION', 'eu-north-1');
      const baseUrl = `https://${this.bucket}.s3.${region}.amazonaws.com`;

      this.logger.log(
        `Uploaded video avatar: ${videoKey} (duration: ${processed.duration}s, compression: ${processed.compressionRatio.toFixed(2)}x)`,
      );

      return {
        videoKey,
        videoUrl: `${baseUrl}/${videoKey}`,
        thumbnailKey,
        thumbnailUrl: `${baseUrl}/${thumbnailKey}`,
        duration: processed.duration,
        isVideo: true,
      };
    } catch (error: any) {
      this.uploadProgress.failUpload(uploadId, error.message);
      this.logger.error(`Failed to upload video avatar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload video as banner/cover
   * Returns video URL and thumbnail URL
   */
  async uploadVideoBanner(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{
    videoKey: string;
    videoUrl: string;
    thumbnailKey: string;
    thumbnailUrl: string;
    duration: number;
    isVideo: true;
  }> {
    // Validate video
    if (!this.isVideo(file.mimetype)) {
      throw new InvalidFileTypeException(file.mimetype, ALLOWED_VIDEO_TYPES);
    }

    const maxSizeBytes = this.maxVideoSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new FileTooLargeException(this.maxVideoSizeMB, file.size / (1024 * 1024));
    }

    const uploadId = uuidv4();
    this.uploadProgress.startUpload(uploadId, userId, file.originalname, file.size);

    try {
      this.uploadProgress.markProcessing(uploadId);

      const rawBuffer = await this.normalizeFileBuffer(file);

      // Process video for banner (wider aspect ratio)
      const processed = await this.videoProcessor.processBanner(rawBuffer, 1400, 400);

      // Build keys
      const timestamp = Date.now();
      const videoKey = `users/${userId}/banners/${timestamp}.mp4`;
      const thumbnailKey = `users/${userId}/banners/${timestamp}_thumb.jpg`;

      // Upload video
      await this.s3Service.uploadBuffer(this.bucket, videoKey, processed.buffer, 'video/mp4');

      // Upload thumbnail
      if (processed.thumbnail) {
        await this.s3Service.uploadBuffer(
          this.bucket,
          thumbnailKey,
          processed.thumbnail.buffer,
          'image/jpeg',
        );
      }

      // Track in database
      await this.prisma.userFile.create({
        data: {
          userId,
          key: videoKey,
          fileName: file.originalname,
          fileType: 'video/mp4',
          fileSize: BigInt(processed.size),
          category: FileCategory.BANNER,
        },
      });

      // Update storage
      const totalSize = processed.size + (processed.thumbnail?.size || 0);
      await this.prisma.profile.update({
        where: { userId },
        data: { storageUsed: { increment: BigInt(totalSize) } },
      });

      this.uploadProgress.completeUpload(uploadId, {
        videoKey,
        thumbnailKey,
        duration: processed.duration,
      });

      const region = this.configService.get<string>('AWS_REGION', 'eu-north-1');
      const baseUrl = `https://${this.bucket}.s3.${region}.amazonaws.com`;

      this.logger.log(
        `Uploaded video banner: ${videoKey} (duration: ${processed.duration}s)`,
      );

      return {
        videoKey,
        videoUrl: `${baseUrl}/${videoKey}`,
        thumbnailKey,
        thumbnailUrl: `${baseUrl}/${thumbnailKey}`,
        duration: processed.duration,
        isVideo: true,
      };
    } catch (error: any) {
      this.uploadProgress.failUpload(uploadId, error.message);
      this.logger.error(`Failed to upload video banner: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload video as profile background
   * Longer duration, larger size allowed
   */
  async uploadVideoBackground(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{
    videoKey: string;
    videoUrl: string;
    thumbnailKey: string;
    thumbnailUrl: string;
    duration: number;
    isVideo: true;
  }> {
    // Validate video
    if (!this.isVideo(file.mimetype)) {
      throw new InvalidFileTypeException(file.mimetype, ALLOWED_VIDEO_TYPES);
    }

    // Allow larger size for backgrounds (100MB)
    const maxSizeBytes = 100 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new FileTooLargeException(100, file.size / (1024 * 1024));
    }

    const uploadId = uuidv4();
    this.uploadProgress.startUpload(uploadId, userId, file.originalname, file.size);

    try {
      this.uploadProgress.markProcessing(uploadId);

      const rawBuffer = await this.normalizeFileBuffer(file);

      // Process for background (larger, looping, muted)
      const processed = await this.videoProcessor.processProfileBackground(rawBuffer);

      // Build keys
      const timestamp = Date.now();
      const videoKey = `users/${userId}/profile/background/${timestamp}.mp4`;
      const thumbnailKey = `users/${userId}/profile/background/${timestamp}_thumb.jpg`;

      // Upload video
      await this.s3Service.uploadBuffer(this.bucket, videoKey, processed.buffer, 'video/mp4');

      // Upload thumbnail
      if (processed.thumbnail) {
        await this.s3Service.uploadBuffer(
          this.bucket,
          thumbnailKey,
          processed.thumbnail.buffer,
          'image/jpeg',
        );
      }

      // Track in database
      await this.prisma.userFile.create({
        data: {
          userId,
          key: videoKey,
          fileName: file.originalname,
          fileType: 'video/mp4',
          fileSize: BigInt(processed.size),
          category: FileCategory.COVER,
        },
      });

      // Update storage
      const totalSize = processed.size + (processed.thumbnail?.size || 0);
      await this.prisma.profile.update({
        where: { userId },
        data: { storageUsed: { increment: BigInt(totalSize) } },
      });

      this.uploadProgress.completeUpload(uploadId, {
        videoKey,
        thumbnailKey,
        duration: processed.duration,
      });

      const region = this.configService.get<string>('AWS_REGION', 'eu-north-1');
      const baseUrl = `https://${this.bucket}.s3.${region}.amazonaws.com`;

      this.logger.log(
        `Uploaded video background: ${videoKey} (duration: ${processed.duration}s)`,
      );

      return {
        videoKey,
        videoUrl: `${baseUrl}/${videoKey}`,
        thumbnailKey,
        thumbnailUrl: `${baseUrl}/${thumbnailKey}`,
        duration: processed.duration,
        isVideo: true,
      };
    } catch (error: any) {
      this.uploadProgress.failUpload(uploadId, error.message);
      this.logger.error(`Failed to upload video background: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload media (image or video) automatically detecting type
   * For avatar, banner, or background
   */
  async uploadMedia(
    userId: string,
    file: Express.Multer.File,
    purpose: 'avatar' | 'banner' | 'background',
  ) {
    const mediaType = this.getMediaType(file.mimetype);

    if (mediaType === 'video') {
      // Check if video processing is available
      if (!this.videoProcessor.isAvailable()) {
        throw new BadRequestException(
          'Video upload is not available. FFmpeg is required for video processing.',
        );
      }

      switch (purpose) {
        case 'avatar':
          return this.uploadVideoAvatar(userId, file);
        case 'banner':
          return this.uploadVideoBanner(userId, file);
        case 'background':
          return this.uploadVideoBackground(userId, file);
      }
    }

    if (mediaType === 'image') {
      // Use existing image upload logic
      const rawBuffer = await this.normalizeFileBuffer(file);

      switch (purpose) {
        case 'avatar':
          const avatar = await this.imageProcessor.processAvatar(rawBuffer, 400);
          const avatarKey = `users/${userId}/profile/avatar/${Date.now()}.${avatar.format}`;
          await this.s3Service.uploadBuffer(this.bucket, avatarKey, avatar.buffer, `image/${avatar.format}`);
          const region = this.configService.get<string>('AWS_REGION', 'eu-north-1');
          return {
            key: avatarKey,
            url: `https://${this.bucket}.s3.${region}.amazonaws.com/${avatarKey}`,
            isVideo: false,
          };

        case 'banner':
        case 'background':
          const banner = await this.imageProcessor.processBanner(rawBuffer, 1400, 400);
          const bannerKey = `users/${userId}/banners/${Date.now()}.${banner.format}`;
          await this.s3Service.uploadBuffer(this.bucket, bannerKey, banner.buffer, `image/${banner.format}`);
          const regionB = this.configService.get<string>('AWS_REGION', 'eu-north-1');
          return {
            key: bannerKey,
            url: `https://${this.bucket}.s3.${regionB}.amazonaws.com/${bannerKey}`,
            isVideo: false,
          };
      }
    }

    throw new InvalidFileTypeException(file.mimetype, ALLOWED_MIME_TYPES);
  }

  /**
   * Check if video processing is available
   */
  isVideoProcessingAvailable(): boolean {
    return this.videoProcessor.isAvailable();
  }

  /**
   * Get upload progress for a user
   */
  getUploadProgress(userId: string) {
    return {
      active: this.uploadProgress.getActiveUploads(userId),
      all: this.uploadProgress.getUserUploads(userId),
    };
  }

  /**
   * Get supported file types
   */
  getSupportedTypes() {
    return {
      // Image types
      imageTypes: ALLOWED_IMAGE_TYPES,
      animatedImageTypes: ANIMATED_MIME_TYPES,
      maxImageSizeMB: this.maxFileSizeMB,

      // Video types
      videoTypes: ALLOWED_VIDEO_TYPES,
      maxVideoSizeMB: this.maxVideoSizeMB,
      maxVideoDurationSeconds: this.maxVideoDurationSeconds,
      videoProcessingAvailable: this.videoProcessor.isAvailable(),

      // Combined
      allTypes: ALLOWED_MIME_TYPES,
      maxFiles: this.maxFiles,

      // Limits by purpose
      limits: {
        avatar: {
          image: { maxSizeMB: this.maxFileSizeMB, maxWidth: 400, maxHeight: 400 },
          video: { maxSizeMB: this.maxVideoSizeMB, maxDuration: 10, maxWidth: 400, maxHeight: 400 },
        },
        banner: {
          image: { maxSizeMB: this.maxFileSizeMB, maxWidth: 1400, maxHeight: 400 },
          video: { maxSizeMB: this.maxVideoSizeMB, maxDuration: 30, maxWidth: 1400, maxHeight: 400 },
        },
        background: {
          image: { maxSizeMB: 10, maxWidth: 1920, maxHeight: 1080 },
          video: { maxSizeMB: 100, maxDuration: 60, maxWidth: 1920, maxHeight: 1080 },
        },
      },
    };
  }
}

export default UploadService;
