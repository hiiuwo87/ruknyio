import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
// S3Service, ImageProcessorService, UploadProgressService are provided by SharedModule (global)

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
