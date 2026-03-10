import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFiles,
  Req,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Get user's banners as presigned URLs (for private S3 buckets)
   */
  @Get('banners')
  async getBanners(@Req() req) {
    const userId = req.user?.id;
    return this.uploadService.getBannerUrls(userId);
  }

  @Post('banners')
  @UseInterceptors(
    FilesInterceptor('files', Number(process.env.S3_UPLOAD_MAX_FILES || 3), {
      storage: memoryStorage(),
    }),
  )
  async uploadBanners(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
  ) {
    const userId = req.user?.id;
    return this.uploadService.uploadBanners(userId, files);
  }

  @Post('banners/presign')
  async presign(
    @Body() body: { files: { name: string; type: string; size: number }[] },
    @Req() req,
  ) {
    const userId = req.user?.id;
    return this.uploadService.generatePresignedUrls(userId, body.files || []);
  }

  @Post('banners/confirm')
  async confirm(@Body() body: { keys: string[] }, @Req() req) {
    const userId = req.user?.id;
    await this.uploadService.confirmKeys(userId, body.keys || []);
    return { ok: true };
  }

  @Delete('banners')
  async deleteBanners(
    @Body() body: { keys?: string[]; items?: string[] },
    @Req() req,
  ) {
    return this.handleDeleteBanners(body, req);
  }

  @Post('banners/delete')
  async deleteBannersPost(
    @Body() body: { keys?: string[]; items?: string[] },
    @Req() req,
  ) {
    return this.handleDeleteBanners(body, req);
  }

  private async handleDeleteBanners(
    body: { keys?: string[]; items?: string[] },
    req: any,
  ) {
    const keysToDelete = body.keys || body.items || [];
    if (keysToDelete.length === 0) {
      return { ok: true, deleted: 0 };
    }

    // Also remove from user's bannerUrls in DB
    const userId = req.user?.id;
    if (userId) {
      const user = await this.uploadService['prisma'].user.findUnique({
        where: { id: userId },
        select: { bannerUrls: true },
      });
      const existingKeys: string[] = user?.bannerUrls || [];
      const remainingKeys = existingKeys.filter(
        (k) => !keysToDelete.includes(k),
      );
      await this.uploadService['prisma'].user.update({
        where: { id: userId },
        data: { bannerUrls: remainingKeys },
        select: { id: true, bannerUrls: true }, // Only return necessary fields
      });
    }

    await this.uploadService.deleteKeys(keysToDelete);
    return { ok: true, deleted: keysToDelete.length };
  }
}

export default UploadController;
