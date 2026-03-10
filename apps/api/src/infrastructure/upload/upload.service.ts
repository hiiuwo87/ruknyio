import { Injectable, BadRequestException } from '@nestjs/common';
import { FileCategory } from '@prisma/client';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { Readable } from 'stream';
import { S3Service } from '../../services/s3.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';

@Injectable()
export class UploadService {
  private uploadPath = join(process.cwd(), 'uploads', 'avatars');
  private eventImagesPath = join(process.cwd(), 'uploads', 'events');
  private thumbnailsPath = join(process.cwd(), 'uploads', 'thumbnails');
  private coversPath = join(process.cwd(), 'uploads', 'covers');
  private bannersPath = join(process.cwd(), 'uploads', 'banners');

  // Security constraints
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_EVENT_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for events
  private readonly MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2MB for thumbnails
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly MAX_WIDTH = 2000;
  private readonly MAX_HEIGHT = 2000;
  private readonly AVATAR_SIZE = 400; // Final avatar size
  private readonly EVENT_IMAGE_WIDTH = 1200; // Event image width
  private readonly THUMBNAIL_WIDTH = 800; // Thumbnail width for featured links
  private readonly COVER_WIDTH = 1400; // Cover image width
  private readonly COVER_HEIGHT = 400; // Cover image height
  private readonly BANNER_WIDTH = 1400;
  private readonly BANNER_HEIGHT = 400;

  private async normalizeToBuffer(input: any): Promise<Buffer> {
    if (!input) return Buffer.alloc(0);
    // Direct Buffer
    if (Buffer.isBuffer(input)) return input;
    // ArrayBuffer
    if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
    // TypedArray / DataView
    if (ArrayBuffer.isView(input)) return Buffer.from(input as Uint8Array);
    // Array-like object with numeric keys and a length property (e.g. {0:..,1:.., length: N})
    if (
      input &&
      typeof input === 'object' &&
      typeof input.length === 'number'
    ) {
      const len = Number(input.length) || 0;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        const v = input[i];
        arr[i] =
          typeof v === 'number'
            ? v
            : typeof v === 'string'
              ? parseInt(v, 10) || 0
              : 0;
      }
      return Buffer.from(arr);
    }
    // Objects with numeric keys but no length property (e.g. { '0':.., '1':.., '2':.. })
    if (input && typeof input === 'object') {
      const keys = Object.keys(input || {});
      const numericKeys = keys.filter((k) => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        // find max index
        const maxIndex = numericKeys.reduce(
          (max, k) => Math.max(max, Number(k)),
          0,
        );
        const arr = new Uint8Array(maxIndex + 1);
        for (const k of numericKeys) {
          const idx = Number(k);
          const v = input[k];
          arr[idx] =
            typeof v === 'number'
              ? v
              : typeof v === 'string'
                ? parseInt(v, 10) || 0
                : 0;
        }
        return Buffer.from(arr);
      }
    }
    // Multer-like { type: 'Buffer', data: [...] }
    if (input && input.type === 'Buffer' && Array.isArray(input.data))
      return Buffer.from(input.data);
    // Multer-like { buffer: <Buffer> } or nested data
    if (input && input.buffer) return this.normalizeToBuffer(input.buffer);
    // Readable stream
    if (input instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    // Node fetch / Blob-like: has arrayBuffer()
    if (typeof input.arrayBuffer === 'function') {
      const ab = await input.arrayBuffer();
      return Buffer.from(new Uint8Array(ab));
    }
    // String: data URL or base64
    if (typeof input === 'string') {
      const m = input.match(/^data:.*;base64,(.*)$/);
      const b64 = m ? m[1] : input;
      try {
        return Buffer.from(b64, 'base64');
      } catch (err) {
        // fallthrough to error below
      }
    }

    // Unknown shape — include keys to help debugging
    const keys =
      input && typeof input === 'object'
        ? Object.keys(input).join(',')
        : typeof input;
    throw new BadRequestException(`Invalid file buffer (shape: ${keys})`);
  }

