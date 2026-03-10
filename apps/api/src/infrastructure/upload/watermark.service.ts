import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface WatermarkOptions {
  /** نوع العلامة المائية */
  type: 'text' | 'image';
  /** النص (لنوع text) */
  text?: string;
  /** مسار صورة العلامة (لنوع image) */
  imagePath?: string;
  /** موقع العلامة */
  position:
    | 'center'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
  /** الشفافية (0-1) */
  opacity?: number;
  /** حجم الخط (لنوع text) */
  fontSize?: number;
  /** لون الخط (لنوع text) */
  fontColor?: string;
  /** نسبة حجم العلامة من الصورة */
  scale?: number;
}

/**
 * 🎨 Watermark Service
 *
 * إضافة علامات مائية للصور
 */
@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);
  private watermarkCache: Map<string, Buffer> = new Map();
  
  // 🔒 Prevent memory leak - max 50 watermarks cached
  private readonly MAX_CACHE_SIZE = 50;

  /**
   * 🧹 Evict oldest cache entries when limit reached
   */
  private evictOldestIfNeeded(): void {
    if (this.watermarkCache.size >= this.MAX_CACHE_SIZE) {
      // Delete first 10 entries (oldest) to make room
      const keysToDelete = Array.from(this.watermarkCache.keys()).slice(0, 10);
      for (const key of keysToDelete) {
        this.watermarkCache.delete(key);
      }
      this.logger.debug(`Evicted ${keysToDelete.length} watermark cache entries`);
    }
  }

  /**
   * إضافة علامة مائية للصورة
   */
  async addWatermark(
    imageBuffer: Buffer,
    options: WatermarkOptions,
  ): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to get image dimensions');
      }

      let watermarkBuffer: Buffer;

      if (options.type === 'text') {
        watermarkBuffer = await this.createTextWatermark(
          options.text || 'Rukny',
          metadata.width,
          metadata.height,
          options,
        );
      } else {
        watermarkBuffer = await this.createImageWatermark(
          options.imagePath!,
          metadata.width,
          metadata.height,
          options,
        );
      }

      // حساب موقع العلامة
      const { left, top } = this.calculatePosition(
        metadata.width,
        metadata.height,
        watermarkBuffer,
        options.position,
      );

      // دمج العلامة مع الصورة
      const result = await image
        .composite([
          {
            input: watermarkBuffer,
            left,
            top,
            blend: 'over',
          },
        ])
        .toBuffer();

      this.logger.debug(`Added watermark at ${options.position}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to add watermark: ${error.message}`);
      throw error;
    }
  }

  /**
   * إنشاء علامة مائية نصية
   */
  private async createTextWatermark(
    text: string,
    imageWidth: number,
    imageHeight: number,
    options: WatermarkOptions,
  ): Promise<Buffer> {
    const scale = options.scale || 0.15;
    const fontSize = options.fontSize || Math.floor(imageHeight * scale);
    const color = options.fontColor || 'rgba(255, 255, 255, 0.5)';
    const opacity = options.opacity || 0.5;

    // حساب عرض النص التقريبي
    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize * 1.2;

    const svgText = `
      <svg width="${textWidth}" height="${textHeight}">
        <style>
          .watermark {
            fill: ${color};
            font-size: ${fontSize}px;
            font-family: Arial, sans-serif;
            font-weight: bold;
            opacity: ${opacity};
          }
        </style>
        <text x="0" y="${fontSize}" class="watermark">${text}</text>
      </svg>
    `;

    return sharp(Buffer.from(svgText)).png().toBuffer();
  }

  /**
   * إنشاء علامة مائية من صورة
   */
  private async createImageWatermark(
    imagePath: string,
    imageWidth: number,
    imageHeight: number,
    options: WatermarkOptions,
  ): Promise<Buffer> {
    // التحقق من الكاش
    const cacheKey = `${imagePath}_${imageWidth}_${options.scale || 0.15}`;
    if (this.watermarkCache.has(cacheKey)) {
      return this.watermarkCache.get(cacheKey)!;
    }

    const scale = options.scale || 0.15;
    const watermarkWidth = Math.floor(imageWidth * scale);
    const opacity = options.opacity || 0.5;

    let watermarkBuffer = await fs.readFile(imagePath);

    // تحجيم العلامة
    watermarkBuffer = Buffer.from(await sharp(watermarkBuffer)
      .resize(watermarkWidth)
      .ensureAlpha()
      .modulate({ lightness: 1 })
      .toBuffer());

    // تطبيق الشفافية
    if (opacity < 1) {
      const { width, height } = await sharp(watermarkBuffer).metadata();
      watermarkBuffer = Buffer.from(await sharp(watermarkBuffer)
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
                <rect width="100%" height="100%" fill="rgba(0,0,0,${1 - opacity})"/>
              </svg>`,
            ),
            blend: 'dest-in',
          },
        ])
        .toBuffer());
    }

    // حفظ في الكاش مع حماية من memory leak
    this.evictOldestIfNeeded();
    this.watermarkCache.set(cacheKey, watermarkBuffer);

    return watermarkBuffer;
  }

  /**
   * حساب موقع العلامة المائية
   */
  private calculatePosition(
    imageWidth: number,
    imageHeight: number,
    watermarkBuffer: Buffer,
    position: string,
  ): { left: number; top: number } {
    // سنستخدم تقدير لحجم العلامة المائية
    const watermarkWidth = Math.floor(imageWidth * 0.15);
    const watermarkHeight = Math.floor(imageHeight * 0.15);
    const padding = 20;

    switch (position) {
      case 'top-left':
        return { left: padding, top: padding };
      case 'top-right':
        return { left: imageWidth - watermarkWidth - padding, top: padding };
      case 'bottom-left':
        return { left: padding, top: imageHeight - watermarkHeight - padding };
      case 'bottom-right':
        return {
          left: imageWidth - watermarkWidth - padding,
          top: imageHeight - watermarkHeight - padding,
        };
      case 'center':
      default:
        return {
          left: Math.floor((imageWidth - watermarkWidth) / 2),
          top: Math.floor((imageHeight - watermarkHeight) / 2),
        };
    }
  }

  /**
   * إضافة علامة مائية قطرية (مكررة)
   */
  async addTiledWatermark(
    imageBuffer: Buffer,
    text: string,
    options?: {
      opacity?: number;
      fontSize?: number;
      angle?: number;
      spacing?: number;
    },
  ): Promise<Buffer> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to get image dimensions');
    }

    const opacity = options?.opacity || 0.15;
    const fontSize = options?.fontSize || 24;
    const angle = options?.angle || -30;
    const spacing = options?.spacing || 150;

    // إنشاء نمط متكرر
    const patternWidth = spacing * 2;
    const patternHeight = spacing;

    const svgPattern = `
      <svg width="${metadata.width}" height="${metadata.height}">
        <defs>
          <pattern id="watermark" x="0" y="0" width="${patternWidth}" height="${patternHeight}" patternUnits="userSpaceOnUse">
            <text 
              x="${patternWidth / 2}" 
              y="${patternHeight / 2}" 
              font-size="${fontSize}" 
              fill="rgba(128, 128, 128, ${opacity})"
              font-family="Arial, sans-serif"
              text-anchor="middle"
              dominant-baseline="middle"
              transform="rotate(${angle}, ${patternWidth / 2}, ${patternHeight / 2})"
            >${text}</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark)"/>
      </svg>
    `;

    const patternBuffer = await sharp(Buffer.from(svgPattern)).png().toBuffer();

    return image
      .composite([
        {
          input: patternBuffer,
          blend: 'over',
        },
      ])
      .toBuffer();
  }

  /**
   * إزالة علامة مائية (تقريبي - للصور البسيطة)
   */
  async removeWatermark(
    imageBuffer: Buffer,
    region: { left: number; top: number; width: number; height: number },
  ): Promise<Buffer> {
    // استخدام inpainting بسيط
    // هذا ليس حلاً مثالياً لكنه يعطي نتيجة مقبولة
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // ملء المنطقة بلون متوسط من حولها
    const blurredRegion = await sharp(imageBuffer)
      .extract(region)
      .blur(50)
      .toBuffer();

    return image
      .composite([
        {
          input: blurredRegion,
          left: region.left,
          top: region.top,
        },
      ])
      .toBuffer();
  }

  /**
   * تنظيف الكاش
   */
  clearCache(): void {
    this.watermarkCache.clear();
    this.logger.log('Watermark cache cleared');
  }
}
