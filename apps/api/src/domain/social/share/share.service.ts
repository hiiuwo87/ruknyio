import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { CustomQRDto, TrackShareDto, QRCodeFormat, SharePlatform } from './dto';
import * as QRCode from 'qrcode';

@Injectable()
export class ShareService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate QR code for profile
   */
  async generateProfileQR(
    username: string,
    format: QRCodeFormat = QRCodeFormat.PNG,
    size = 300,
  ) {
    // Check if profile exists
    const profile = await this.prisma.profile.findUnique({
      where: { username },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const url = `${process.env.FRONTEND_URL || 'https://rukny.io'}/@${username}`;

    return this.generateQRCode(url, format, size);
  }

  /**
   * Get share links for profile
   */
  async getProfileShareLinks(username: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { username },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const profileUrl = `${process.env.FRONTEND_URL || 'https://rukny.io'}/@${username}`;
    const encodedUrl = encodeURIComponent(profileUrl);
    const text = encodeURIComponent(`Check out ${username}'s profile on Rukny`);

    return {
      profileUrl,
      shareLinks: {
        whatsapp: `https://wa.me/?text=${text}%20${encodedUrl}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${text}`,
        twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        email: `mailto:?subject=${text}&body=${encodedUrl}`,
      },
    };
  }

  /**
   * Generate QR code for social link
   */
  async generateSocialLinkQR(
    linkId: string,
    format: QRCodeFormat = QRCodeFormat.PNG,
    size = 300,
  ) {
    const socialLink = await this.prisma.socialLink.findUnique({
      where: { id: linkId },
    });

    if (!socialLink) {
      throw new NotFoundException('Social link not found');
    }

    // Use the short URL if available, otherwise use the original URL
    const url = socialLink.shortUrl || socialLink.url;

    return this.generateQRCode(url, format, size);
  }

  /**
   * Generate custom QR code
   */
  async generateCustomQR(customQRDto: CustomQRDto) {
    return this.generateQRCode(
      customQRDto.url,
      customQRDto.format || QRCodeFormat.PNG,
      customQRDto.size || 300,
    );
  }

  /**
   * Track share action
   */
  async trackShare(trackShareDto: TrackShareDto) {
    // Verify profile exists
    const profile = await this.prisma.profile.findUnique({
      where: { id: trackShareDto.profileId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // If social link ID provided, verify it exists
    if (trackShareDto.socialLinkId) {
      const socialLink = await this.prisma.socialLink.findUnique({
        where: { id: trackShareDto.socialLinkId },
      });

      if (!socialLink) {
        throw new NotFoundException('Social link not found');
      }
    }

    // Store share tracking data (you can create a ShareTracking model)
    // For now, we'll return success
    // TODO: Add ShareTracking model to Prisma schema if detailed tracking needed

    return {
      message: 'Share tracked successfully',
      profileId: trackShareDto.profileId,
      platform: trackShareDto.platform,
      socialLinkId: trackShareDto.socialLinkId,
      timestamp: new Date(),
    };
  }

  /**
   * Get share statistics for profile
   */
  async getShareStats(profileId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Get all social links for this profile
    const socialLinks = await this.prisma.socialLink.findMany({
      where: { profileId },
    });

    // Get click stats for each social link's short URL
    const socialLinksStats = await Promise.all(
      socialLinks.map(async (link) => {
        if (!link.shortUrl) {
          return {
            id: link.id,
            platform: link.platform,
            url: link.url,
            clicks: 0,
            lastClickAt: null,
          };
        }

        // Extract short code from the shortUrl field
        const shortCode = link.shortUrl.split('/').pop();
        if (!shortCode) {
          return {
            id: link.id,
            platform: link.platform,
            url: link.url,
            clicks: 0,
            lastClickAt: null,
          };
        }

        const shortUrlData = await this.prisma.short_urls.findUnique({
          where: { shortCode },
        });

        return {
          id: link.id,
          platform: link.platform,
          url: link.url,
          clicks: shortUrlData?.clicks || 0,
          lastClickAt: shortUrlData?.updatedAt || null,
        };
      }),
    );

    // Calculate total clicks
    const totalClicks = socialLinksStats.reduce(
      (sum, link) => sum + link.clicks,
      0,
    );

    return {
      profileId: profile.id,
      username: profile.username,
      totalClicks,
      socialLinksCount: socialLinks.length,
      socialLinks: socialLinksStats,
    };
  }

  /**
   * Private helper to generate QR code
   */
  private async generateQRCode(
    url: string,
    format: QRCodeFormat,
    size: number,
  ) {
    const options = {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    };

    try {
      let qrData: string;

      switch (format) {
        case QRCodeFormat.SVG:
          qrData = await QRCode.toString(url, {
            ...options,
            type: 'svg',
          });
          break;

        case QRCodeFormat.JPEG:
          qrData = await QRCode.toDataURL(url, {
            ...options,
            type: 'image/jpeg',
          });
          break;

        case QRCodeFormat.PNG:
        default:
          qrData = await QRCode.toDataURL(url, {
            ...options,
            type: 'image/png',
          });
          break;
      }

      return {
        url,
        format,
        size,
        qrCode: qrData,
      };
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }
}
