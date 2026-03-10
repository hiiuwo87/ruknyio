import { Module } from '@nestjs/common';
import { SocialLinksService } from './social-links.service';
import { SocialLinksController } from './social-links.controller';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';
import { UrlShortenerModule } from '../url-shortener/url-shortener.module';
import { UploadModule } from '../../../infrastructure/upload/upload.module';

@Module({
  imports: [PrismaModule, UrlShortenerModule, UploadModule],
  controllers: [SocialLinksController],
  providers: [SocialLinksService],
  exports: [SocialLinksService],
})
export class SocialLinksModule {}
