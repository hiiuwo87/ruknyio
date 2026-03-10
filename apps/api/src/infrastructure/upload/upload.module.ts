import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UserModule } from '../../domain/users/user.module';
import { S3Service } from '../../services/s3.service';
import { PrismaModule } from '../../core/database/prisma/prisma.module';

@Module({
  imports: [UserModule, PrismaModule],
  controllers: [UploadController],
  providers: [UploadService, S3Service],
  exports: [UploadService, S3Service],
})
export class UploadModule {}
