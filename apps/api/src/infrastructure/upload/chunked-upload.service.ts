import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { S3Service } from '../../services/s3.service';
import { RedisService } from '../../core/cache/redis.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';

/**
 * 📤 Chunked Upload Service
 *
 * رفع الملفات الكبيرة على مراحل (Resumable Upload):
 * - تقسيم الملف إلى أجزاء صغيرة
 * - إمكانية استئناف الرفع عند الانقطاع
 * - دعم الرفع المتوازي
 */
@Injectable()
export class ChunkedUploadService {
  private readonly logger = new Logger(ChunkedUploadService.name);

  // إعدادات
  private readonly CONFIG = {
    CHUNK_SIZE: 5 * 1024 * 1024, // 5MB per chunk
    MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB max
    UPLOAD_EXPIRY: 24 * 60 * 60, // 24 hours
    MAX_CONCURRENT_CHUNKS: 5,
  };

  constructor(
    private readonly s3Service: S3Service,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * بدء رفع ملف جديد
   */
  async initiateUpload(
    userId: string,
    fileInfo: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      category: string;
    },
  ): Promise<{
    uploadId: string;
    chunkSize: number;
    totalChunks: number;
    expiresAt: Date;
  }> {
    // التحقق من حجم الملف
    if (fileInfo.fileSize > this.CONFIG.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum of ${this.CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    const uploadId = randomUUID();
    const totalChunks = Math.ceil(fileInfo.fileSize / this.CONFIG.CHUNK_SIZE);
    const expiresAt = new Date(Date.now() + this.CONFIG.UPLOAD_EXPIRY * 1000);

    // إنشاء S3 multipart upload
    const bucket = process.env.S3_BUCKET || '';
    const key = `uploads/${userId}/${uploadId}/${fileInfo.fileName}`;
    const s3UploadId = await this.s3Service.createMultipartUpload(
      bucket,
      key,
      fileInfo.mimeType,
    );

    // حفظ معلومات الرفع في Redis
    const uploadData = {
      uploadId,
      s3UploadId,
      userId,
      bucket,
      key,
      fileName: fileInfo.fileName,
      fileSize: fileInfo.fileSize,
      mimeType: fileInfo.mimeType,
      category: fileInfo.category,
      totalChunks,
      uploadedChunks: [],
      parts: [],
      status: 'in_progress',
      createdAt: Date.now(),
      expiresAt: expiresAt.getTime(),
    };

    await this.redis.setex(
      `chunked:${uploadId}`,
      this.CONFIG.UPLOAD_EXPIRY,
      JSON.stringify(uploadData),
    );

    this.logger.log(
      `Initiated chunked upload ${uploadId} for ${fileInfo.fileName} (${totalChunks} chunks)`,
    );

    return {
      uploadId,
      chunkSize: this.CONFIG.CHUNK_SIZE,
      totalChunks,
      expiresAt,
    };
  }

  /**
   * رفع جزء من الملف
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: Buffer,
    userId: string,
  ): Promise<{
    uploaded: boolean;
    progress: number;
    etag: string;
  }> {
    // جلب معلومات الرفع
    const uploadInfo = await this.getUploadInfo(uploadId);

    if (!uploadInfo) {
      throw new NotFoundException('Upload not found or expired');
    }

    if (uploadInfo.userId !== userId) {
      throw new BadRequestException('Unauthorized access to upload');
    }

    if (uploadInfo.status !== 'in_progress') {
      throw new BadRequestException('Upload is not in progress');
    }

    // التحقق من رقم الجزء
    if (chunkIndex < 0 || chunkIndex >= uploadInfo.totalChunks) {
      throw new BadRequestException('Invalid chunk index');
    }

    // التحقق من أن الجزء لم يُرفع مسبقاً
    if (uploadInfo.uploadedChunks.includes(chunkIndex)) {
      const existingPart = uploadInfo.parts.find(
        (p: any) => p.PartNumber === chunkIndex + 1,
      );
      return {
        uploaded: true,
        progress: this.calculateProgress(uploadInfo),
        etag: existingPart?.ETag || '',
      };
    }

    // رفع الجزء إلى S3
    const partNumber = chunkIndex + 1; // S3 parts are 1-indexed
    const etag = await this.s3Service.uploadPart(
      uploadInfo.bucket,
      uploadInfo.key,
      uploadInfo.s3UploadId,
      partNumber,
      chunkData,
    );

    // تحديث معلومات الرفع
    uploadInfo.uploadedChunks.push(chunkIndex);
    uploadInfo.parts.push({ PartNumber: partNumber, ETag: etag });

    await this.redis.setex(
      `chunked:${uploadId}`,
      this.CONFIG.UPLOAD_EXPIRY,
      JSON.stringify(uploadInfo),
    );

    const progress = this.calculateProgress(uploadInfo);

    this.logger.debug(
      `Chunk ${chunkIndex + 1}/${uploadInfo.totalChunks} uploaded (${progress}%)`,
    );

    return {
      uploaded: true,
      progress,
      etag,
    };
  }

  /**
   * إكمال الرفع
   */
  async completeUpload(
    uploadId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    key: string;
    fileSize: number;
  }> {
    const uploadInfo = await this.getUploadInfo(uploadId);

    if (!uploadInfo) {
      throw new NotFoundException('Upload not found or expired');
    }

    if (uploadInfo.userId !== userId) {
      throw new BadRequestException('Unauthorized access to upload');
    }

    // التحقق من اكتمال جميع الأجزاء
    if (uploadInfo.uploadedChunks.length !== uploadInfo.totalChunks) {
      throw new BadRequestException(
        `Upload incomplete: ${uploadInfo.uploadedChunks.length}/${uploadInfo.totalChunks} chunks uploaded`,
      );
    }

    // ترتيب الأجزاء
    const sortedParts = uploadInfo.parts.sort(
      (a: any, b: any) => a.PartNumber - b.PartNumber,
    );

    // إكمال الرفع في S3
    await this.s3Service.completeMultipartUpload(
      uploadInfo.bucket,
      uploadInfo.key,
      uploadInfo.s3UploadId,
      sortedParts,
    );

    // تحديث الحالة
    uploadInfo.status = 'completed';
    await this.redis.setex(
      `chunked:${uploadId}`,
      3600, // حفظ لمدة ساعة بعد الإكمال
      JSON.stringify(uploadInfo),
    );

    // تسجيل الملف في قاعدة البيانات
    await this.prisma.userFile.create({
      data: {
        userId,
        key: uploadInfo.key,
        fileName: uploadInfo.fileName,
        fileType: uploadInfo.mimeType,
        fileSize: BigInt(uploadInfo.fileSize),
        category: uploadInfo.category,
      },
    });

    this.logger.log(`Chunked upload ${uploadId} completed successfully`);

    return {
      success: true,
      key: uploadInfo.key,
      fileSize: uploadInfo.fileSize,
    };
  }

  /**
   * إلغاء الرفع
   */
  async cancelUpload(uploadId: string, userId: string): Promise<void> {
    const uploadInfo = await this.getUploadInfo(uploadId);

    if (!uploadInfo) {
      throw new NotFoundException('Upload not found');
    }

    if (uploadInfo.userId !== userId) {
      throw new BadRequestException('Unauthorized access to upload');
    }

    // إلغاء الرفع في S3
    if (uploadInfo.status === 'in_progress') {
      await this.s3Service.abortMultipartUpload(
        uploadInfo.bucket,
        uploadInfo.key,
        uploadInfo.s3UploadId,
      );
    }

    // حذف من Redis
    await this.redis.del(`chunked:${uploadId}`);

    this.logger.log(`Chunked upload ${uploadId} cancelled`);
  }

  /**
   * الحصول على حالة الرفع
   */
  async getUploadStatus(
    uploadId: string,
    userId: string,
  ): Promise<{
    uploadId: string;
    status: string;
    progress: number;
    uploadedChunks: number[];
    totalChunks: number;
    expiresAt: Date;
  }> {
    const uploadInfo = await this.getUploadInfo(uploadId);

    if (!uploadInfo) {
      throw new NotFoundException('Upload not found or expired');
    }

    if (uploadInfo.userId !== userId) {
      throw new BadRequestException('Unauthorized access to upload');
    }

    return {
      uploadId,
      status: uploadInfo.status,
      progress: this.calculateProgress(uploadInfo),
      uploadedChunks: uploadInfo.uploadedChunks,
      totalChunks: uploadInfo.totalChunks,
      expiresAt: new Date(uploadInfo.expiresAt),
    };
  }

  /**
   * الحصول على معلومات الرفع من Redis
   */
  private async getUploadInfo(uploadId: string): Promise<any> {
    const data = await this.redis.get(`chunked:${uploadId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * حساب نسبة الإنجاز
   */
  private calculateProgress(uploadInfo: any): number {
    return Math.round(
      (uploadInfo.uploadedChunks.length / uploadInfo.totalChunks) * 100,
    );
  }

  /**
   * تنظيف الرفعات المنتهية
   */
  async cleanupExpiredUploads(): Promise<number> {
    const pattern = 'chunked:*';
    const keys = await this.redis.keys(pattern);
    let cleaned = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;

      const uploadInfo = JSON.parse(data);
      if (
        uploadInfo.expiresAt < Date.now() &&
        uploadInfo.status === 'in_progress'
      ) {
        // إلغاء في S3
        try {
          await this.s3Service.abortMultipartUpload(
            uploadInfo.bucket,
            uploadInfo.key,
            uploadInfo.s3UploadId,
          );
        } catch (error) {
          this.logger.warn(`Failed to abort S3 upload: ${error.message}`);
        }

        await this.redis.del(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired uploads`);
    }

    return cleaned;
  }
}
