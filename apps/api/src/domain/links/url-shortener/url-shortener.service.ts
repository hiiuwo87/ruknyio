import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class UrlShortenerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Shorten a URL and return short URL
   */
  async shorten(
    url: string,
    userId?: string,
    expiresAt?: Date,
  ): Promise<string> {
    const code = await this.generateUniqueCode();
    const appUrl = process.env.APP_URL || 'http://localhost:3001';

    await this.prisma.short_urls.create({
      data: {
        id: crypto.randomUUID(),
        originalUrl: url,
        shortCode: code,
        userId,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    return `${appUrl}/s/${code}`;
  }

  /**
   * Generate unique short code (8 characters)
   */
  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let exists: boolean;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      if (attempts >= maxAttempts) {
        throw new Error(
          'Unable to generate unique short code after multiple attempts',
        );
      }

      // Generate random 8-character code
      code = crypto.randomBytes(4).toString('hex');

      const existing = await this.prisma.short_urls.findUnique({
        where: { shortCode: code },
      });

      exists = !!existing;
      attempts++;
    } while (exists);

    return code;
  }

  /**
   * Resolve short code to original URL
   */
  async resolve(code: string): Promise<string | null> {
    const shortUrl = await this.prisma.short_urls.findUnique({
      where: { shortCode: code },
    });

    if (!shortUrl) {
      return null;
    }

    // Check if expired
    if (shortUrl.expiresAt && shortUrl.expiresAt < new Date()) {
      return null;
    }

    // Increment click count asynchronously (fire and forget)
    this.prisma.short_urls
      .update({
        where: { id: shortUrl.id },
        data: { clicks: { increment: 1 } },
      })
      .catch((error) => {
        console.error('Failed to increment click count:', error);
      });

    return shortUrl.originalUrl;
  }

  /**
   * Get user's URL statistics
   */
  async getStats(userId: string) {
    const urls = await this.prisma.short_urls.findMany({
      where: { userId },
      select: {
        id: true,
        originalUrl: true,
        shortCode: true,
        clicks: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 URLs
    });

    const totalClicks = urls.reduce((sum, url) => sum + url.clicks, 0);
    const appUrl = process.env.APP_URL || 'http://localhost:3001';

    return {
      totalUrls: urls.length,
      totalClicks,
      urls: urls.map((url) => ({
        ...url,
        shortUrl: `${appUrl}/s/${url.shortCode}`,
        isExpired: url.expiresAt ? url.expiresAt < new Date() : false,
      })),
    };
  }

  /**
   * Get specific short URL stats
   */
  async getUrlStats(code: string, userId?: string) {
    const shortUrl = await this.prisma.short_urls.findUnique({
      where: { shortCode: code },
    });

    if (!shortUrl) {
      throw new NotFoundException('Short URL not found');
    }

    // Only owner can view stats
    if (userId && shortUrl.userId !== userId) {
      throw new NotFoundException('Short URL not found');
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3001';

    return {
      id: shortUrl.id,
      originalUrl: shortUrl.originalUrl,
      shortUrl: `${appUrl}/s/${shortUrl.shortCode}`,
      shortCode: shortUrl.shortCode,
      clicks: shortUrl.clicks,
      expiresAt: shortUrl.expiresAt,
      isExpired: shortUrl.expiresAt ? shortUrl.expiresAt < new Date() : false,
      createdAt: shortUrl.createdAt,
    };
  }

  /**
   * Delete short URL
   */
  async remove(code: string, userId: string) {
    const shortUrl = await this.prisma.short_urls.findUnique({
      where: { shortCode: code },
    });

    if (!shortUrl) {
      throw new NotFoundException('Short URL not found');
    }

    if (shortUrl.userId !== userId) {
      throw new NotFoundException('Short URL not found');
    }

    await this.prisma.short_urls.delete({
      where: { id: shortUrl.id },
    });

    return { message: 'Short URL deleted successfully' };
  }
}
