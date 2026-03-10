import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from '../services/s3.service';
import { ImageProcessorService } from '../services/image-processor.service';
import { VideoProcessorService } from '../services/video-processor.service';
import { UploadProgressService } from '../services/upload-progress.service';

/**
 * Shared Module
 *
 * This module provides shared services that are used across the application.
 * It is marked as @Global() so services are available everywhere without importing.
 *
 * Services included:
 * - S3Service: File storage operations with retry logic, validation, and health checks
 * - ImageProcessorService: Image processing with animated GIF/WebP support
 * - VideoProcessorService: Video processing with thumbnail extraction and compression
 * - UploadProgressService: Real-time upload progress tracking
 *
 * @example
 * // In any module, just inject the services
 * constructor(
 *   private readonly s3Service: S3Service,
 *   private readonly imageProcessor: ImageProcessorService,
 *   private readonly videoProcessor: VideoProcessorService,
 *   private readonly uploadProgress: UploadProgressService,
 * ) {}
 *
 * // Process and upload an image
 * const processed = await this.imageProcessor.processBanner(buffer);
 * const result = await this.s3Service.uploadBuffer(bucket, key, processed.buffer, 'image/webp');
 *
 * // Process and upload a video
 * const video = await this.videoProcessor.processAvatar(buffer);
 * await this.s3Service.uploadBuffer(bucket, key, video.buffer, 'video/mp4');
 * // Also upload thumbnail
 * await this.s3Service.uploadBuffer(bucket, thumbKey, video.thumbnail.buffer, 'image/jpeg');
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [S3Service, ImageProcessorService, VideoProcessorService, UploadProgressService],
  exports: [S3Service, ImageProcessorService, VideoProcessorService, UploadProgressService],
})
export class SharedModule {}
