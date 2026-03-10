import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base Upload Exception
 */
export class UploadException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly code: string = 'UPLOAD_ERROR',
    public readonly details?: Record<string, any>,
  ) {
    super(
      {
        statusCode,
        message,
        error: code,
        details,
      },
      statusCode,
    );
  }
}

/**
 * File validation errors
 */
export class FileValidationException extends UploadException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'FILE_VALIDATION_ERROR', details);
  }
}

export class FileTooLargeException extends FileValidationException {
  constructor(maxSizeMB: number, actualSizeMB: number) {
    super(`File size exceeds ${maxSizeMB}MB limit (actual: ${actualSizeMB.toFixed(2)}MB)`, {
      maxSizeMB,
      actualSizeMB,
    });
  }
}

export class InvalidFileTypeException extends FileValidationException {
  constructor(providedType: string, allowedTypes: string[]) {
    super(`Invalid file type: ${providedType}. Allowed: ${allowedTypes.join(', ')}`, {
      providedType,
      allowedTypes,
    });
  }
}

export class ImageDimensionException extends FileValidationException {
  constructor(
    maxWidth: number,
    maxHeight: number,
    actualWidth: number,
    actualHeight: number,
  ) {
    super(
      `Image dimensions exceed ${maxWidth}x${maxHeight}px (actual: ${actualWidth}x${actualHeight}px)`,
      { maxWidth, maxHeight, actualWidth, actualHeight },
    );
  }
}

export class AnimatedImageNotAllowedException extends FileValidationException {
  constructor() {
    super('Animated images are not allowed for this upload type');
  }
}

export class NoFilesProvidedException extends FileValidationException {
  constructor() {
    super('No files provided');
  }
}

export class TooManyFilesException extends FileValidationException {
  constructor(maxFiles: number, providedFiles: number) {
    super(`Maximum ${maxFiles} files allowed (provided: ${providedFiles})`, {
      maxFiles,
      providedFiles,
    });
  }
}

/**
 * S3 related errors
 */
export class S3Exception extends UploadException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    code: string = 'S3_ERROR',
    details?: Record<string, any>,
  ) {
    super(message, statusCode, code, details);
  }
}

export class S3BucketNotFoundException extends S3Exception {
  constructor(bucket: string) {
    super(`S3 bucket does not exist: ${bucket}`, HttpStatus.NOT_FOUND, 'S3_BUCKET_NOT_FOUND', {
      bucket,
    });
  }
}

export class S3AccessDeniedException extends S3Exception {
  constructor(bucket: string, key?: string) {
    super(
      `Access denied to S3 ${key ? `object: ${bucket}/${key}` : `bucket: ${bucket}`}`,
      HttpStatus.FORBIDDEN,
      'S3_ACCESS_DENIED',
      { bucket, key },
    );
  }
}

export class S3UploadFailedException extends S3Exception {
  constructor(key: string, reason?: string) {
    super(
      `Failed to upload to S3: ${key}${reason ? ` - ${reason}` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'S3_UPLOAD_FAILED',
      { key, reason },
    );
  }
}

export class S3ObjectNotFoundException extends S3Exception {
  constructor(bucket: string, key: string) {
    super(
      `S3 object not found: ${bucket}/${key}`,
      HttpStatus.NOT_FOUND,
      'S3_OBJECT_NOT_FOUND',
      { bucket, key },
    );
  }
}

export class S3DeleteFailedException extends S3Exception {
  constructor(key: string, reason?: string) {
    super(
      `Failed to delete S3 object: ${key}${reason ? ` - ${reason}` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'S3_DELETE_FAILED',
      { key, reason },
    );
  }
}

export class S3PresignFailedException extends S3Exception {
  constructor(key: string, reason?: string) {
    super(
      `Failed to generate presigned URL: ${key}${reason ? ` - ${reason}` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'S3_PRESIGN_FAILED',
      { key, reason },
    );
  }
}

/**
 * Image processing errors
 */
export class ImageProcessingException extends UploadException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'IMAGE_PROCESSING_ERROR', details);
  }
}

export class ImageCorruptedException extends ImageProcessingException {
  constructor() {
    super('Image file is corrupted or cannot be processed');
  }
}

export class ImageFormatConversionException extends ImageProcessingException {
  constructor(sourceFormat: string, targetFormat: string, reason?: string) {
    super(
      `Failed to convert image from ${sourceFormat} to ${targetFormat}${reason ? `: ${reason}` : ''}`,
      { sourceFormat, targetFormat, reason },
    );
  }
}

/**
 * Storage quota errors
 */
export class StorageQuotaExceededException extends UploadException {
  constructor(usedBytes: number, limitBytes: number) {
    const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
    const limitMB = (limitBytes / (1024 * 1024)).toFixed(2);
    super(
      `Storage quota exceeded. Used: ${usedMB}MB / ${limitMB}MB`,
      HttpStatus.PAYMENT_REQUIRED,
      'STORAGE_QUOTA_EXCEEDED',
      { usedBytes, limitBytes, usedMB, limitMB },
    );
  }
}

/**
 * Rate limiting errors
 */
export class UploadRateLimitException extends UploadException {
  constructor(retryAfterSeconds: number) {
    super(
      `Upload rate limit exceeded. Try again in ${retryAfterSeconds} seconds`,
      HttpStatus.TOO_MANY_REQUESTS,
      'UPLOAD_RATE_LIMIT',
      { retryAfterSeconds },
    );
  }
}

/**
 * Helper function to convert AWS S3 errors to custom exceptions
 */
export function mapS3Error(error: any, bucket: string, key?: string): S3Exception {
  const errorName = error?.name || error?.code || '';
  const errorMessage = error?.message || String(error);

  switch (errorName) {
    case 'NoSuchBucket':
      return new S3BucketNotFoundException(bucket);

    case 'NoSuchKey':
    case 'NotFound':
      return key
        ? new S3ObjectNotFoundException(bucket, key)
        : new S3BucketNotFoundException(bucket);

    case 'AccessDenied':
    case 'Forbidden':
      return new S3AccessDeniedException(bucket, key);

    case 'SlowDown':
    case 'ServiceUnavailable':
      return new S3Exception(
        'S3 service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        'S3_UNAVAILABLE',
      );

    default:
      return new S3Exception(
        `S3 error: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        'S3_ERROR',
        { originalError: errorName },
      );
  }
}
