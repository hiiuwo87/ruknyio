import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { UploadModule } from '../../infrastructure/upload/upload.module';

// Social Links
import { SocialLinksController } from './social-links/social-links.controller';
import { SocialLinksService } from './social-links/social-links.service';

// Link Groups
import { LinkGroupsController } from './link-groups/link-groups.controller';
import { LinkGroupsService } from './link-groups/link-groups.service';

// URL Shortener
import { UrlShortenerController } from './url-shortener/url-shortener.controller';
import { UrlShortenerService } from './url-shortener/url-shortener.service';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [
    SocialLinksController,
    LinkGroupsController,
    UrlShortenerController,
  ],
  providers: [SocialLinksService, LinkGroupsService, UrlShortenerService],
  exports: [SocialLinksService, LinkGroupsService, UrlShortenerService],
})
export class LinksModule {}
