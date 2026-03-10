import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface CDNConfig {
  baseUrl: string;
  provider: 'cloudflare' | 'cloudfront' | 'bunny' | 'custom';
  transformations: boolean;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
}

/**
 * 🌐 CDN Service
 *
 * تكامل مع شبكات توصيل المحتوى
 */
@Injectable()
export class CDNService {
  private readonly logger = new Logger(CDNService.name);
  private readonly config: CDNConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      baseUrl: this.configService.get('CDN_BASE_URL', ''),
      provider: this.configService.get('CDN_PROVIDER', 'cloudflare') as any,
      transformations: this.configService.get('CDN_TRANSFORMATIONS', 'true') === 'true',
    };
  }

  /**
   * الحصول على رابط CDN للصورة
   */
  getImageUrl(
    originalUrl: string,
    options?: ImageTransformOptions,
  ): string {
    if (!this.config.baseUrl) {
      return originalUrl;
    }

    // استخراج مسار الملف من الرابط الأصلي
    const urlPath = this.extractPath(originalUrl);

    if (!options || !this.config.transformations) {
      return `${this.config.baseUrl}${urlPath}`;
    }

    // بناء رابط التحويل حسب المزود
    switch (this.config.provider) {
      case 'cloudflare':
        return this.buildCloudflareUrl(urlPath, options);
      case 'cloudfront':
        return this.buildCloudfrontUrl(urlPath, options);
      case 'bunny':
        return this.buildBunnyUrl(urlPath, options);
      default:
        return this.buildGenericUrl(urlPath, options);
    }
  }

  /**
   * بناء رابط Cloudflare Images
   */
  private buildCloudflareUrl(
    path: string,
    options: ImageTransformOptions,
  ): string {
    const transformations: string[] = [];

    if (options.width) transformations.push(`width=${options.width}`);
    if (options.height) transformations.push(`height=${options.height}`);
    if (options.quality) transformations.push(`quality=${options.quality}`);
    if (options.format) transformations.push(`format=${options.format}`);
    if (options.fit) transformations.push(`fit=${options.fit}`);
    if (options.blur) transformations.push(`blur=${options.blur}`);
    if (options.sharpen) transformations.push('sharpen=1');
    if (options.grayscale) transformations.push('grayscale=true');

    const transformStr = transformations.join(',');
    return `${this.config.baseUrl}/cdn-cgi/image/${transformStr}${path}`;
  }

  /**
   * بناء رابط CloudFront مع Lambda@Edge
   */
  private buildCloudfrontUrl(
    path: string,
    options: ImageTransformOptions,
  ): string {
    const params = new URLSearchParams();

    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', options.quality.toString());
    if (options.format) params.append('fm', options.format);
    if (options.fit) params.append('fit', options.fit);

    const queryStr = params.toString();
    return `${this.config.baseUrl}${path}${queryStr ? '?' + queryStr : ''}`;
  }

  /**
   * بناء رابط Bunny CDN
   */
  private buildBunnyUrl(
    path: string,
    options: ImageTransformOptions,
  ): string {
    const transformations: string[] = [];

    if (options.width) transformations.push(`width=${options.width}`);
    if (options.height) transformations.push(`height=${options.height}`);
    if (options.quality) transformations.push(`quality=${options.quality}`);
    if (options.format) transformations.push(`format=${options.format}`);

    const queryStr = transformations.join('&');
    return `${this.config.baseUrl}${path}?${queryStr}`;
  }

  /**
   * بناء رابط عام
   */
  private buildGenericUrl(
    path: string,
    options: ImageTransformOptions,
  ): string {
    const params = new URLSearchParams();

    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', (options.quality || 80).toString());
    if (options.format) params.append('f', options.format);

    return `${this.config.baseUrl}${path}?${params.toString()}`;
  }

  /**
   * الحصول على مجموعة روابط Srcset
   */
  getSrcSet(
    originalUrl: string,
    widths: number[] = [320, 640, 768, 1024, 1280, 1920],
    options?: Omit<ImageTransformOptions, 'width'>,
  ): string {
    return widths
      .map((width) => {
        const url = this.getImageUrl(originalUrl, { ...options, width });
        return `${url} ${width}w`;
      })
      .join(', ');
  }

  /**
   * الحصول على رابط مصغر
   */
  getThumbnailUrl(
    originalUrl: string,
    size: 'small' | 'medium' | 'large' = 'medium',
  ): string {
    const sizes = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 },
    };

    return this.getImageUrl(originalUrl, {
      ...sizes[size],
      fit: 'cover',
      quality: 80,
      format: 'auto',
    });
  }

  /**
   * الحصول على رابط BlurHash placeholder
   */
  getBlurPlaceholder(originalUrl: string): string {
    return this.getImageUrl(originalUrl, {
      width: 20,
      quality: 20,
      blur: 10,
      format: 'jpg',
    });
  }

  /**
   * إبطال كاش CDN
   */
  async invalidateCache(paths: string[]): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'cloudflare':
          return await this.invalidateCloudflare(paths);
        case 'cloudfront':
          return await this.invalidateCloudfront(paths);
        case 'bunny':
          return await this.invalidateBunny(paths);
        default:
          this.logger.warn('Cache invalidation not supported for this provider');
          return false;
      }
    } catch (error) {
      this.logger.error(`Cache invalidation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * إبطال كاش Cloudflare
   */
  private async invalidateCloudflare(paths: string[]): Promise<boolean> {
    const zoneId = this.configService.get('CLOUDFLARE_ZONE_ID');
    const apiToken = this.configService.get('CLOUDFLARE_API_TOKEN');

    if (!zoneId || !apiToken) {
      this.logger.warn('Cloudflare credentials not configured');
      return false;
    }

    const files = paths.map((p) => `${this.config.baseUrl}${p}`);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      },
    );

    const result = await response.json();
    return result.success === true;
  }

  /**
   * إبطال كاش CloudFront
   */
  private async invalidateCloudfront(paths: string[]): Promise<boolean> {
    // يتطلب AWS SDK
    this.logger.warn('CloudFront invalidation requires AWS SDK implementation');
    return false;
  }

  /**
   * إبطال كاش Bunny
   */
  private async invalidateBunny(paths: string[]): Promise<boolean> {
    const apiKey = this.configService.get('BUNNY_API_KEY');
    const pullZoneId = this.configService.get('BUNNY_PULL_ZONE_ID');

    if (!apiKey || !pullZoneId) {
      this.logger.warn('Bunny CDN credentials not configured');
      return false;
    }

    for (const path of paths) {
      const url = `${this.config.baseUrl}${path}`;
      await fetch(
        `https://api.bunny.net/purge?url=${encodeURIComponent(url)}`,
        {
          method: 'POST',
          headers: { AccessKey: apiKey },
        },
      );
    }

    return true;
  }

  /**
   * استخراج المسار من الرابط
   */
  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      // إذا كان مسار وليس رابط كامل
      return url.startsWith('/') ? url : `/${url}`;
    }
  }

  /**
   * توليد توقيع للرابط المحمي
   */
  generateSignedUrl(path: string, expiresIn: number = 3600): string {
    const secret = this.configService.get('CDN_SIGNING_SECRET', '');
    if (!secret) {
      return `${this.config.baseUrl}${path}`;
    }

    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${path}${expires}`)
      .digest('hex');

    return `${this.config.baseUrl}${path}?expires=${expires}&signature=${signature}`;
  }

  /**
   * التحقق من صحة الرابط الموقع
   */
  verifySignedUrl(path: string, expires: number, signature: string): boolean {
    const secret = this.configService.get('CDN_SIGNING_SECRET', '');
    if (!secret) return true;

    if (expires < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${path}${expires}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig),
    );
  }
}
