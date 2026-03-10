import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import { spawn } from 'child_process';

// ===== Constants =====
const DEFAULT_MAX_VIDEO_SIZE_MB = 50;
const DEFAULT_MAX_VIDEO_DURATION_SECONDS = 30;
const DEFAULT_VIDEO_QUALITY = 23; // CRF value (lower = better quality)
const TEMP_DIR = join(process.cwd(), 'temp', 'videos');

// ===== Interfaces =====
export interface VideoProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // CRF value 0-51 (lower = better)
  maxDurationSeconds?: number;
  format?: 'mp4' | 'webm';
  generateThumbnail?: boolean;
  thumbnailTime?: number; // seconds
  loop?: boolean; // for profile videos
  muted?: boolean; // remove audio
}

export interface ProcessedVideo {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  duration: number;
  size: number;
  thumbnail?: ProcessedThumbnail;
  originalFormat: string;
  compressionRatio: number;
}

export interface ProcessedThumbnail {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  format: string;
  codec: string;
  bitrate: number;
  fps: number;
  hasAudio: boolean;
  size: number;
}

export interface VideoValidationResult {
  valid: boolean;
  mimeType?: string;
  extension?: string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  error?: string;
}

// Supported video types
const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'video/ogg',
];

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv'];

/**
 * Video Processing Service
 *
 * Provides video processing capabilities including:
 * - Video validation and format detection
 * - Video compression and conversion
 * - Thumbnail extraction
 * - Duration limiting (for profile videos)
 * - Resolution scaling
 *
 * Requires FFmpeg to be installed on the system.
 * Set FFMPEG_PATH environment variable if not in system PATH.
 */
@Injectable()
export class VideoProcessorService implements OnModuleInit {
  private readonly logger = new Logger(VideoProcessorService.name);
  private readonly maxVideoSizeMB: number;
  private readonly maxDurationSeconds: number;
  private ffmpegPath: string;
  private ffprobePath: string;
  private isFFmpegAvailable = false;

  constructor(private readonly configService: ConfigService) {
    this.maxVideoSizeMB = this.configService.get<number>(
      'VIDEO_MAX_SIZE_MB',
      DEFAULT_MAX_VIDEO_SIZE_MB,
    );
    this.maxDurationSeconds = this.configService.get<number>(
      'VIDEO_MAX_DURATION_SECONDS',
      DEFAULT_MAX_VIDEO_DURATION_SECONDS,
    );
    this.ffmpegPath = this.configService.get<string>('FFMPEG_PATH', 'ffmpeg');
    this.ffprobePath = this.configService.get<string>('FFPROBE_PATH', 'ffprobe');
  }

  async onModuleInit(): Promise<void> {
    // Ensure temp directory exists
    if (!existsSync(TEMP_DIR)) {
      await mkdir(TEMP_DIR, { recursive: true });
    }

    // Check if FFmpeg is available
    this.isFFmpegAvailable = await this.checkFFmpegAvailable();
    if (this.isFFmpegAvailable) {
      this.logger.log('FFmpeg is available for video processing');
    } else {
      this.logger.warn(
        'FFmpeg is not available. Video processing will be limited. ' +
          'Install FFmpeg or set FFMPEG_PATH environment variable.',
      );
    }
  }

