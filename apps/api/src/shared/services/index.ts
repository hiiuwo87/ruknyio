/**
 * Shared Services - Unified Export
 *
 * S3Service: File storage operations with retry logic, validation, and health checks
 * ImageProcessorService: Image processing with animated GIF/WebP support
 * VideoProcessorService: Video processing with thumbnail extraction and compression
 * UploadProgressService: Real-time upload progress tracking
 */

// S3 Storage
export {
  S3Service,
  S3Config,
  BufferInput,
  UploadResult,
  S3HealthStatus,
  default as S3ServiceDefault,
} from './s3.service';

// Image Processing
export {
  ImageProcessorService,
  ImageProcessingOptions,
  ProcessedImage,
  ImageValidationResult,
  ImageMetadata,
} from './image-processor.service';

// Video Processing
export {
  VideoProcessorService,
  VideoProcessingOptions,
  ProcessedVideo,
  ProcessedThumbnail,
  VideoMetadata,
  VideoValidationResult,
} from './video-processor.service';

// Upload Progress
export {
  UploadProgressService,
  UploadProgress,
  UploadStatus,
  UploadProgressEvent,
  BatchUploadProgress,
} from './upload-progress.service';
