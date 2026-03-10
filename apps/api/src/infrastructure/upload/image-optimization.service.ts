import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { S3Service } from '../../services/s3.service';
import { RedisService } from '../../core/cache/redis.service';

/**
 * 🖼️ Image Optimization Pipeline
 *
 * تحسين الصور تلقائياً:
 * - إنشاء نسخ متعددة الأحجام (responsive)
 * - تحويل إلى WebP و AVIF
 * - ضغط ذكي
 * - Lazy loading placeholders
 */
@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  // أحجام الصور المستجيبة
  private readonly RESPONSIVE_SIZES = {
    thumbnail: { width: 150, height: 150, fit: 'cover' as const },
    small: { width: 320, height: null, fit: 'inside' as const },
    medium: { width: 640, height: null, fit: 'inside' as const },
    large: { width: 1024, height: null, fit: 'inside' as const },
    xlarge: { width: 1920, height: null, fit: 'inside' as const },
  };

  // إعدادات الجودة
  private readonly QUALITY = {
    webp: { quality: 80, effort: 4 },
    avif: { quality: 65, effort: 4 },
    jpeg: { quality: 80, mozjpeg: true },
    png: { compressionLevel: 9, palette: true },
  };

  constructor(
    private readonly s3Service: S3Service,
    private readonly redis: RedisService,
  ) {}

  /**
   * معالجة صورة وإنشاء نسخ محسّنة
   */
  async processImage(
    buffer: Buffer,
    options: {
      generateSizes?: boolean;
      generateFormats?: ('webp' | 'avif')[];
      quality?: number;
      maxWidth?: number;
      maxHeight?: number;
    } = {},
  ): Promise<{
    original: Buffer;
    variants: {
      size: string;
      format: string;
      buffer: Buffer;
      width: number;
      height: number;
    }[];
    metadata: {
      originalWidth: number;
      originalHeight: number;
      format: string;
      hasAlpha: boolean;
    };
  }> {
    const {
      generateSizes = true,
      generateFormats = ['webp'],
      maxWidth = 2048,
      maxHeight = 2048,
    } = options;

    // الحصول على معلومات الصورة الأصلية
    const metadata = await sharp(buffer).metadata();
    const hasAlpha = metadata.hasAlpha || false;

    // تحسين الصورة الأصلية
    let processedOriginal = sharp(buffer)
      .rotate() // إزالة EXIF وتصحيح الاتجاه
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });

    const original = await processedOriginal.toBuffer();

    const variants: {
      size: string;
      format: string;
      buffer: Buffer;
      width: number;
      height: number;
    }[] = [];

    // إنشاء الأحجام المختلفة
    if (generateSizes) {
      for (const [sizeName, sizeConfig] of Object.entries(
        this.RESPONSIVE_SIZES,
      )) {
        for (const format of generateFormats) {
          try {
            const resized = await this.createVariant(
              buffer,
              sizeConfig,
              format,
            );

            const variantMeta = await sharp(resized).metadata();

            variants.push({
              size: sizeName,
              format,
              buffer: resized,
              width: variantMeta.width || sizeConfig.width,
              height: variantMeta.height || 0,
            });
          } catch (error) {
            this.logger.warn(
              `Failed to create ${sizeName} ${format}: ${error.message}`,
            );
          }
        }
      }
    }

    return {
      original,
      variants,
      metadata: {
        originalWidth: metadata.width || 0,
        originalHeight: metadata.height || 0,
        format: metadata.format || 'unknown',
        hasAlpha,
      },
    };
  }

  /**
   * إنشاء نسخة بحجم وصيغة محددة
   */
  private async createVariant(
    buffer: Buffer,
    size: { width: number; height: number | null; fit: 'cover' | 'inside' },
    format: 'webp' | 'avif' | 'jpeg' | 'png',
  ): Promise<Buffer> {
    let pipeline = sharp(buffer)
      .rotate()
      .resize(size.width, size.height, {
        fit: size.fit,
        withoutEnlargement: true,
      });

    switch (format) {
      case 'webp':
        pipeline = pipeline.webp(this.QUALITY.webp);
        break;
      case 'avif':
        pipeline = pipeline.avif(this.QUALITY.avif);
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg(this.QUALITY.jpeg);
        break;
      case 'png':
        pipeline = pipeline.png(this.QUALITY.png);
        break;
    }

    return pipeline.toBuffer();
  }

  /**
   * إنشاء placeholder للـ lazy loading
   */
  async createPlaceholder(
    buffer: Buffer,
    type: 'blur' | 'lqip' | 'solid' = 'blur',
  ): Promise<string> {
    let placeholder: Buffer;

    switch (type) {
      case 'blur':
        // صورة صغيرة جداً ومضببة
        placeholder = await sharp(buffer)
          .rotate()
          .resize(20, 20, { fit: 'inside' })
          .blur(2)
          .webp({ quality: 20 })
          .toBuffer();
        break;

      case 'lqip':
        // Low Quality Image Placeholder
        placeholder = await sharp(buffer)
          .rotate()
          .resize(40, 40, { fit: 'inside' })
          .webp({ quality: 30 })
          .toBuffer();
        break;

      case 'solid':
        // لون واحد (المتوسط)
        const stats = await sharp(buffer).stats();
        const { r, g, b } = stats.dominant;
        placeholder = Buffer.from(
          `<svg width="1" height="1"><rect fill="rgb(${r},${g},${b})" width="1" height="1"/></svg>`,
        );
        break;
    }

    return `data:image/webp;base64,${placeholder.toString('base64')}`;
  }

  /**
   * رفع صورة محسّنة مع جميع النسخ
   */
  async uploadOptimizedImage(
    buffer: Buffer,
    basePath: string,
    bucket: string,
    options?: {
      generateSizes?: boolean;
      generateFormats?: ('webp' | 'avif')[];
    },
  ): Promise<{
    original: string;
    variants: { [key: string]: string };
    placeholder: string;
    metadata: any;
  }> {
    const { original, variants, metadata } = await this.processImage(
      buffer,
      options,
    );

    // رفع الصورة الأصلية
    const originalKey = `${basePath}/original.webp`;
    await this.s3Service.uploadBuffer(bucket, originalKey, original, 'image/webp');

    // رفع النسخ المختلفة
    const variantUrls: { [key: string]: string } = {};
    for (const variant of variants) {
      const key = `${basePath}/${variant.size}.${variant.format}`;
      const mimeType = variant.format === 'avif' ? 'image/avif' : 'image/webp';
      await this.s3Service.uploadBuffer(bucket, key, variant.buffer, mimeType);
      variantUrls[`${variant.size}_${variant.format}`] = key;
    }

    // إنشاء placeholder
    const placeholder = await this.createPlaceholder(buffer, 'blur');

    return {
      original: originalKey,
      variants: variantUrls,
      placeholder,
      metadata,
    };
  }

  /**
   * تحسين صورة موجودة
   */
  async optimizeExisting(
    s3Key: string,
    bucket: string,
  ): Promise<{ saved: number; newKey: string }> {
    // جلب الصورة
    const originalBuffer = await this.s3Service.getObject(bucket, s3Key);
    const originalSize = originalBuffer.length;

    // تحسين
    const optimized = await sharp(originalBuffer)
      .rotate()
      .webp(this.QUALITY.webp)
      .toBuffer();

    const newSize = optimized.length;
    const saved = originalSize - newSize;

    // رفع النسخة المحسّنة
    const newKey = s3Key.replace(/\.[^.]+$/, '.webp');
    await this.s3Service.uploadBuffer(bucket, newKey, optimized, 'image/webp');

    this.logger.log(
      `Optimized ${s3Key}: ${Math.round(originalSize / 1024)}KB -> ${Math.round(newSize / 1024)}KB (saved ${Math.round((saved / originalSize) * 100)}%)`,
    );

    return { saved, newKey };
  }

  /**
   * الحصول على أفضل صيغة للمتصفح
   */
  getBestFormat(acceptHeader: string): 'avif' | 'webp' | 'jpeg' {
    if (acceptHeader.includes('image/avif')) {
      return 'avif';
    }
    if (acceptHeader.includes('image/webp')) {
      return 'webp';
    }
    return 'jpeg';
  }

  /**
   * الحصول على أفضل حجم للعرض
   */
  getBestSize(
    clientWidth: number,
    dpr: number = 1,
  ): keyof typeof this.RESPONSIVE_SIZES {
    const targetWidth = clientWidth * dpr;

    if (targetWidth <= 150) return 'thumbnail';
    if (targetWidth <= 320) return 'small';
    if (targetWidth <= 640) return 'medium';
    if (targetWidth <= 1024) return 'large';
    return 'xlarge';
  }
}