  /**
   * Check if FFmpeg is installed and accessible
   */
  private async checkFFmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.ffmpegPath, ['-version']);
      process.on('error', () => resolve(false));
      process.on('close', (code) => resolve(code === 0));
    });
  }

  /**
   * Validate a video buffer
   */
  async validate(
    buffer: Buffer,
    options?: {
      maxSizeMB?: number;
      maxDurationSeconds?: number;
      maxWidth?: number;
      maxHeight?: number;
    },
  ): Promise<VideoValidationResult> {
    const maxSize = (options?.maxSizeMB ?? this.maxVideoSizeMB) * 1024 * 1024;
    const maxDuration = options?.maxDurationSeconds ?? this.maxDurationSeconds;

    try {
      // Check file size
      if (buffer.length > maxSize) {
        return {
          valid: false,
          error: `Video size exceeds ${options?.maxSizeMB ?? this.maxVideoSizeMB}MB limit`,
        };
      }

      // Detect file type from magic bytes
      const fileType = await fileTypeFromBuffer(buffer);
      if (!fileType || !SUPPORTED_VIDEO_MIME_TYPES.includes(fileType.mime)) {
        return {
          valid: false,
          error: `Invalid video type. Supported: MP4, WebM, MOV, AVI, MKV`,
        };
      }

      // Get video metadata if FFmpeg available
      if (this.isFFmpegAvailable) {
        const metadata = await this.getMetadata(buffer);

        // Check duration
        if (metadata.duration > maxDuration) {
          return {
            valid: false,
            error: `Video duration exceeds ${maxDuration} seconds limit`,
          };
        }

        // Check dimensions
        const maxWidth = options?.maxWidth ?? 4096;
        const maxHeight = options?.maxHeight ?? 4096;
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          return {
            valid: false,
            error: `Video dimensions exceed ${maxWidth}x${maxHeight}px`,
          };
        }

        return {
          valid: true,
          mimeType: fileType.mime,
          extension: fileType.ext,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          size: buffer.length,
        };
      }

      // Without FFmpeg, just validate basic properties
      return {
        valid: true,
        mimeType: fileType.mime,
        extension: fileType.ext,
        size: buffer.length,
      };
    } catch (err: any) {
      this.logger.error(`Video validation failed: ${err.message}`);
      return {
        valid: false,
        error: 'Failed to process video',
      };
    }
  }

  /**
   * Get video metadata using FFprobe
   */
  async getMetadata(buffer: Buffer): Promise<VideoMetadata> {
    if (!this.isFFmpegAvailable) {
      throw new BadRequestException('FFmpeg is not available for video processing');
    }

    const tempId = uuidv4();
    const inputPath = join(TEMP_DIR, `${tempId}_input`);

    try {
      // Write buffer to temp file
      await writeFile(inputPath, buffer);

      // Run FFprobe
      const metadata = await this.runFFprobe(inputPath);

      return {
        ...metadata,
        size: buffer.length,
      };
    } finally {
      // Cleanup
      await this.cleanupFile(inputPath);
    }
  }

  /**
   * Run FFprobe to get video metadata
   */
  private runFFprobe(inputPath: string): Promise<Omit<VideoMetadata, 'size'>> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        inputPath,
      ];

      const process = spawn(this.ffprobePath, args);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => (stdout += data));
      process.stderr.on('data', (data) => (stderr += data));

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed: ${stderr}`));
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
          const audioStream = info.streams?.find((s: any) => s.codec_type === 'audio');

          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          // Parse frame rate (can be "30/1" or "29.97")
          let fps = 30;
          if (videoStream.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/');
            fps = den ? parseInt(num) / parseInt(den) : parseFloat(num);
          }

          resolve({
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            duration: parseFloat(info.format?.duration || '0'),
            format: info.format?.format_name || 'unknown',
            codec: videoStream.codec_name || 'unknown',
            bitrate: parseInt(info.format?.bit_rate || '0'),
            fps,
            hasAudio: !!audioStream,
          });
        } catch (err) {
          reject(new Error(`Failed to parse FFprobe output: ${err}`));
        }
      });

      process.on('error', (err) => reject(err));
    });
  }

  /**
   * Process video for profile/banner use
   */
  async process(
    buffer: Buffer,
    options: VideoProcessingOptions = {},
  ): Promise<ProcessedVideo> {
    if (!this.isFFmpegAvailable) {
      throw new BadRequestException(
        'FFmpeg is not available. Please install FFmpeg to process videos.',
      );
    }

    const {
      maxWidth = 1280,
      maxHeight = 720,
      quality = DEFAULT_VIDEO_QUALITY,
      maxDurationSeconds = this.maxDurationSeconds,
      format = 'mp4',
      generateThumbnail = true,
      thumbnailTime = 0,
      loop = false,
      muted = false,
    } = options;

    // Validate first
    const validation = await this.validate(buffer, {
      maxDurationSeconds: maxDurationSeconds + 5, // Allow slightly longer for processing
    });

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const tempId = uuidv4();
    const inputPath = join(TEMP_DIR, `${tempId}_input`);
    const outputPath = join(TEMP_DIR, `${tempId}_output.${format}`);
    const thumbnailPath = join(TEMP_DIR, `${tempId}_thumb.jpg`);

    try {
      // Write buffer to temp file
      await writeFile(inputPath, buffer);

      // Get original metadata
      const originalMetadata = await this.runFFprobe(inputPath);

      // Calculate output dimensions (maintain aspect ratio)
      const { width: outWidth, height: outHeight } = this.calculateDimensions(
        originalMetadata.width,
        originalMetadata.height,
        maxWidth,
        maxHeight,
      );

      // Process video
      await this.runFFmpeg(inputPath, outputPath, {
        width: outWidth,
        height: outHeight,
        quality,
        maxDuration: maxDurationSeconds,
        format,
        loop,
        muted,
      });

      // Read processed video
      const { readFile } = await import('fs/promises');
      const processedBuffer = await readFile(outputPath);

      // Generate thumbnail if requested
      let thumbnail: ProcessedThumbnail | undefined;
      if (generateThumbnail) {
        await this.extractThumbnail(inputPath, thumbnailPath, thumbnailTime);
        const thumbBuffer = await readFile(thumbnailPath);
        thumbnail = {
          buffer: thumbBuffer,
          format: 'jpeg',
          width: outWidth,
          height: outHeight,
          size: thumbBuffer.length,
        };
      }

      // Get processed metadata
      const processedMetadata = await this.runFFprobe(outputPath);

      return {
        buffer: processedBuffer,
        format,
        width: processedMetadata.width,
        height: processedMetadata.height,
        duration: processedMetadata.duration,
        size: processedBuffer.length,
        thumbnail,
        originalFormat: originalMetadata.format,
        compressionRatio: buffer.length / processedBuffer.length,
      };
    } finally {
      // Cleanup temp files
      await Promise.all([
        this.cleanupFile(inputPath),
        this.cleanupFile(outputPath),
        this.cleanupFile(thumbnailPath),
      ]);
    }
  }

  /**
   * Calculate output dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    inputWidth: number,
    inputHeight: number,
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } {
    let width = inputWidth;
    let height = inputHeight;

    // Scale down if needed
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    // Ensure even dimensions (required by many codecs)
    width = Math.floor(width / 2) * 2;
    height = Math.floor(height / 2) * 2;

    return { width, height };
  }

  /**
   * Run FFmpeg to process video
   */
  private runFFmpeg(
    inputPath: string,
    outputPath: string,
    options: {
      width: number;
      height: number;
      quality: number;
      maxDuration: number;
      format: string;
      loop: boolean;
      muted: boolean;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args: string[] = [
        '-y', // Overwrite output
        '-i', inputPath,
        '-t', String(options.maxDuration), // Limit duration
        '-vf', `scale=${options.width}:${options.height}`,
        '-crf', String(options.quality),
      ];

      // Format-specific options
      if (options.format === 'mp4') {
        args.push(
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-profile:v', 'main',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart', // Web optimization
        );
      } else if (options.format === 'webm') {
        args.push(
          '-c:v', 'libvpx-vp9',
          '-b:v', '0', // Use CRF mode
        );
      }

      // Audio options
      if (options.muted) {
        args.push('-an'); // Remove audio
      } else {
        args.push('-c:a', 'aac', '-b:a', '128k');
      }

      // Loop option (for GIF-like behavior)
      if (options.loop) {
        args.push('-loop', '0');
      }

      args.push(outputPath);

      const process = spawn(this.ffmpegPath, args);
      let stderr = '';

      process.stderr.on('data', (data) => (stderr += data));

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg processing failed: ${stderr.slice(-500)}`));
        } else {
          resolve();
        }
      });

      process.on('error', (err) => reject(err));
    });
  }

  /**
   * Extract thumbnail from video
   */
  private extractThumbnail(
    inputPath: string,
    outputPath: string,
    timeSeconds: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-ss', String(timeSeconds),
        '-i', inputPath,
        '-vframes', '1',
        '-q:v', '5',
        outputPath,
      ];

      const process = spawn(this.ffmpegPath, args);
      let stderr = '';

      process.stderr.on('data', (data) => (stderr += data));

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Thumbnail extraction failed: ${stderr.slice(-500)}`));
        } else {
          resolve();
        }
      });

      process.on('error', (err) => reject(err));
    });
  }

  /**
   * Extract thumbnail only (without full video processing)
   */
  async extractThumbnailOnly(
    buffer: Buffer,
    options: {
      timeSeconds?: number;
      width?: number;
      height?: number;
    } = {},
  ): Promise<ProcessedThumbnail> {
    if (!this.isFFmpegAvailable) {
      throw new BadRequestException('FFmpeg is not available');
    }

    const { timeSeconds = 0, width = 400, height } = options;

    const tempId = uuidv4();
    const inputPath = join(TEMP_DIR, `${tempId}_input`);
    const outputPath = join(TEMP_DIR, `${tempId}_thumb.jpg`);

    try {
      await writeFile(inputPath, buffer);

      // Build scale filter
      const scale = height ? `scale=${width}:${height}` : `scale=${width}:-1`;

      const args = [
        '-y',
        '-ss', String(timeSeconds),
        '-i', inputPath,
        '-vframes', '1',
        '-vf', scale,
        '-q:v', '5',
        outputPath,
      ];

      await new Promise<void>((resolve, reject) => {
        const process = spawn(this.ffmpegPath, args);
        process.on('close', (code) => (code === 0 ? resolve() : reject()));
        process.on('error', reject);
      });

      const { readFile } = await import('fs/promises');
      const thumbBuffer = await readFile(outputPath);

      // Get dimensions from sharp
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(thumbBuffer).metadata();

      return {
        buffer: thumbBuffer,
        format: 'jpeg',
        width: metadata.width || width,
        height: metadata.height || 0,
        size: thumbBuffer.length,
      };
    } finally {
      await Promise.all([
        this.cleanupFile(inputPath),
        this.cleanupFile(outputPath),
      ]);
    }
  }

  /**
   * Process video for avatar (short, square, muted)
   */
  async processAvatar(buffer: Buffer, size = 400): Promise<ProcessedVideo> {
    return this.process(buffer, {
      maxWidth: size,
      maxHeight: size,
      maxDurationSeconds: 10, // Short for avatars
      format: 'mp4',
      generateThumbnail: true,
      muted: true, // Avatars should be muted
      quality: 25,
    });
  }

  /**
   * Process video for banner/cover
   */
  async processBanner(
    buffer: Buffer,
    width = 1400,
    height = 400,
  ): Promise<ProcessedVideo> {
    return this.process(buffer, {
      maxWidth: width,
      maxHeight: height,
      maxDurationSeconds: 30,
      format: 'mp4',
      generateThumbnail: true,
      muted: false,
      quality: 23,
    });
  }

  /**
   * Process video for profile background
   */
  async processProfileBackground(buffer: Buffer): Promise<ProcessedVideo> {
    return this.process(buffer, {
      maxWidth: 1920,
      maxHeight: 1080,
      maxDurationSeconds: 60,
      format: 'mp4',
      generateThumbnail: true,
      loop: true,
      muted: true, // Background videos should be muted
      quality: 26,
    });
  }

  /**
   * Cleanup temp file
   */
  private async cleanupFile(path: string): Promise<void> {
    try {
      if (existsSync(path)) {
        await unlink(path);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if FFmpeg is available
   */
  isAvailable(): boolean {
    return this.isFFmpegAvailable;
  }

  /**
   * Get supported video types
   */
  getSupportedMimeTypes(): string[] {
    return SUPPORTED_VIDEO_MIME_TYPES;
  }

  /**
   * Get supported extensions
   */
  getSupportedExtensions(): string[] {
    return VIDEO_EXTENSIONS;
  }

  /**
   * Check if mime type is video
   */
  isVideo(mimeType: string): boolean {
    return SUPPORTED_VIDEO_MIME_TYPES.includes(mimeType);
  }
}

export default VideoProcessorService;
