import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Request,
  Body,
  BadRequestException,
  Res,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '../../core/common/guards/auth/jwt-auth.guard';
import { GoogleDriveService } from './google-drive.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { memoryStorage } from 'multer';
import { Response } from 'express';

@ApiTags('Google Drive')
@Controller('integrations/google-drive')
export class GoogleDriveController {
  constructor(
    private googleDriveService: GoogleDriveService,
    private prisma: PrismaService,
  ) {}

  @Get('status/:formId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if Google Drive is connected for a form' })
  async getStatus(@Param('formId') formId: string, @Request() req) {
    // Verify form ownership
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId: req.user.id },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    const isConnected = await this.googleDriveService.isConnected(formId);

    return {
      connected: isConnected,
      formId,
    };
  }

  @Post('upload/:formId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload files to Google Drive for a form' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB
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
          'image/tiff',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
          'audio/mpeg',
          'audio/wav',
          'video/mp4',
        ];

        // Check for common types more flexibly
        const isImage = file.mimetype.startsWith('image/');
        const isAudio = file.mimetype.startsWith('audio/');
        const isVideo = file.mimetype.startsWith('video/');

        if (
          allowedMimes.includes(file.mimetype) ||
          isImage ||
          isAudio ||
          isVideo
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Allowed: images, PDF, documents, audio, and video files.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFiles(
    @Param('formId') formId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req,
  ) {
    // Verify form ownership
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId: req.user.id },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const result = await this.googleDriveService.uploadFile(formId, {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        });

        return {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          ...result,
        };
      }),
    );

    return {
      success: true,
      files: uploadedFiles,
    };
  }

  @Post('upload-public/:slug')
  @ApiOperation({
    summary: 'Upload files to Google Drive for public form submission',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB for public
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
    // Get form by slug
    const form = await this.prisma.form.findUnique({
      where: { slug },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    if (form.status !== 'PUBLISHED') {
      throw new BadRequestException('Form is not accepting submissions');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Helper function to safely convert buffer-like values to base64
    const bufferToBase64 = (buffer: Buffer | any): string => {
      try {
        if (Buffer.isBuffer(buffer)) {
          return buffer.toString('base64');
        }
        // Serialized Buffer: { type: 'Buffer', data: [...] }
        if (
          buffer &&
          typeof buffer === 'object' &&
          buffer.type === 'Buffer' &&
          Array.isArray(buffer.data)
        ) {
          return Buffer.from(buffer.data).toString('base64');
        }
        // Objects with a typed-array `data` property
        if (
          buffer &&
          typeof buffer === 'object' &&
          buffer.data &&
          ArrayBuffer.isView(buffer.data)
        ) {
          return Buffer.from(buffer.data as Uint8Array).toString('base64');
        }
        // Typed arrays / DataView
        if (ArrayBuffer.isView(buffer)) {
          return Buffer.from(buffer as unknown as Uint8Array).toString(
            'base64',
          );
        }
        // Raw ArrayBuffer
        if (buffer instanceof ArrayBuffer) {
          return Buffer.from(buffer).toString('base64');
        }
        // If it's already a string, return as-is (assume it's base64)
        if (typeof buffer === 'string') {
          return buffer;
        }

        // Plain object with numeric keys (JSON-serialized Buffer)
        if (
          buffer &&
          typeof buffer === 'object' &&
          buffer.constructor?.name === 'Object'
        ) {
          const keys = Object.keys(buffer);
          if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
            const byteArray = keys
              .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
              .map((k) => buffer[k]);
            return Buffer.from(byteArray).toString('base64');
          }
        }

        // Fallback: try to create Buffer from the object
        return Buffer.from(buffer).toString('base64');
      } catch (e) {
        console.error('Failed to convert buffer to base64:', e, {
          type: typeof buffer,
          constructorName: buffer?.constructor?.name,
          keys: buffer ? Object.keys(buffer) : [],
        });
        return '';
      }
    };

    // Check if Drive is connected
    const isConnected = await this.googleDriveService.isConnected(form.id);

    // If Drive is NOT connected, fallback to base64 so it can be stored locally
    if (!isConnected) {
      return {
        success: true,
        useLocalStorage: true,
        files: files.map((file) => {
          const base64Data = bufferToBase64(file.buffer);
          return {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            // Store as base64 for now (no Drive integration)
            data: `data:${file.mimetype};base64,${base64Data}`,
          };
        }),
      };
    }

    // If Drive IS connected, try to upload files directly to Google Drive now
    try {
      const uploadedFiles = await Promise.all(
        files.map(async (file) => {
          const result = await this.googleDriveService.uploadFile(form.id, {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          });

          return {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            fileId: result.fileId,
            webViewLink: result.webViewLink,
            webContentLink: result.webContentLink,
            thumbnailLink: result.thumbnailLink,
          };
        }),
      );

      return {
        success: true,
        useLocalStorage: false,
        files: uploadedFiles,
      };
    } catch (error) {
      // If Drive upload fails for any reason, log and gracefully fall back to base64
      console.error(
        'Public upload to Google Drive failed, falling back to base64:',
        error,
      );

      const fallbackFiles = files.map((file) => {
        const base64Data = bufferToBase64(file.buffer);
        return {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          data: base64Data
            ? `data:${file.mimetype};base64,${base64Data}`
            : undefined,
        };
      });

      return {
        success: true,
        // Frontend يمكنه استخدام useLocalStorage لمعرفة أن الملفات لم تُرفع إلى Drive
        useLocalStorage: true,
        message:
          'Failed to upload files to Google Drive, stored locally instead.',
        files: fallbackFiles,
      };
    }
  }

  @Post('signature/:formId')
  @ApiOperation({ summary: 'Upload signature to Google Drive' })
  async uploadSignature(
    @Param('formId') formId: string,
    @Body() body: { signature: string; submissionId?: string },
  ) {
    // Get form
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    // Check if Drive is connected
    const isConnected = await this.googleDriveService.isConnected(formId);

    if (!isConnected) {
      // Return the signature as-is (base64)
      return {
        success: true,
        useLocalStorage: true,
        signature: body.signature,
      };
    }

    // Upload to Drive
    const result = await this.googleDriveService.uploadSignature(
      formId,
      body.signature,
      body.submissionId || `sig_${Date.now()}`,
    );

    return {
      success: true,
      useLocalStorage: false,
      ...result,
    };
  }

  @Delete('file/:formId/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a file from Google Drive' })
  async deleteFile(
    @Param('formId') formId: string,
    @Param('fileId') fileId: string,
    @Request() req,
  ) {
    // Verify form ownership
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId: req.user.id },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    await this.googleDriveService.deleteFile(formId, fileId);

    return { success: true };
  }

  @Get('file/:formId/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get file info from Google Drive' })
  async getFileInfo(
    @Param('formId') formId: string,
    @Param('fileId') fileId: string,
    @Request() req,
  ) {
    // Verify form ownership
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId: req.user.id },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    const fileInfo = await this.googleDriveService.getFileInfo(formId, fileId);

    return fileInfo;
  }

  /**
   * SECURE FILE ACCESS - Proxy endpoint with authentication
   * This endpoint downloads the file from Drive and streams it to the user
   * Only authenticated form owners can access
   */
  @Get('secure/:formId/:fileId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Securely access a file with signed URL or authentication',
  })
  async getSecureFile(
    @Param('formId') formId: string,
    @Param('fileId') fileId: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() res: Response,
    @Request() req,
  ) {
    // Check if using signed URL (public temporary access)
    if (expires && sig) {
      const expiresTimestamp = parseInt(expires, 10);
      const isValid = this.googleDriveService.verifySignedUrl(
        formId,
        fileId,
        expiresTimestamp,
        sig,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid or expired signed URL');
      }
    } else {
      // Require authentication
      if (!req.user) {
        throw new UnauthorizedException('Authentication required');
      }

      // Verify form ownership or admin access
      const form = await this.prisma.form.findFirst({
        where: {
          id: formId,
          OR: [
            { userId: req.user.id },
            // Add more access rules here if needed (e.g., team members)
          ],
        },
      });

      if (!form) {
        throw new UnauthorizedException('Access denied');
      }
    }

    try {
      // Get file content from Drive
      const { buffer, mimeType, filename } =
        await this.googleDriveService.getFileContent(formId, fileId);

      // Set response headers
      res.set({
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'X-Content-Type-Options': 'nosniff',
      });

      // Send the file
      res.send(buffer);
    } catch (error) {
      throw new BadRequestException('Failed to retrieve file');
    }
  }

  /**
   * Generate a signed URL for temporary file access
   * Useful for sharing files temporarily without exposing Drive URL
   */
  @Get('signed-url/:formId/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a signed URL for temporary file access' })
  async getSignedUrl(
    @Param('formId') formId: string,
    @Param('fileId') fileId: string,
    @Query('expires') expiresMinutes: string,
    @Request() req,
  ) {
    // Verify form ownership
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId: req.user.id },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    const expiresIn = parseInt(expiresMinutes, 10) || 60; // Default 60 minutes
    const maxExpires = 24 * 60; // Max 24 hours
    const finalExpires = Math.min(expiresIn, maxExpires);

    const { url, expiresAt } = this.googleDriveService.generateSignedUrl(
      formId,
      fileId,
      finalExpires,
    );

    return {
      success: true,
      signedUrl: url,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: finalExpires,
    };
  }

  /**
   * Upload files PRIVATELY (no public access)
   * Files can only be accessed through the secure endpoint
   */
  @Post('upload-private/:formId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload files privately to Google Drive (no public access)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB
      },
    }),
  )
  async uploadFilesPrivate(
    @Param('formId') formId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req,
  ) {
    // Verify form ownership
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId: req.user.id },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const result = await this.googleDriveService.uploadFilePrivate(formId, {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        });

        // Generate signed URL for immediate access
        const { url, expiresAt } = this.googleDriveService.generateSignedUrl(
          formId,
          result.fileId,
          60, // 1 hour
        );

        return {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          fileId: result.fileId,
          secureUrl: url,
          expiresAt: expiresAt.toISOString(),
        };
      }),
    );

    return {
      success: true,
      isPrivate: true,
      files: uploadedFiles,
    };
  }

  /**
   * Upload signature PRIVATELY
   */
  @Post('signature-private/:formId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload signature privately to Google Drive' })
  async uploadSignaturePrivate(
    @Param('formId') formId: string,
    @Body() body: { signature: string; submissionId?: string },
    @Request() req,
  ) {
    // Verify form ownership or it's a submission
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    // Check if Drive is connected
    const isConnected = await this.googleDriveService.isConnected(formId);

    if (!isConnected) {
      return {
        success: true,
        useLocalStorage: true,
        signature: body.signature,
      };
    }

    const result = await this.googleDriveService.uploadSignaturePrivate(
      formId,
      body.signature,
      body.submissionId || `sig_${Date.now()}`,
    );

    // Generate signed URL for access
    const { url, expiresAt } = this.googleDriveService.generateSignedUrl(
      formId,
      result.fileId,
      60 * 24, // 24 hours for signatures
    );

    return {
      success: true,
      useLocalStorage: false,
      isPrivate: true,
      fileId: result.fileId,
      secureUrl: url,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
