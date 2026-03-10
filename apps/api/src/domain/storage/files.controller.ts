import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  BadRequestException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Response } from 'express';
import { S3Service } from '../../shared/services/s3.service';

// Regex patterns for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png|gif)$/i;

/**
 * Files Controller - Serves S3 assets via presigned URL redirects
 *
 * This controller is VERSION_NEUTRAL meaning it's accessible at /api/users/...
 * without the /v1 version prefix. This allows raw S3 keys stored in the database
 * to be resolved to presigned URLs without breaking existing data.
 */
@Controller({ version: VERSION_NEUTRAL })
export class FilesController {
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';

  constructor(private readonly s3Service: S3Service) {}

  @Get('users/:userId/profile/avatar/:filename')
  async getAvatar(
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Path Traversal Protection
    this.validatePathParams(userId, filename);
    
    const key = `users/${userId}/profile/avatar/${filename}`;
    const url = await this.s3Service.getPresignedGetUrl(this.bucket, key, 3600);
    return res.redirect(url);
  }

  @Get('users/:userId/profile/cover/:filename')
  async getCover(
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Path Traversal Protection
    this.validatePathParams(userId, filename);
    
    const key = `users/${userId}/profile/cover/${filename}`;
    const url = await this.s3Service.getPresignedGetUrl(this.bucket, key, 3600);
    return res.redirect(url);
  }

  /**
   * Validate path parameters to prevent Path Traversal attacks
   * - userId must be a valid UUID
   * - filename must match safe pattern (alphanumeric + allowed extensions)
   */
  private validatePathParams(userId: string, filename: string): void {
    if (!userId || !filename) {
      throw new NotFoundException('Missing required parameters');
    }

    // Check for path traversal attempts
    if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
      throw new BadRequestException('Invalid userId format');
    }

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Invalid filename format');
    }

    // Validate UUID format for userId
    if (!UUID_REGEX.test(userId)) {
      throw new BadRequestException('Invalid userId format');
    }

    // Validate safe filename pattern
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      throw new BadRequestException('Invalid filename format');
    }
  }
}
