import {
  Controller,
  Post,
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
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { UploadService } from './upload.service';
import { UserService } from '../../domain/users/user.service';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private userService: UserService,
  ) {}

  @Post('avatar')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Max 3 uploads per minute
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: any, @Request() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Get user's current avatar
      const user = await this.userService.getProfile(req.user.id);
      const oldAvatar = user?.profile?.avatar;

      // Upload new avatar (includes all security validations)
      const avatarUrl = await this.uploadService.uploadAvatar(file);

      // Update user profile with new avatar
      await this.userService.updateProfile(req.user.id, { avatar: avatarUrl });

      // Delete old avatar if exists
      if (oldAvatar) {
        await this.uploadService.deleteAvatar(oldAvatar);
      }

      return {
        message: 'Avatar uploaded successfully',
        url: avatarUrl,
      };
    } catch (error) {
      // Re-throw BadRequestException as-is
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle other errors
      throw new BadRequestException(error.message || 'Failed to upload avatar');
    }
  }

  @Post('event-image')
  @ApiOperation({ summary: 'Upload event image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Max 5 uploads per minute
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for event images
      },
    }),
  )
  async uploadEventImage(@UploadedFile() file: any, @Request() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Upload event image (includes all security validations)
      const imageUrl = await this.uploadService.uploadEventImage(file);

      return {
        message: 'Event image uploaded successfully',
        url: imageUrl,
        path: imageUrl, // For backward compatibility
      };
    } catch (error) {
      // Re-throw BadRequestException as-is
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle other errors
      throw new BadRequestException(
        error.message || 'Failed to upload event image',
      );
    }
  }

  @Post('banners')
  @ApiOperation({ summary: 'Upload up to 3 banner images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('files', 3, {
      limits: { fileSize: 5 * 1024 * 1024 },
      storage: undefined,
    }),
  )
  async uploadBanners(
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    if (!files || files.length === 0)
      throw new BadRequestException('No files uploaded');
    try {
      const urls = await this.uploadService.uploadBanners(files, req.user.id);
      return { message: 'Banners uploaded', urls };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error.message || 'Failed to upload banners',
      );
    }
  }

  @Post('banners/delete')
  @ApiOperation({ summary: 'Delete banner images (by URL or key)' })
  async deleteBanners(@Body() body: { items: string[] }, @Request() req) {
    try {
      await this.uploadService.deleteBanners(body.items || []);
      return { ok: true };
    } catch (err) {
      throw new BadRequestException(err.message || 'Failed to delete banners');
    }
  }
}
