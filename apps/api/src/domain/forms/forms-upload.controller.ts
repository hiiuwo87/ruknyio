import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Request,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { S3Service } from '../../services/s3.service';
import { v4 as uuidv4 } from 'uuid';

interface PresignFileInfo {
  name: string;
  type: string;
  size: number;
}

@ApiTags('Forms - File Upload')
@Controller('forms')
export class FormsUploadController {
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';
  private readonly maxFileSizeMB = 5;
  private readonly maxFiles = 5;
  private readonly allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  @Post(':id/upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload files for form field' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const formId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
          const uploadPath = join(process.cwd(), 'uploads', 'forms', formId);

          // Create directory if it doesn't exist
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB default
      },
      fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedMimes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/svg+xml',
          'image/tiff',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
        ];

        // Check for image types more flexibly
        const isImage = file.mimetype.startsWith('image/');
        if (allowedMimes.includes(file.mimetype) || isImage) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Allowed: images, PDF, documents, and text files.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFiles(
    @Request() req,
    @Param('id') formId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Verify form exists and is accessible
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    // Return file information
    const uploadedFiles = files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/forms/${formId}/${file.filename}`,
      url: `${process.env.API_URL || 'http://localhost:3001'}/uploads/forms/${formId}/${file.filename}`,
    }));

    return {
      success: true,
      files: uploadedFiles,
    };
  }

  /**
   * Get presigned URLs for direct S3 upload (form cover/banner images)
   */
  @Post('upload/presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get presigned URLs for direct S3 upload of form images',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              size: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getPresignedUrls(
    @Request() req,
    @Body() body: { files: PresignFileInfo[] },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const files = body.files || [];
    if (files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > this.maxFiles) {
      throw new BadRequestException(`Maximum ${this.maxFiles} files allowed`);
    }

    const results: { key: string; url: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!this.allowedTypes.includes(file.type)) {
        throw new BadRequestException(
          `Invalid file type: ${file.type}. Allowed: ${this.allowedTypes.join(', ')}`,
        );
      }

      // Validate file size
      if (file.size > this.maxFileSizeMB * 1024 * 1024) {
        throw new BadRequestException(
          `File too large. Maximum size: ${this.maxFileSizeMB}MB`,
        );
      }

      // Generate unique key
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'webp';
      const key = `users/${userId}/forms/temp/${uuidv4()}.${ext}`;

      // Get presigned PUT URL
      const url = await this.s3Service.getPresignedPutUrl(
        this.bucket,
        key,
        file.type,
        3600, // 1 hour expiry
      );

      results.push({ key, url });
    }

    return results;
  }

  /**
   * Get presigned URLs for a specific form
   */
  @Post(':id/upload/presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get presigned URLs for direct S3 upload of form images',
  })
  async getPresignedUrlsForForm(
    @Request() req,
    @Param('id') formId: string,
    @Body() body: { files: PresignFileInfo[] },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Verify form ownership
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      select: { userId: true },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    if (form.userId !== userId) {
      throw new BadRequestException('Not authorized to upload to this form');
    }

    const files = body.files || [];
    if (files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > this.maxFiles) {
      throw new BadRequestException(`Maximum ${this.maxFiles} files allowed`);
    }

    const results: { key: string; url: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!this.allowedTypes.includes(file.type)) {
        throw new BadRequestException(
          `Invalid file type: ${file.type}. Allowed: ${this.allowedTypes.join(', ')}`,
        );
      }

      // Validate file size
      if (file.size > this.maxFileSizeMB * 1024 * 1024) {
        throw new BadRequestException(
          `File too large. Maximum size: ${this.maxFileSizeMB}MB`,
        );
      }

      // Generate unique key for this form
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'webp';
      const key = `users/${userId}/forms/${formId}/banners/${uuidv4()}.${ext}`;

      // Get presigned PUT URL
      const url = await this.s3Service.getPresignedPutUrl(
        this.bucket,
        key,
        file.type,
        3600,
      );

      results.push({ key, url });
    }

    return results;
  }

  /**
   * Confirm uploaded files (optional - for tracking)
   */
  @Post('upload/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm uploaded files' })
  async confirmUpload(@Request() req, @Body() body: { keys: string[] }) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const keys = body.keys || [];
    if (keys.length === 0) {
      return { ok: true, confirmed: 0 };
    }

    // Verify keys belong to this user
    const validKeys = keys.filter((key) => key.startsWith(`users/${userId}/`));

    // Log for tracking (could also store in DB)
    console.log(
      `User ${userId} confirmed ${validKeys.length} uploads:`,
      validKeys,
    );

    return { ok: true, confirmed: validKeys.length };
  }

  /**
   * Confirm uploaded files for a specific form
   */
  @Post(':id/upload/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm uploaded files for a form' })
  async confirmUploadForForm(
    @Request() req,
    @Param('id') formId: string,
    @Body() body: { keys: string[] },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Verify form ownership
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      select: { userId: true },
    });

    if (!form || form.userId !== userId) {
      throw new BadRequestException('Not authorized');
    }

    const keys = body.keys || [];
    return { ok: true, confirmed: keys.length };
  }

  @Post('public/:slug/upload')
  @ApiOperation({ summary: 'Upload files for public form (no auth required)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: async (req, file, cb) => {
          const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

          // We need to get formId from slug, but we can't use await here
          // So we'll use a temporary folder based on slug
          const uploadPath = join(
            process.cwd(),
            'uploads',
            'forms',
            'temp',
            slug,
          );

          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/svg+xml',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ];

        // Check for image types more flexibly
        const isImage = file.mimetype.startsWith('image/');
        if (allowedMimes.includes(file.mimetype) || isImage) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Allowed: images, PDF, Word, and text files.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFilesPublic(
    @Param('slug') slug: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Verify form exists
    const form = await this.prisma.form.findUnique({
      where: { slug },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    if (form.status !== 'PUBLISHED') {
      throw new BadRequestException('Form is not accepting submissions');
    }

    const uploadedFiles = files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/forms/temp/${slug}/${file.filename}`,
      url: `${process.env.API_URL || 'http://localhost:3001'}/uploads/forms/temp/${slug}/${file.filename}`,
    }));

    return {
      success: true,
      files: uploadedFiles,
    };
  }
}
