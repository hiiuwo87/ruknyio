import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

// ===== Interfaces =====
export interface UploadProgress {
  uploadId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  percentage: number;
  status: UploadStatus;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export type UploadStatus =
  | 'pending'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface UploadProgressEvent {
  type: 'progress' | 'complete' | 'error' | 'cancelled';
  upload: UploadProgress;
}

export interface BatchUploadProgress {
  batchId: string;
  userId: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  uploads: Map<string, UploadProgress>;
  status: UploadStatus;
  startedAt: Date;
  updatedAt: Date;
}

/**
 * Upload Progress Tracking Service
 *
 * Provides real-time upload progress tracking with:
 * - Individual file progress
 * - Batch upload progress
 * - Event emission for WebSocket integration
 * - Progress persistence for reconnection
 */
@Injectable()
export class UploadProgressService {
  private readonly logger = new Logger(UploadProgressService.name);
  private readonly uploads = new Map<string, UploadProgress>();
  private readonly batches = new Map<string, BatchUploadProgress>();
  private readonly userUploads = new Map<string, Set<string>>();
  private readonly eventEmitter = new EventEmitter();

  // Cleanup old uploads after 1 hour
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
  private readonly MAX_AGE_MS = 60 * 60 * 1000;

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Start tracking a new upload
   */
  startUpload(
    uploadId: string,
    userId: string,
    fileName: string,
    fileSize: number,
    metadata?: Record<string, any>,
  ): UploadProgress {
    const upload: UploadProgress = {
      uploadId,
      userId,
      fileName,
      fileSize,
      uploadedBytes: 0,
      percentage: 0,
      status: 'pending',
      startedAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    this.uploads.set(uploadId, upload);

    // Track by user
    if (!this.userUploads.has(userId)) {
      this.userUploads.set(userId, new Set());
    }
    this.userUploads.get(userId)!.add(uploadId);

    this.emit('progress', upload);
    this.logger.debug(`Started tracking upload: ${uploadId} for user ${userId}`);

    return upload;
  }

  /**
   * Update upload progress
   */
  updateProgress(
    uploadId: string,
    uploadedBytes: number,
    status?: UploadStatus,
  ): UploadProgress | null {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      this.logger.warn(`Upload not found: ${uploadId}`);
      return null;
    }

    upload.uploadedBytes = uploadedBytes;
    upload.percentage = Math.min(
      100,
      Math.round((uploadedBytes / upload.fileSize) * 100),
    );
    upload.updatedAt = new Date();

    if (status) {
      upload.status = status;
    } else if (upload.percentage >= 100) {
      upload.status = 'completed';
      upload.completedAt = new Date();
    } else if (upload.status === 'pending') {
      upload.status = 'uploading';
    }

    this.emit('progress', upload);

    // Update batch if applicable
    this.updateBatchProgress(upload);

    return upload;
  }

  /**
   * Mark upload as processing (image optimization, etc.)
   */
  markProcessing(uploadId: string): UploadProgress | null {
    const upload = this.uploads.get(uploadId);
    if (!upload) return null;

    upload.status = 'processing';
    upload.updatedAt = new Date();

    this.emit('progress', upload);
    return upload;
  }

  /**
   * Mark upload as completed
   */
  completeUpload(
    uploadId: string,
    metadata?: Record<string, any>,
  ): UploadProgress | null {
    const upload = this.uploads.get(uploadId);
    if (!upload) return null;

    upload.status = 'completed';
    upload.percentage = 100;
    upload.uploadedBytes = upload.fileSize;
    upload.completedAt = new Date();
    upload.updatedAt = new Date();

    if (metadata) {
      upload.metadata = { ...upload.metadata, ...metadata };
    }

    this.emit('complete', upload);
    this.updateBatchProgress(upload);

    this.logger.debug(`Upload completed: ${uploadId}`);

    return upload;
  }

  /**
   * Mark upload as failed
   */
  failUpload(uploadId: string, error: string): UploadProgress | null {
    const upload = this.uploads.get(uploadId);
    if (!upload) return null;

    upload.status = 'failed';
    upload.error = error;
    upload.updatedAt = new Date();

    this.emit('error', upload);
    this.updateBatchProgress(upload);

    this.logger.warn(`Upload failed: ${uploadId} - ${error}`);

    return upload;
  }

  /**
   * Cancel an upload
   */
  cancelUpload(uploadId: string): UploadProgress | null {
    const upload = this.uploads.get(uploadId);
    if (!upload) return null;

    upload.status = 'cancelled';
    upload.updatedAt = new Date();

    this.emit('cancelled', upload);
    this.updateBatchProgress(upload);

    return upload;
  }

  /**
   * Get upload progress
   */
  getUpload(uploadId: string): UploadProgress | null {
    return this.uploads.get(uploadId) || null;
  }

