import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ===== Constants =====
const DEFAULT_REGION = 'eu-north-1';
const DEFAULT_BUCKET = 'rukny-storage';
const DEFAULT_PRESIGN_EXPIRES_SECONDS = 3600;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ===== Interfaces =====
export interface S3Config {
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket: string;
}

export type BufferInput =
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | { arrayBuffer: () => Promise<ArrayBuffer> }
  | { type: 'Buffer'; data: number[] }
  | { buffer: ArrayBuffer; byteLength: number }
  | string;

export interface UploadResult {
  key: string;
  bucket: string;
  contentType: string;
  size: number;
}

export interface S3HealthStatus {
  healthy: boolean;
  bucket: string;
  latencyMs?: number;
  error?: string;
}

/**
 * S3 Storage Service
 *
 * Centralized service for S3 operations including:
 * - File uploads with retry logic
 * - File deletions
 * - Presigned URL generation
 * - Health checks
 *
 * Configuration via environment variables:
 * - AWS_REGION: AWS region (default: eu-north-1)
 * - S3_ENDPOINT: Custom S3 endpoint (optional, for MinIO etc.)
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - S3_BUCKET: Default bucket name
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly defaultBucket: string;
  private readonly config: S3Config;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.defaultBucket = this.config.bucket;
    this.client = this.createS3Client();
  }

  /**
   * Load S3 configuration from ConfigService
   */
  private loadConfig(): S3Config {
    return {
      region: this.configService.get<string>('AWS_REGION', DEFAULT_REGION),
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      bucket: this.configService.get<string>('S3_BUCKET', DEFAULT_BUCKET),
    };
  }

  /**
   * Create S3 client with proper configuration
   */
  private createS3Client(): S3Client {
    const clientConfig: S3ClientConfig = {
      region: this.config.region,
      maxAttempts: MAX_RETRY_ATTEMPTS,
    };

    if (this.config.endpoint) {
      clientConfig.endpoint = this.config.endpoint;
      clientConfig.forcePathStyle = true;
    }

    if (this.config.accessKeyId && this.config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      };
    }

    return new S3Client(clientConfig);
  }

  async onModuleInit(): Promise<void> {
    const health = await this.checkHealth();
    if (health.healthy) {
      this.logger.log(
        `S3 bucket reachable: ${health.bucket} (latency: ${health.latencyMs}ms)`,
      );
    } else {
      this.logger.warn(
        `S3 bucket check failed for ${health.bucket}: ${health.error}`,
      );
    }
  }

  // ===== Validation Helpers =====

  /**
   * Validate bucket name
   */
  private validateBucket(bucket: string): void {
    if (!bucket || typeof bucket !== 'string') {
      throw new BadRequestException('Bucket name is required');
    }
    if (bucket.length < 3 || bucket.length > 63) {
      throw new BadRequestException(
        'Bucket name must be between 3 and 63 characters',
      );
    }
  }

  /**
   * Validate S3 key
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('S3 key is required');
    }
    if (key.length > 1024) {
      throw new BadRequestException('S3 key must not exceed 1024 characters');
    }
    // Check for potentially dangerous patterns
    if (key.includes('..') || key.startsWith('/')) {
      throw new BadRequestException('Invalid S3 key format');
    }
  }

  /**
   * Normalize various input shapes to a Buffer
   */
  private async normalizeBuffer(buffer: BufferInput): Promise<Buffer> {
    if (Buffer.isBuffer(buffer)) {
      return buffer;
    }

    if (buffer instanceof Uint8Array) {
      return Buffer.from(buffer);
    }

    if (buffer && typeof (buffer as any).arrayBuffer === 'function') {
      const ab = await (buffer as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
      return Buffer.from(new Uint8Array(ab));
    }

    if (buffer && Array.isArray((buffer as any).data)) {
      return Buffer.from((buffer as { data: number[] }).data);
    }

    if (buffer && (buffer as any).buffer && (buffer as any).byteLength) {
      return Buffer.from((buffer as { buffer: ArrayBuffer }).buffer);
    }

    if (typeof buffer === 'string') {
      return Buffer.from(buffer);
    }

    throw new BadRequestException('Invalid buffer type for S3 upload');
  }

  /**
   * Retry helper for transient failures
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts = MAX_RETRY_ATTEMPTS,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;

        // Don't retry client errors (4xx)
        if (err?.name === 'NoSuchBucket' || err?.$metadata?.httpStatusCode < 500) {
          throw err;
        }

        if (attempt < maxAttempts) {
          const delay = RETRY_DELAY_MS * attempt;
          this.logger.warn(
            `${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms: ${err?.name || err}`,
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===== Core Operations =====

  /**
   * Upload a buffer to S3 with retry logic
   */
  async uploadBuffer(
    bucket: string,
    key: string,
    buffer: BufferInput,
    contentType: string,
  ): Promise<UploadResult> {
    this.validateBucket(bucket);
    this.validateKey(key);

    let body: Buffer;
    try {
      body = await this.normalizeBuffer(buffer);
    } catch (err) {
      this.logger.error(
        `Failed to normalize upload buffer for key=${key}: ${err}`,
      );
      throw err;
    }

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    });

    await this.withRetry(async () => {
      this.logger.debug(
        `uploadBuffer: putting object to bucket=${bucket} key=${key} length=${body.length}`,
      );
      await this.client.send(cmd);
    }, `S3 upload ${key}`);

    return {
      key,
      bucket,
      contentType,
      size: body.length,
    };
  }

  /**
   * Check if an object exists in S3
   */
  async objectExists(bucket: string, key: string): Promise<boolean> {
    this.validateBucket(bucket);
    this.validateKey(key);

    try {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key });
      await this.client.send(cmd);
      return true;
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Get object content from S3 as Buffer
   */
  async getObject(bucket: string, key: string): Promise<Buffer | null> {
    this.validateBucket(bucket);
    this.validateKey(key);

    try {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.client.send(cmd);

      if (!response.Body) {
        return null;
      }

      // Convert stream to buffer
      const stream = response.Body as NodeJS.ReadableStream;
      const chunks: Buffer[] = [];
      
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      this.logger.warn(`Failed to get S3 object ${bucket}/${key}: ${err?.name || err}`);
      throw err;
    }
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(bucket: string, key: string): Promise<boolean> {
    this.validateBucket(bucket);
    this.validateKey(key);

    try {
      const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
      await this.client.send(cmd);
      this.logger.debug(`Deleted S3 object: ${bucket}/${key}`);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Failed deleting S3 object ${bucket}/${key}: ${err?.name || err}`,
      );
      return false;
    }
  }

  /**
   * Delete multiple objects from S3
   */
  async deleteObjects(bucket: string, keys: string[]): Promise<number> {
    if (!keys || keys.length === 0) return 0;
    this.validateBucket(bucket);

    const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

    try {
      const cmd = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      });

      const response = await this.client.send(cmd);
      const deletedCount = keys.length - (response.Errors?.length || 0);
      this.logger.debug(`Deleted ${deletedCount} S3 objects from ${bucket}`);
      return deletedCount;
    } catch (err: any) {
      this.logger.warn(
        `Failed batch deleting S3 objects from ${bucket}: ${err?.name || err}`,
      );
      return 0;
    }
  }

  /**
   * Generate a presigned PUT URL for uploading
   */
  async getPresignedPutUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds = DEFAULT_PRESIGN_EXPIRES_SECONDS,
  ): Promise<string> {
    this.validateBucket(bucket);
    this.validateKey(key);

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  /**
   * Generate a presigned GET URL for reading a private S3 object
   */
  async getPresignedGetUrl(
    bucket: string,
    key: string,
    expiresInSeconds = DEFAULT_PRESIGN_EXPIRES_SECONDS,
  ): Promise<string> {
    this.validateBucket(bucket);
    this.validateKey(key);

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  /**
   * Convert multiple keys to presigned GET URLs
   */
  async getPresignedGetUrls(
    bucket: string,
    keys: string[],
    expiresInSeconds = DEFAULT_PRESIGN_EXPIRES_SECONDS,
  ): Promise<string[]> {
    if (!keys || keys.length === 0) return [];
    this.validateBucket(bucket);

    return Promise.all(
      keys.map((key) => this.getPresignedGetUrl(bucket, key, expiresInSeconds)),
    );
  }

  /**
   * Get the default bucket name
   */
  getDefaultBucket(): string {
    return this.defaultBucket;
  }

  /**
   * Get the current S3 configuration (without secrets)
   */
  getConfig(): Omit<S3Config, 'accessKeyId' | 'secretAccessKey'> {
    return {
      region: this.config.region,
      endpoint: this.config.endpoint,
      bucket: this.config.bucket,
    };
  }

  // ===== Health Check =====

  /**
   * Check S3 service health
   */
  async checkHealth(bucket?: string): Promise<S3HealthStatus> {
    const targetBucket = bucket || this.defaultBucket;

    if (!targetBucket) {
      return {
        healthy: false,
        bucket: '',
        error: 'No bucket configured',
      };
    }

    const startTime = Date.now();

    try {
      const cmd = new HeadBucketCommand({ Bucket: targetBucket });
      await this.client.send(cmd);

      return {
        healthy: true,
        bucket: targetBucket,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        healthy: false,
        bucket: targetBucket,
        latencyMs: Date.now() - startTime,
        error: err?.name || String(err),
      };
    }
  }

  /**
   * Check if S3 is healthy (simple boolean check)
   */
  async isHealthy(): Promise<boolean> {
    const status = await this.checkHealth();
    return status.healthy;
  }

  // ===== S3 Path Helpers for Organized Storage =====

  /**
   * Generate S3 key for user profile avatar
   * Path: users/{userId}/profile/avatar/{filename}
   */
  getAvatarKey(userId: string, filename: string): string {
    return `users/${userId}/profile/avatar/${filename}`;
  }

  /**
   * Generate S3 key for user profile cover
   * Path: users/{userId}/profile/cover/{filename}
   */
  getCoverKey(userId: string, filename: string): string {
    return `users/${userId}/profile/cover/${filename}`;
  }

  /**
   * Generate S3 key for form files
   * Path: users/{userId}/forms/{formId}/{type}/{filename}
   */
  getFormFileKey(
    userId: string,
    formId: string,
    type: 'cover' | 'banner' | 'submission',
    filename: string,
  ): string {
    return `users/${userId}/forms/${formId}/${type}/${filename}`;
  }

  /**
   * Generate S3 key for event files
   * Path: users/{userId}/events/{eventId}/{type}/{filename}
   */
  getEventFileKey(
    userId: string,
    eventId: string,
    type: 'cover' | 'gallery' | 'sponsor',
    filename: string,
  ): string {
    return `users/${userId}/events/${eventId}/${type}/${filename}`;
  }

  /**
   * Generate S3 key for product files
   * Path: users/{userId}/products/{productId}/images/{filename}
   */
  getProductFileKey(
    userId: string,
    productId: string,
    filename: string,
  ): string {
    return `users/${userId}/products/${productId}/images/${filename}`;
  }

  /**
   * Generate S3 key for banner files
   * Path: users/{userId}/banners/{filename}
   */
  getBannerKey(userId: string, filename: string): string {
    return `users/${userId}/banners/${filename}`;
  }

  /**
   * Delete all files for a user (when deleting account)
   * Deletes all files under: users/{userId}/
   */
  async deleteUserFiles(bucket: string, userId: string): Promise<void> {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import(
      '@aws-sdk/client-s3'
    );

    const prefix = `users/${userId}/`;
    let continuationToken: string | undefined;

    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await this.client.send(listCmd);

      if (response.Contents && response.Contents.length > 0) {
        const deleteCmd = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: response.Contents.map((obj) => ({ Key: obj.Key })),
            Quiet: true,
          },
        });

        await this.client.send(deleteCmd);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    this.logger.log(`Deleted all files for user ${userId} from S3`);
  }
}

export default S3Service;
