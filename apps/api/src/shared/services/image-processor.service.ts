import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

// ===== Constants =====
const DEFAULT_QUALITY = 85;
const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_MAX_DIMENSION = 4000;

// ===== Interfaces =====
export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  format?: 'webp' | 'jpeg' | 'png' | 'gif' | 'avif';
  preserveAnimation?: boolean;
  stripMetadata?: boolean;
  maxFileSizeMB?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  isAnimated: boolean;
  originalFormat: string;
  compressionRatio: number;
}

export interface ImageValidationResult {
  valid: boolean;
  mimeType?: string;
  extension?: string;
  isAnimated?: boolean;
  width?: number;
  height?: number;
  size?: number;
  error?: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  isAnimated: boolean;
  pages?: number;
  delay?: number[];
  loop?: number;
  size: number;
}

// Supported image types
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

const ANIMATED_FORMATS = ['gif', 'webp', 'png', 'avif'];

/**
 * Image Processing Service
 *
 * Provides comprehensive image processing capabilities including:
 * - Image validation and format detection
 * - Resizing and cropping
 * - Format conversion
 * - Animated image support (GIF, Animated WebP/PNG/AVIF)
 * - Quality optimization
 * - Metadata extraction
 */
@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);
  private readonly maxFileSizeMB: number;
  private readonly maxDimension: number;

  constructor(private readonly configService: ConfigService) {
    this.maxFileSizeMB = this.configService.get<number>(
      'IMAGE_MAX_SIZE_MB',
      DEFAULT_MAX_SIZE_MB,
    );
    this.maxDimension = this.configService.get<number>(
      'IMAGE_MAX_DIMENSION',
      DEFAULT_MAX_DIMENSION,
    );
  }

  /**
   * Validate an image buffer
   */
  async validate(
    buffer: Buffer,
    options?: {
      maxSizeMB?: number;
      maxWidth?: number;
      maxHeight?: number;
      allowAnimated?: boolean;
    },
  ): Promise<ImageValidationResult> {
    const maxSize = (options?.maxSizeMB ?? this.maxFileSizeMB) * 1024 * 1024;
    const maxWidth = options?.maxWidth ?? this.maxDimension;
    const maxHeight = options?.maxHeight ?? this.maxDimension;
    const allowAnimated = options?.allowAnimated ?? true;

    try {
      // Check file size
      if (buffer.length > maxSize) {
        return {
          valid: false,
          error: `File size exceeds ${options?.maxSizeMB ?? this.maxFileSizeMB}MB limit`,
        };
      }

      // Detect file type from magic bytes
      const fileType = await fileTypeFromBuffer(buffer);
      if (!fileType || !SUPPORTED_MIME_TYPES.includes(fileType.mime)) {
        return {
          valid: false,
          error: `Invalid file type. Supported: JPEG, PNG, WebP, GIF, AVIF`,
        };
      }

      // Get image metadata
      const metadata = await this.getMetadata(buffer);

      // Check dimensions
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        return {
          valid: false,
          error: `Image dimensions exceed ${maxWidth}x${maxHeight}px`,
        };
      }

      // Check if animated and allowed
      if (metadata.isAnimated && !allowAnimated) {
        return {
          valid: false,
          error: 'Animated images are not allowed',
        };
      }

      return {
        valid: true,
        mimeType: fileType.mime,
        extension: fileType.ext,
        isAnimated: metadata.isAnimated,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length,
      };
    } catch (err: any) {
      this.logger.error(`Image validation failed: ${err.message}`);
      return {
        valid: false,
        error: 'Failed to process image',
      };
    }
  }

  /**
   * Get detailed image metadata
   */
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(buffer, { animated: true }).metadata();

    const isAnimated =
      (metadata.pages && metadata.pages > 1) ||
      (metadata.delay && metadata.delay.length > 1) ||
      false;

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      hasAlpha: metadata.hasAlpha || false,
      isAnimated,
      pages: metadata.pages,
      delay: metadata.delay,
      loop: metadata.loop,
      size: buffer.length,
    };
  }

  /**
   * Process and optimize an image
   */
  async process(
    buffer: Buffer,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessedImage> {
    const {
      width,
      height,
      quality = DEFAULT_QUALITY,
      fit = 'cover',
      position = 'center',
      format,
      preserveAnimation = true,
      stripMetadata = true,
      maxFileSizeMB = this.maxFileSizeMB,
    } = options;

    // Validate first
    const validation = await this.validate(buffer, {
      maxSizeMB: maxFileSizeMB,
      allowAnimated: preserveAnimation,
    });

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const originalMetadata = await this.getMetadata(buffer);
    const isAnimated = originalMetadata.isAnimated && preserveAnimation;

    // Determine output format
    let outputFormat = format;
    if (!outputFormat) {
      // Keep original format for animated images, convert to webp for static
      if (isAnimated) {
        outputFormat =
          originalMetadata.format === 'gif' ? 'gif' : 'webp';
      } else {
        outputFormat = 'webp';
      }
    }

    // Build sharp pipeline
    let pipeline = sharp(buffer, {
      animated: isAnimated,
      limitInputPixels: false, // Allow large images
    });

    // Resize if dimensions specified
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit,
        position,
        withoutEnlargement: true,
      });
    }

    // Strip metadata if requested
    if (stripMetadata) {
      pipeline = pipeline.withMetadata({
        // Keep only essential metadata
      });
    }

    // Convert to output format with quality settings
    let processedBuffer: Buffer;

    switch (outputFormat) {
      case 'gif':
        // For GIFs, preserve animation
        if (isAnimated) {
          processedBuffer = await pipeline
            .gif({
              effort: 7,
              colours: 256,
            })
            .toBuffer();
        } else {
          // Convert static images to webp instead
          processedBuffer = await pipeline
            .webp({ quality, effort: 6 })
            .toBuffer();
          outputFormat = 'webp';
        }
        break;

      case 'webp':
        processedBuffer = await pipeline
          .webp({
            quality,
            effort: 6,
            ...(isAnimated && { loop: originalMetadata.loop ?? 0 }),
          })
          .toBuffer();
        break;

      case 'avif':
        processedBuffer = await pipeline
          .avif({
            quality,
            effort: 6,
          })
          .toBuffer();
        break;

      case 'png':
        processedBuffer = await pipeline
          .png({
            quality,
            compressionLevel: 9,
          })
          .toBuffer();
        break;

      case 'jpeg':
      default:
        processedBuffer = await pipeline
          .jpeg({
            quality,
            mozjpeg: true,
          })
          .toBuffer();
        break;
    }

    // Get processed metadata
    const processedMetadata = await this.getMetadata(processedBuffer);

    return {
      buffer: processedBuffer,
      format: outputFormat,
      width: processedMetadata.width,
      height: processedMetadata.height,
      size: processedBuffer.length,
      isAnimated: processedMetadata.isAnimated,
      originalFormat: originalMetadata.format,
      compressionRatio: buffer.length / processedBuffer.length,
    };
  }

  /**
   * Process image for avatar (square, fixed size)
   */
  async processAvatar(
    buffer: Buffer,
    size = 400,
  ): Promise<ProcessedImage> {
    return this.process(buffer, {
      width: size,
      height: size,
      fit: 'cover',
      position: 'center',
      quality: 90,
      format: 'webp',
      preserveAnimation: false, // Avatars should be static
    });
  }

  /**
   * Process image for banner/cover (wide aspect ratio)
   */
  async processBanner(
    buffer: Buffer,
    width = 1400,
    height = 400,
  ): Promise<ProcessedImage> {
    return this.process(buffer, {
      width,
      height,
      fit: 'cover',
      position: 'center',
      quality: 85,
      preserveAnimation: true, // Allow animated banners
    });
  }

  /**
   * Process image for thumbnail
   */
  async processThumbnail(
    buffer: Buffer,
    maxWidth = 800,
  ): Promise<ProcessedImage> {
    return this.process(buffer, {
      width: maxWidth,
      fit: 'inside',
      quality: 80,
      preserveAnimation: false,
    });
  }

  /**
   * Process animated image (preserve all frames)
   */
  async processAnimated(
    buffer: Buffer,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
    } = {},
  ): Promise<ProcessedImage> {
    const { maxWidth = 800, maxHeight, quality = 80 } = options;

    const metadata = await this.getMetadata(buffer);

    if (!metadata.isAnimated) {
      throw new BadRequestException('Image is not animated');
    }

    return this.process(buffer, {
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      quality,
      preserveAnimation: true,
    });
  }

  /**
   * Convert image to different format
   */
  async convert(
    buffer: Buffer,
    targetFormat: 'webp' | 'jpeg' | 'png' | 'gif' | 'avif',
    quality = DEFAULT_QUALITY,
  ): Promise<ProcessedImage> {
    return this.process(buffer, {
      format: targetFormat,
      quality,
      preserveAnimation: ANIMATED_FORMATS.includes(targetFormat),
    });
  }

  /**
   * Compress image to target size (in KB)
   */
  async compressToSize(
    buffer: Buffer,
    targetSizeKB: number,
    minQuality = 30,
  ): Promise<ProcessedImage> {
    const targetSize = targetSizeKB * 1024;
    let quality = 90;
    let result: ProcessedImage;

    // Binary search for optimal quality
    let low = minQuality;
    let high = 95;

    while (low <= high) {
      quality = Math.floor((low + high) / 2);
      result = await this.process(buffer, {
        quality,
        preserveAnimation: true,
      });

      if (result.size <= targetSize) {
        // Size is acceptable, try higher quality
        low = quality + 1;
      } else {
        // Size too large, reduce quality
        high = quality - 1;
      }
    }

    // Final pass with best quality that fits
    return this.process(buffer, {
      quality: Math.max(minQuality, high),
      preserveAnimation: true,
    });
  }

  /**
   * Extract first frame from animated image
   */
  async extractFirstFrame(buffer: Buffer): Promise<ProcessedImage> {
    const metadata = await this.getMetadata(buffer);

    if (!metadata.isAnimated) {
      // Already static, just optimize
      return this.process(buffer, { preserveAnimation: false });
    }

    const processedBuffer = await sharp(buffer, { animated: false })
      .webp({ quality: 85 })
      .toBuffer();

    const processedMetadata = await this.getMetadata(processedBuffer);

    return {
      buffer: processedBuffer,
      format: 'webp',
      width: processedMetadata.width,
      height: processedMetadata.height,
      size: processedBuffer.length,
      isAnimated: false,
      originalFormat: metadata.format,
      compressionRatio: buffer.length / processedBuffer.length,
    };
  }

  /**
   * Generate multiple sizes for responsive images
   */
  async generateResponsiveSizes(
    buffer: Buffer,
    sizes: number[] = [320, 640, 1024, 1920],
  ): Promise<Map<number, ProcessedImage>> {
    const results = new Map<number, ProcessedImage>();

    for (const size of sizes) {
      const processed = await this.process(buffer, {
        width: size,
        fit: 'inside',
        quality: 80,
        preserveAnimation: false,
      });
      results.set(size, processed);
    }

    return results;
  }

  /**
   * Check if image is animated
   */
  async isAnimated(buffer: Buffer): Promise<boolean> {
    const metadata = await this.getMetadata(buffer);
    return metadata.isAnimated;
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return ['jpeg', 'png', 'webp', 'gif', 'avif'];
  }

  /**
   * Get supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    return SUPPORTED_MIME_TYPES;
  }
}

export default ImageProcessorService;