  /**
   * Get all uploads for a user
   */
  getUserUploads(userId: string): UploadProgress[] {
    const uploadIds = this.userUploads.get(userId);
    if (!uploadIds) return [];

    return Array.from(uploadIds)
      .map((id) => this.uploads.get(id))
      .filter((upload): upload is UploadProgress => !!upload);
  }

  /**
   * Get active uploads for a user
   */
  getActiveUploads(userId: string): UploadProgress[] {
    return this.getUserUploads(userId).filter(
      (upload) =>
        upload.status === 'pending' ||
        upload.status === 'processing' ||
        upload.status === 'uploading',
    );
  }

  // ===== Batch Upload Support =====

  /**
   * Start a batch upload
   */
  startBatch(
    batchId: string,
    userId: string,
    files: Array<{ uploadId: string; fileName: string; fileSize: number }>,
  ): BatchUploadProgress {
    const uploads = new Map<string, UploadProgress>();

    for (const file of files) {
      const upload = this.startUpload(
        file.uploadId,
        userId,
        file.fileName,
        file.fileSize,
        { batchId },
      );
      uploads.set(file.uploadId, upload);
    }

    const batch: BatchUploadProgress = {
      batchId,
      userId,
      totalFiles: files.length,
      completedFiles: 0,
      failedFiles: 0,
      uploads,
      status: 'pending',
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    this.batches.set(batchId, batch);

    return batch;
  }

  /**
   * Get batch progress
   */
  getBatch(batchId: string): BatchUploadProgress | null {
    return this.batches.get(batchId) || null;
  }

  /**
   * Update batch progress based on individual upload
   */
  private updateBatchProgress(upload: UploadProgress): void {
    const batchId = upload.metadata?.batchId;
    if (!batchId) return;

    const batch = this.batches.get(batchId);
    if (!batch) return;

    // Update batch statistics
    const uploads = Array.from(batch.uploads.values());
    batch.completedFiles = uploads.filter((u) => u.status === 'completed').length;
    batch.failedFiles = uploads.filter((u) => u.status === 'failed').length;
    batch.updatedAt = new Date();

    // Update batch status
    if (batch.completedFiles + batch.failedFiles === batch.totalFiles) {
      batch.status = batch.failedFiles === 0 ? 'completed' : 'failed';
    } else if (uploads.some((u) => u.status === 'uploading' || u.status === 'processing')) {
      batch.status = 'uploading';
    }
  }

  // ===== Event Handling =====

  /**
   * Subscribe to upload events
   */
  onProgress(callback: (event: UploadProgressEvent) => void): () => void {
    this.eventEmitter.on('upload', callback);
    return () => this.eventEmitter.off('upload', callback);
  }

  /**
   * Subscribe to events for specific user
   */
  onUserProgress(
    userId: string,
    callback: (event: UploadProgressEvent) => void,
  ): () => void {
    const handler = (event: UploadProgressEvent) => {
      if (event.upload.userId === userId) {
        callback(event);
      }
    };

    this.eventEmitter.on('upload', handler);
    return () => this.eventEmitter.off('upload', handler);
  }

  private emit(type: UploadProgressEvent['type'], upload: UploadProgress): void {
    this.eventEmitter.emit('upload', { type, upload });
  }

  // ===== Cleanup =====

  /**
   * Remove completed/failed uploads older than MAX_AGE_MS
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [uploadId, upload] of this.uploads) {
      const isOld = now - upload.updatedAt.getTime() > this.MAX_AGE_MS;
      const isDone =
        upload.status === 'completed' ||
        upload.status === 'failed' ||
        upload.status === 'cancelled';

      if (isOld && isDone) {
        this.uploads.delete(uploadId);
        this.userUploads.get(upload.userId)?.delete(uploadId);
        cleaned++;
      }
    }

    // Clean empty user sets
    for (const [userId, uploadIds] of this.userUploads) {
      if (uploadIds.size === 0) {
        this.userUploads.delete(userId);
      }
    }

    // Clean old batches
    for (const [batchId, batch] of this.batches) {
      const isOld = now - batch.updatedAt.getTime() > this.MAX_AGE_MS;
      const isDone = batch.status === 'completed' || batch.status === 'failed';

      if (isOld && isDone) {
        this.batches.delete(batchId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} old upload records`);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalUploads: number;
    activeUploads: number;
    totalBatches: number;
    activeBatches: number;
  } {
    const activeUploads = Array.from(this.uploads.values()).filter(
      (u) =>
        u.status === 'pending' ||
        u.status === 'processing' ||
        u.status === 'uploading',
    ).length;

    const activeBatches = Array.from(this.batches.values()).filter(
      (b) =>
        b.status === 'pending' ||
        b.status === 'uploading',
    ).length;

    return {
      totalUploads: this.uploads.size,
      activeUploads,
      totalBatches: this.batches.size,
      activeBatches,
    };
  }
}

export default UploadProgressService;
