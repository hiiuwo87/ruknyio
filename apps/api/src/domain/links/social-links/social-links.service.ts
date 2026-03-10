import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
  ReorderLinksDto,
  BulkUpdateStatusDto,
  BulkMoveToGroupDto,
  BulkDeleteDto,
} from './dto';
import { UrlShortenerService } from '../url-shortener/url-shortener.service';

@Injectable()
export class SocialLinksService {
  constructor(
    private prisma: PrismaService,
    private urlShortener: UrlShortenerService,
  ) {}

  /**
   * Create a new social link
   */
  async create(userId: string, createDto: CreateSocialLinkDto) {
    // Get user's profile
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please create a profile first.',
      );
    }

    // Generate short URL for the social link
    const shortUrl = await this.urlShortener.shorten(createDto.url, userId);

    // Get the current max display order
    const maxOrder = await this.prisma.socialLink.findFirst({
      where: { profileId: profile.id },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    const displayOrder =
      createDto.displayOrder ?? (maxOrder?.displayOrder ?? -1) + 1;

    return this.prisma.socialLink.create({
      data: {
        ...createDto,
        profileId: profile.id,
        shortUrl,
        displayOrder,
      },
    });
  }

  /**
   * Find all social links for a profile
   */
  async findByProfile(profileId: string) {
    return this.prisma.socialLink.findMany({
      where: { profileId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Find all social links for current user
   * ⚡ Performance: Combined query to avoid N+1
   */
  async findMyLinks(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        socialLinks: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile.socialLinks;
  }

  /**
   * Find a single social link
   */
  async findOne(linkId: string) {
    const link = await this.prisma.socialLink.findUnique({
      where: { id: linkId },
      include: {
        profile: {
          select: {
            userId: true,
            username: true,
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Social link not found');
    }

    return link;
  }

  /**
   * Update a social link
   */
  async update(userId: string, linkId: string, updateDto: UpdateSocialLinkDto) {
    const link = await this.prisma.socialLink.findUnique({
      where: { id: linkId },
      include: { profile: true },
    });

    if (!link) {
      throw new NotFoundException('Social link not found');
    }

    if (link.profile.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this link',
      );
    }

    // If URL changed, generate new short URL
    let shortUrl = link.shortUrl;
    if (updateDto.url && updateDto.url !== link.url) {
      shortUrl = await this.urlShortener.shorten(updateDto.url, userId);
    }

    return this.prisma.socialLink.update({
      where: { id: linkId },
      data: {
        ...updateDto,
        shortUrl,
      },
    });
  }

  /**
   * Delete a social link
   */
  async remove(userId: string, linkId: string) {
    const link = await this.prisma.socialLink.findUnique({
      where: { id: linkId },
      include: { profile: true },
    });

    if (!link) {
      throw new NotFoundException('Social link not found');
    }

    if (link.profile.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this link',
      );
    }

    await this.prisma.socialLink.delete({
      where: { id: linkId },
    });

    return { message: 'Social link deleted successfully' };
  }

  /**
   * Reorder social links
   * ⚡ Performance: Combined query to verify ownership
   */
  async reorder(userId: string, reorderDto: ReorderLinksDto) {
    // Combined query: get profile with links count verification
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        id: true,
        socialLinks: {
          where: { id: { in: reorderDto.linkIds } },
          select: { id: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.socialLinks.length !== reorderDto.linkIds.length) {
      throw new BadRequestException(
        'Some link IDs are invalid or do not belong to you',
      );
    }

    // Update display order for each link
    const updates = reorderDto.linkIds.map((linkId, index) =>
      this.prisma.socialLink.update({
        where: { id: linkId },
        data: { displayOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return {
      message: 'Links reordered successfully',
      order: reorderDto.linkIds,
    };
  }

  /**
   * Get social link click statistics
   */
  async getLinkStats(userId: string, linkId: string) {
    const link = await this.prisma.socialLink.findUnique({
      where: { id: linkId },
      include: { profile: true },
    });

    if (!link) {
      throw new NotFoundException('Social link not found');
    }

    if (link.profile.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to view these statistics',
      );
    }

    // Get short URL stats
    if (link.shortUrl) {
      const shortCode = link.shortUrl.split('/').pop();
      if (shortCode) {
        const stats = await this.urlShortener.getUrlStats(shortCode, userId);
        return {
          ...link,
          stats,
        };
      }
    }

    return {
      ...link,
      stats: null,
    };
  }

  // ============= BULK ACTIONS METHODS =============

  /**
   * Bulk update status for multiple links
   */
  async bulkUpdateStatus(userId: string, dto: BulkUpdateStatusDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Verify all links belong to the user
    const links = await this.prisma.socialLink.findMany({
      where: {
        id: { in: dto.linkIds },
        profileId: profile.id,
      },
    });

    if (links.length !== dto.linkIds.length) {
      throw new BadRequestException(
        'Some links do not belong to you or do not exist',
      );
    }

    // Update all links
    await this.prisma.socialLink.updateMany({
      where: {
        id: { in: dto.linkIds },
        profileId: profile.id,
      },
      data: {
        status: dto.status,
      },
    });

    return {
      message: `Successfully updated ${dto.linkIds.length} links`,
      count: dto.linkIds.length,
    };
  }

  /**
   * Bulk move links to a group
   */
  async bulkMoveToGroup(userId: string, dto: BulkMoveToGroupDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // If groupId is provided, verify it exists and belongs to user
    if (dto.groupId) {
      const group = await this.prisma.linkGroup.findFirst({
        where: {
          id: dto.groupId,
          profileId: profile.id,
        },
      });

      if (!group) {
        throw new NotFoundException(
          'Group not found or does not belong to you',
        );
      }
    }

    // Verify all links belong to the user
    const links = await this.prisma.socialLink.findMany({
      where: {
        id: { in: dto.linkIds },
        profileId: profile.id,
      },
    });

    if (links.length !== dto.linkIds.length) {
      throw new BadRequestException(
        'Some links do not belong to you or do not exist',
      );
    }

    // Update all links
    await this.prisma.socialLink.updateMany({
      where: {
        id: { in: dto.linkIds },
        profileId: profile.id,
      },
      data: {
        groupId: dto.groupId,
      },
    });

    return {
      message: `Successfully moved ${dto.linkIds.length} links`,
      count: dto.linkIds.length,
      groupId: dto.groupId,
    };
  }

  /**
   * Bulk delete links
   */
  async bulkDelete(userId: string, dto: BulkDeleteDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Verify all links belong to the user
    const links = await this.prisma.socialLink.findMany({
      where: {
        id: { in: dto.linkIds },
        profileId: profile.id,
      },
    });

    if (links.length !== dto.linkIds.length) {
      throw new BadRequestException(
        'Some links do not belong to you or do not exist',
      );
    }

    // Delete all links
    await this.prisma.socialLink.deleteMany({
      where: {
        id: { in: dto.linkIds },
        profileId: profile.id,
      },
    });

    return {
      message: `Successfully deleted ${dto.linkIds.length} links`,
      count: dto.linkIds.length,
    };
  }

  // ============= PUBLIC TRACKING METHOD =============

  /**
   * Track a click on a social link (public - no auth required)
   * This increments the totalClicks counter and records analytics
   */
  async trackClick(
    linkId: string,
    trackingData: {
      userAgent: string;
      referer: string;
      ip: string;
    },
  ) {
    const link = await this.prisma.socialLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException('Social link not found');
    }

    // Parse user agent to extract device, browser, and OS
    const UAParser = require('ua-parser-js');
    const parser = new UAParser(trackingData.userAgent);
    const result = parser.getResult();

    const device = result.device.type || 'desktop';
    const browser = result.browser.name || 'unknown';
    const os = result.os.name || 'unknown';

    // Increment views counter
    await this.prisma.socialLink.update({
      where: { id: linkId },
      data: {
        views: {
          increment: 1,
        },
        totalClicks: {
          increment: 1,
        },
      },
    });

    // Record analytics (daily aggregation)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to find existing analytics record for today
    const existingAnalytics = await this.prisma.link_analytics.findFirst({
      where: {
        linkId,
        date: today,
        device,
        browser,
        os,
      },
    });

    if (existingAnalytics) {
      // Update existing record
      await this.prisma.link_analytics.update({
        where: { id: existingAnalytics.id },
        data: {
          clicks: {
            increment: 1,
          },
        },
      });
    } else {
      // Create new analytics record
      await this.prisma.link_analytics.create({
        data: {
          id: randomUUID(),
          linkId,
          date: today,
          clicks: 1,
          device,
          browser,
          os,
          referrer: trackingData.referer,
        },
      });
    }

    return {
      success: true,
      message: 'Click tracked successfully',
    };
  }
}