  constructor(
    private readonly s3Service?: S3Service,
    private readonly prisma?: PrismaService,
  ) {}

  private getS3Bucket() {
    return process.env.S3_BUCKET || '';
  }

  async uploadAvatar(file: any): Promise<string> {
    const buf = await this.normalizeToBuffer(file?.buffer ?? file);

    // 1. Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // 2. Validate actual file type using file-type (checks magic bytes)
    const fileType = await fileTypeFromBuffer(buf);
    if (!fileType || !this.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed',
      );
    }

    // 3. Validate image dimensions
    const metadata = await sharp(buf).metadata();
    if (metadata.width > this.MAX_WIDTH || metadata.height > this.MAX_HEIGHT) {
      throw new BadRequestException(
        `Image dimensions exceed ${this.MAX_WIDTH}x${this.MAX_HEIGHT}px`,
      );
    }

    // 4. Process image with sharp (rotate() removes EXIF metadata)
    const processedImage = await sharp(buf)
      .rotate() // 🔒 Remove EXIF metadata for privacy
      .resize(this.AVATAR_SIZE, this.AVATAR_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 90 }) // Convert to WebP for better compression
      .toBuffer();

    // 5. Create directory if it doesn't exist
    if (!existsSync(this.uploadPath)) {
      await mkdir(this.uploadPath, { recursive: true });
    }

    // 6. Generate secure filename using UUID
    const fileName = `${uuidv4()}.webp`;
    const filePath = join(this.uploadPath, fileName);

    // 7. Save processed file
    await writeFile(filePath, processedImage);

    // 8. Return file URL
    return `/uploads/avatars/${fileName}`;
  }

  async uploadCover(file: any): Promise<string> {
    const buf = await this.normalizeToBuffer(file?.buffer ?? file);

    // 1. Validate file size (10MB for covers)
    if (file.size > this.MAX_EVENT_IMAGE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // 2. Validate actual file type using file-type (checks magic bytes)
    const fileType = await fileTypeFromBuffer(buf);
    if (!fileType || !this.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed',
      );
    }

    // 3. Validate image dimensions
    const metadata = await sharp(buf).metadata();
    if (metadata.width > 4000 || metadata.height > 4000) {
      throw new BadRequestException('Image dimensions exceed 4000x4000px');
    }

    // 4. Process image with sharp - resize to cover dimensions (rotate() removes EXIF)
    const processedImage = await sharp(buf)
      .rotate() // 🔒 Remove EXIF metadata for privacy
      .resize(this.COVER_WIDTH, this.COVER_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 }) // Convert to WebP for better compression
      .toBuffer();

    // 5. Create directory if it doesn't exist
    if (!existsSync(this.coversPath)) {
      await mkdir(this.coversPath, { recursive: true });
    }

    // 6. Generate secure filename using UUID
    const fileName = `${uuidv4()}.webp`;
    const filePath = join(this.coversPath, fileName);

    // 7. Save processed file
    await writeFile(filePath, processedImage);

    // 8. Return file URL
    return `/uploads/covers/${fileName}`;
  }

  async deleteCover(coverUrl: string): Promise<void> {
    if (!coverUrl) return;

    try {
      // Extract filename from URL
      const fileName = coverUrl.split('/').pop();
      if (!fileName) return;

      // Validate filename format (UUID + .webp)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$/i;
      if (!uuidRegex.test(fileName)) {
        return; // Invalid filename, skip deletion
      }

      const filePath = join(this.coversPath, fileName);

      // Delete file if exists
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // Log error but don't throw - deletion is not critical
    }
  }

  async deleteAvatar(avatarUrl: string): Promise<void> {
    if (!avatarUrl) return;

    try {
      // Extract filename from URL
      const fileName = avatarUrl.split('/').pop();
      if (!fileName) return;

      // Validate filename format (UUID + .webp)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;
      if (!uuidRegex.test(fileName)) {
        throw new BadRequestException('Invalid avatar filename');
      }

      const filePath = join(this.uploadPath, fileName);

      // Delete file if exists
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // Log error but don't throw - deletion is not critical
      // Error is handled by global exception filter
    }
  }

  async uploadEventImage(file: any): Promise<string> {
    const buf = await this.normalizeToBuffer(file?.buffer ?? file);

    // 1. Validate file size
    if (file.size > this.MAX_EVENT_IMAGE_SIZE) {
      throw new BadRequestException(
        `File size exceeds ${this.MAX_EVENT_IMAGE_SIZE / (1024 * 1024)}MB limit`,
      );
    }

    // 2. Validate actual file type using file-type (checks magic bytes)
    const fileType = await fileTypeFromBuffer(buf);
    if (!fileType || !this.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed',
      );
    }

    // 3. Process image with sharp - resize and optimize (rotate() removes EXIF)
    const processedImage = await sharp(buf)
      .rotate() // 🔒 Remove EXIF metadata for privacy
      .resize(this.EVENT_IMAGE_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85, effort: 6 }) // Convert to WebP with good compression
      .toBuffer();

    // 4. Create directory if it doesn't exist
    if (!existsSync(this.eventImagesPath)) {
      await mkdir(this.eventImagesPath, { recursive: true });
    }

    // 5. Generate secure filename using UUID
    const fileName = `${uuidv4()}.webp`;
    const filePath = join(this.eventImagesPath, fileName);

    // 6. Save processed file
    await writeFile(filePath, processedImage);

    // 7. Return file URL (relative path that will be converted to absolute on frontend)
    return `/uploads/events/${fileName}`;
  }

  async deleteEventImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return;

    try {
      // Extract filename from URL
      const fileName = imageUrl.split('/').pop();
      if (!fileName) return;

      // Validate filename format (UUID + .webp)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;
      if (!uuidRegex.test(fileName)) {
        throw new BadRequestException('Invalid event image filename');
      }

      const filePath = join(this.eventImagesPath, fileName);

      // Delete file if exists
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // Log error but don't throw - deletion is not critical
      // Error is handled by global exception filter
    }
  }

  async uploadThumbnail(file: any): Promise<string> {
    const buf = await this.normalizeToBuffer(file?.buffer ?? file);

    // 1. Validate file size
    if (file.size > this.MAX_THUMBNAIL_SIZE) {
      throw new BadRequestException(
        `File size exceeds ${this.MAX_THUMBNAIL_SIZE / (1024 * 1024)}MB limit`,
      );
    }

    // 2. Validate actual file type using file-type (checks magic bytes)
    const fileType = await fileTypeFromBuffer(buf);
    if (!fileType || !this.ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed',
      );
    }

    // 3. Process image with sharp - resize and optimize for thumbnails (rotate() removes EXIF)
    const processedImage = await sharp(buf)
      .rotate() // 🔒 Remove EXIF metadata for privacy
      .resize(this.THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80, effort: 6 }) // Convert to WebP with good compression
      .toBuffer();

    // 4. Create directory if it doesn't exist
    if (!existsSync(this.thumbnailsPath)) {
      await mkdir(this.thumbnailsPath, { recursive: true });
    }

    // 5. Generate secure filename using UUID
    const fileName = `${uuidv4()}.webp`;
    const filePath = join(this.thumbnailsPath, fileName);

    // 6. Save processed file
    await writeFile(filePath, processedImage);

    // 7. Return file URL
    return `/uploads/thumbnails/${fileName}`;
  }

  async uploadBanners(files: any[], userId: string): Promise<string[]> {
    if (!files || files.length === 0)
      throw new BadRequestException('No files provided');
    const maxFiles = Number(process.env.S3_UPLOAD_MAX_FILES || 3);
    if (files.length > maxFiles)
      throw new BadRequestException(`Max ${maxFiles} files allowed`);

    const results: string[] = [];
    const bucket = this.getS3Bucket();

    for (const file of files) {
      const buf = await this.normalizeToBuffer(file?.buffer ?? file);

      if (file.size > this.MAX_FILE_SIZE)
        throw new BadRequestException('File too large');
      const fileType = await fileTypeFromBuffer(buf);
      if (!fileType || !this.ALLOWED_MIME_TYPES.includes(fileType.mime))
        throw new BadRequestException('Invalid file type');

      // process image similar to cover (rotate() removes EXIF)
      const processed = await sharp(buf)
        .rotate() // 🔒 Remove EXIF metadata for privacy
        .resize(this.BANNER_WIDTH, this.BANNER_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toBuffer();

      const fileName = `${uuidv4()}.webp`;
      const relativePath = `banners/${fileName}`;

      if (bucket && this.s3Service) {
        // upload to S3 using key = users/{userId}/banners/{fileName}
        const key = `users/${userId}/banners/${fileName}`;
        await this.s3Service.uploadBuffer(bucket, key, processed, 'image/webp');

        // Track file in database for storage management
        await this.prisma.userFile.create({
          data: {
            userId,
            key,
            fileName: file.originalname || fileName,
            fileType: 'image/webp',
            fileSize: BigInt(processed.length),
            category: FileCategory.BANNER,
          },
        });

        // Update storage usage
        await this.prisma.profile.update({
          where: { userId },
          data: {
            storageUsed: { increment: BigInt(processed.length) },
          },
        });

        const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        results.push(url);
      } else {
        // save locally
        if (!existsSync(this.bannersPath))
          await mkdir(this.bannersPath, { recursive: true });
        const filePath = join(this.bannersPath, fileName);
        await writeFile(filePath, processed);
        results.push(`/uploads/banners/${fileName}`);
      }
    }

    return results;
  }

  async deleteBanners(keysOrUrls: string[]): Promise<void> {
    if (!keysOrUrls || keysOrUrls.length === 0) return;
    const bucket = this.getS3Bucket();
    for (const item of keysOrUrls) {
      // If item is a full S3 URL: https://{bucket}.s3.{region}.amazonaws.com/{key}
      if (bucket && item.includes(`${bucket}.s3`)) {
        // extract key after bucket host
        const parts = item.split(`/${bucket}/`);
        let key = '';
        if (parts.length > 1) key = parts[1];
        else {
          // fallback: remove host portion
          const idx = item.indexOf('.amazonaws.com/');
          if (idx !== -1) key = item.substring(idx + '.amazonaws.com/'.length);
        }
        if (key) await this.s3Service?.deleteObject(bucket, key);
        continue;
      }

      // If item looks like /uploads/banners/filename
      if (item.startsWith('/uploads/')) {
        const fileName = item.split('/').pop();
        if (!fileName) continue;
        const filePath = join(this.bannersPath, fileName);
        if (existsSync(filePath)) await unlink(filePath);
        continue;
      }

      // If item is a key like banners/{userId}/{fileName}
      if (bucket && item.startsWith('banners/')) {
        await this.s3Service?.deleteObject(bucket, item);
      }
    }
  }

  async deleteThumbnail(thumbnailUrl: string): Promise<void> {
    if (!thumbnailUrl) return;

    try {
      // Extract filename from URL
      const fileName = thumbnailUrl.split('/').pop();
      if (!fileName) return;

      // Validate filename format (UUID + .webp)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;
      if (!uuidRegex.test(fileName)) {
        throw new BadRequestException('Invalid thumbnail filename');
      }

      const filePath = join(this.thumbnailsPath, fileName);

      // Delete file if exists
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // Log error but don't throw - deletion is not critical
    }
  }
}
