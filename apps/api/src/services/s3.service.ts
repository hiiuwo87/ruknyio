import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;

  constructor() {
    const region = process.env.AWS_REGION || 'eu-north-1';
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const clientConfig: any = { region };
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = { accessKeyId, secretAccessKey };
    }
    this.client = new S3Client(clientConfig);
  }

  /**
   * Upload buffer to S3 with automatic retries on transient errors
   * @param bucket - S3 bucket name
   * @param key - S3 object key
   * @param buffer - File buffer to upload
   * @param contentType - MIME type
   * @param maxRetries - Max retry attempts for transient errors
   */
  async uploadBuffer(
    bucket: string,
    key: string,
    buffer: any,
    contentType: string,
    maxRetries = 3,
  ) {
    // Normalize various input shapes to a Buffer/Uint8Array and provide ContentLength
    let body: Uint8Array | Buffer;
    try {
      if (Buffer.isBuffer(buffer)) {
        body = buffer;
      } else if (buffer && buffer instanceof Uint8Array) {
        body = buffer;
      } else if (buffer && typeof buffer.arrayBuffer === 'function') {
        const ab = await buffer.arrayBuffer();
        body = Buffer.from(new Uint8Array(ab));
      } else if (buffer && Array.isArray(buffer.data)) {
        // Handle serialized Buffer objects { type: 'Buffer', data: [...] }
        body = Buffer.from(buffer.data);
      } else if (buffer && buffer.buffer && buffer.byteLength) {
        // TypedArray-like with .buffer
        body = Buffer.from(buffer.buffer);
      } else if (typeof buffer === 'string') {
        body = Buffer.from(buffer);
      } else {
        throw new BadRequestException('Invalid buffer type for S3 upload');
      }
    } catch (err) {
      this.logger.error(
        `Failed to normalize upload buffer for key=${key}: ${err}`,
      );
      throw err;
    }

    // Retry logic for transient errors
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: (body as Buffer).length,
        });

        this.logger.debug(
          `uploadBuffer: putting object to bucket=${bucket} key=${key} length=${(body as Buffer).length}`,
        );
        await this.client.send(cmd);
        return key;
      } catch (err: any) {
        lastError = err;
        
        // Determine if error is retryable (transient)
        const isTransient = 
          err?.name === 'RequestTimeout' ||
          err?.name === 'ServiceUnavailable' ||
          err?.name === 'RequestAbortedError' ||
          err?.Code === 'RequestTimeout' ||
          err?.Code === 'ServiceUnavailable' ||
          err?.statusCode === 503 ||
          err?.statusCode === 429;

        const isPermissionError = 
          err?.name === 'AccessDenied' ||
          err?.Code === 'AccessDenied';

        // Log attempt
        if (attempt < maxRetries) {
          if (isTransient) {
            this.logger.warn(
              `S3 upload attempt ${attempt}/${maxRetries} failed (transient): ${err?.name || err?.Code || err}. Retrying...`,
            );
            // Exponential backoff
            await new Promise(resolve => 
              setTimeout(resolve, Math.pow(2, attempt - 1) * 100)
            );
            continue;
          } else if (isPermissionError) {
            // Don't retry on permission errors
            this.logger.error(
              `S3 upload failed: AccessDenied for bucket=${bucket} key=${key}. Check IAM permissions.`,
            );
            throw new BadRequestException(
              'S3 access denied. Please check your AWS credentials and IAM permissions.',
            );
          }
        }

        // Handle specific errors
        if (err?.name === 'NoSuchBucket') {
          throw new BadRequestException(`S3 bucket does not exist: ${bucket}`);
        }

        throw err;
      }
    }

    // All retries exhausted
    this.logger.error(
      `S3 upload failed after ${maxRetries} attempts for bucket=${bucket} key=${key}: ${lastError?.name || lastError}`,
    );
    throw new BadRequestException(
      'Failed to upload file to S3 after multiple attempts. Please try again.',
    );
  }

  async onModuleInit() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return;
    try {
      const cmd = new HeadBucketCommand({ Bucket: bucket });
      await this.client.send(cmd);
      this.logger.log(`S3 bucket reachable: ${bucket}`);
    } catch (err: any) {
      this.logger.warn(
        `S3 bucket check failed for ${bucket}: ${err?.name || err}`,
      );
    }
  }

  async deleteObject(bucket: string, key: string) {
    try {
      const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
      await this.client.send(cmd);
      return true;
    } catch (e) {
      this.logger.warn(`Failed deleting s3 object ${key}: ${e}`);
      return false;
    }
  }

  async getPresignedPutUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds = 3600,
  ) {
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // Note: ACL removed - bucket may have Block Public Access enabled
      // Images will be served via presigned GET URLs instead
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  /**
   * Generate a presigned GET URL for reading a private S3 object
   * Used when bucket has Block Public Access enabled
   */
  async getPresignedGetUrl(
    bucket: string,
    key: string,
    expiresInSeconds = 3600,
  ) {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  /**
   * Convert multiple keys to presigned GET URLs
   */
  async getPresignedGetUrls(
    bucket: string,
    keys: string[],
    expiresInSeconds = 3600,
  ): Promise<string[]> {
    return Promise.all(
      keys.map((key) => this.getPresignedGetUrl(bucket, key, expiresInSeconds)),
    );
  }

  /**
   * Get object from S3
   */
  async getObject(bucket: string, key: string): Promise<Buffer> {
    try {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.client.send(cmd);
      const stream = response.Body as any;
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      this.logger.error(`Failed to get S3 object ${key}: ${err?.message}`);
      throw err;
    }
  }

  /**
   * List objects in bucket with prefix
   */
  async listObjects(bucket: string, prefix: string): Promise<any[]> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
      const response = await this.client.send(cmd);
      return response.Contents || [];
    } catch (err: any) {
      this.logger.error(`Failed to list S3 objects: ${err?.message}`);
      return [];
    }
  }

  /**
   * Create multipart upload
   */
  async createMultipartUpload(bucket: string, key: string, contentType: string): Promise<string> {
    try {
      const { CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3');
      const cmd = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const response = await this.client.send(cmd);
      return response.UploadId || '';
    } catch (err: any) {
      this.logger.error(`Failed to create multipart upload: ${err?.message}`);
      throw err;
    }
  }

  /**
   * Upload part
   */
  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<string> {
    try {
      const { UploadPartCommand } = await import('@aws-sdk/client-s3');
      const cmd = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      });
      const response = await this.client.send(cmd);
      return response.ETag || '';
    } catch (err: any) {
      this.logger.error(`Failed to upload part: ${err?.message}`);
      throw err;
    }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<void> {
    try {
      const { CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3');
      const cmd = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      });
      await this.client.send(cmd);
    } catch (err: any) {
      this.logger.error(`Failed to complete multipart upload: ${err?.message}`);
      throw err;
    }
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    try {
      const { AbortMultipartUploadCommand } = await import('@aws-sdk/client-s3');
      const cmd = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });
      await this.client.send(cmd);
    } catch (err: any) {
      this.logger.error(`Failed to abort multipart upload: ${err?.message}`);
    }
  }
}

export default S3Service;
