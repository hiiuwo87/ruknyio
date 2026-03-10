import { Module } from '@nestjs/common';
import { UrlShortenerService } from './url-shortener.service';
import { UrlShortenerController } from './url-shortener.controller';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UrlShortenerController],
  providers: [UrlShortenerService],
  exports: [UrlShortenerService], // Export for use in SocialLinksModule
})
export class UrlShortenerModule {}
