import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../core/common/guards/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/common/guards/roles.guard';
import { Roles } from '../../../core/common/decorators/auth/roles.decorator';
import { Role } from '@prisma/client';
import { WallpapersService } from './wallpapers.service';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Controller('admin/wallpapers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class WallpapersController {
  constructor(private readonly wallpapersService: WallpapersService) {}

  @Get()
  findAll() {
    return this.wallpapersService.findAll();
  }

  /** Upload wallpaper file through server → S3, then create DB record */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only images and videos are allowed'), false);
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('nameAr') nameAr?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.wallpapersService.uploadAndCreate(file, nameAr);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { nameAr?: string; isActive?: boolean; sortOrder?: number },
  ) {
    return this.wallpapersService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.wallpapersService.delete(id);
  }
}
