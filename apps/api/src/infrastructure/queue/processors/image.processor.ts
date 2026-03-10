import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ImageOptimizationService } from '../../upload/image-optimization.service';
import { S3Service } from '../../../services/s3.service';

/**
 * 🖼️ Image Processor
 *
 * معالج مهام الصور
 */
@Processor('image')
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly imageOptimization: ImageOptimizationService,
    private readonly s3Service: S3Service,
  ) {}

  @Process('optimize')
  async handleOptimize(
    job: Job<{ key: string; bucket: string; userId: string }>,
  ) {
    this.logger.debug(`Processing image optimization for ${job.data.key}`);

    const { key, bucket } = job.data;

    const result = await this.imageOptimization.optimizeExisting(key, bucket);

    this.logger.log(
      `Image optimized: ${key} (saved ${Math.round(result.saved / 1024)}KB)`,
    );

    return result;
  }

  @Process('thumbnails')
  async handleThumbnails(
    job: Job<{ key: string; bucket: string; options: { sizes: number[] } }>,
  ) {
    this.logger.debug(`Generating thumbnails for ${job.data.key}`);

    const { key, bucket, options } = job.data;

    // جلب الصورة الأصلية
    const buffer = await this.s3Service.getObject(bucket, key);

    // إنشاء الصور المصغرة
    const { variants } = await this.imageOptimization.processImage(buffer, {
      generateSizes: true,
      generateFormats: ['webp'],
    });

    this.logger.log(
      `Generated ${variants.length} thumbnails for ${key}`,
    );

    return { thumbnails: variants.length };
  }

  @Process('responsive')
  async handleResponsive(
    job: Job<{ key: string; bucket: string; basePath: string }>,
  ) {
    this.logger.debug(`Generating responsive images for ${job.data.key}`);

    const { key, bucket, basePath } = job.data;

    // جلب الصورة الأصلية
    const buffer = await this.s3Service.getObject(bucket, key);

    // إنشاء جميع الأحجام
    const result = await this.imageOptimization.uploadOptimizedImage(
      buffer,
      basePath,
      bucket,
      {
        generateSizes: true,
        generateFormats: ['webp', 'avif'],
      },
    );

    this.logger.log(`Generated responsive images for ${key}`);

    return result;
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Image job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }
}
