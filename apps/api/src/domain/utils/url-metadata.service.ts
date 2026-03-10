import { Injectable, BadRequestException } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface UrlMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  type: string | null;
  favicon: string | null;
  domain: string;
}

@Injectable()
export class UrlMetadataService {
  // Timeout for fetch requests (5 seconds)
  private readonly FETCH_TIMEOUT = 5000;

  // Max content length to parse (1MB)
  private readonly MAX_CONTENT_LENGTH = 1024 * 1024;

  /**
   * Extract metadata from a URL
   */
  async extractMetadata(url: string): Promise<UrlMetadata> {
    const domain = this.extractDomain(url);

    // Default response
    const defaultMetadata: UrlMetadata = {
      url,
      title: null,
      description: null,
      image: null,
      siteName: null,
      type: null,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      domain,
    };

    try {
      // Special handling for known platforms
      const specialMetadata = await this.handleSpecialPlatforms(url, domain);
      if (specialMetadata) {
        return { ...defaultMetadata, ...specialMetadata };
      }

      // Fetch the URL with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.FETCH_TIMEOUT,
      );

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; RuknyBot/1.0; +https://rukny.io)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar,en;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml')
      ) {
        // Non-HTML content, return basic metadata
        return defaultMetadata;
      }

      // Check content length
      const contentLength = parseInt(
        response.headers.get('content-length') || '0',
        10,
      );
      if (contentLength > this.MAX_CONTENT_LENGTH) {
        throw new Error('Content too large');
      }

      const html = await response.text();
      const metadata = this.parseHtml(html, url, domain);

      return { ...defaultMetadata, ...metadata };
    } catch (error) {
      // Return default metadata on error
      console.error(`Failed to fetch metadata for ${url}:`, error.message);
      return defaultMetadata;
    }
  }

  /**
   * Parse HTML to extract metadata
   */
  private parseHtml(
    html: string,
    url: string,
    domain: string,
  ): Partial<UrlMetadata> {
    const $ = cheerio.load(html);

    // Extract Open Graph metadata (preferred)
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    const ogType = $('meta[property="og:type"]').attr('content');

    // Extract Twitter Card metadata (fallback)
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const twitterDescription = $('meta[name="twitter:description"]').attr(
      'content',
    );
    const twitterImage = $('meta[name="twitter:image"]').attr('content');

    // Extract standard metadata (final fallback)
    const htmlTitle = $('title').first().text();
    const metaDescription = $('meta[name="description"]').attr('content');

    // Extract favicon
    let favicon =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href');

    // Make favicon URL absolute
    if (favicon && !favicon.startsWith('http')) {
      const baseUrl = new URL(url);
      favicon = favicon.startsWith('/')
        ? `${baseUrl.origin}${favicon}`
        : `${baseUrl.origin}/${favicon}`;
    }

    // Make image URL absolute
    let image = ogImage || twitterImage;
    if (image && !image.startsWith('http')) {
      const baseUrl = new URL(url);
      image = image.startsWith('/')
        ? `${baseUrl.origin}${image}`
        : `${baseUrl.origin}/${image}`;
    }

    return {
      title: this.cleanText(ogTitle || twitterTitle || htmlTitle),
      description: this.cleanText(
        ogDescription || twitterDescription || metaDescription,
      ),
      image,
      siteName: ogSiteName || domain,
      type: ogType || 'website',
      favicon:
        favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    };
  }

  /**
   * Handle special platforms with API/oEmbed support
   */
  private async handleSpecialPlatforms(
    url: string,
    domain: string,
  ): Promise<Partial<UrlMetadata> | null> {
    const urlLower = url.toLowerCase();

    // YouTube
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return this.getYouTubeMetadata(url);
    }

    // TikTok
    if (domain.includes('tiktok.com')) {
      return this.getTikTokMetadata(url);
    }

    // Twitter/X
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      return this.getTwitterMetadata(url);
    }

    // Instagram
    if (domain.includes('instagram.com')) {
      return this.getInstagramMetadata(url);
    }

    return null;
  }

  /**
   * Get YouTube video metadata using oEmbed
   */
  private async getYouTubeMetadata(url: string): Promise<Partial<UrlMetadata>> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(oembedUrl);

      if (!response.ok) throw new Error('oEmbed failed');

      const data = await response.json();

      // Extract video ID for thumbnail
      const videoId = this.extractYouTubeVideoId(url);
      const thumbnail = videoId
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        : data.thumbnail_url;

      return {
        title: data.title,
        description: `فيديو من ${data.author_name}`,
        image: thumbnail,
        siteName: 'YouTube',
        type: 'video',
      };
    } catch {
      return {
        siteName: 'YouTube',
        type: 'video',
      };
    }
  }

  /**
   * Extract YouTube video ID from URL
   */
  private extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Get TikTok metadata using oEmbed
   */
  private async getTikTokMetadata(url: string): Promise<Partial<UrlMetadata>> {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl);

      if (!response.ok) throw new Error('oEmbed failed');

      const data = await response.json();

      return {
        title: data.title || `فيديو من ${data.author_name}`,
        description: data.title,
        image: data.thumbnail_url,
        siteName: 'TikTok',
        type: 'video',
      };
    } catch {
      return {
        siteName: 'TikTok',
        type: 'video',
      };
    }
  }

  /**
   * Get Twitter/X metadata (basic - no API key required)
   */
  private async getTwitterMetadata(url: string): Promise<Partial<UrlMetadata>> {
    // Twitter doesn't have public oEmbed, return basic info
    const usernameMatch = url.match(
      /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i,
    );
    const username = usernameMatch ? usernameMatch[1] : null;

    return {
      title: username ? `@${username} على X` : 'منشور على X',
      siteName: 'X (Twitter)',
      type: 'article',
    };
  }

  /**
   * Get Instagram metadata (basic)
   */
  private async getInstagramMetadata(
    url: string,
  ): Promise<Partial<UrlMetadata>> {
    const usernameMatch = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
    const username = usernameMatch ? usernameMatch[1] : null;

    // Check if it's a reel/post
    const isReel = url.includes('/reel/') || url.includes('/reels/');
    const isPost = url.includes('/p/');

    let title = 'صفحة على Instagram';
    if (isReel) title = 'ريل على Instagram';
    else if (isPost) title = 'منشور على Instagram';
    else if (username && !['reel', 'reels', 'p'].includes(username)) {
      title = `@${username} على Instagram`;
    }

    return {
      title,
      siteName: 'Instagram',
      type: isReel || isPost ? 'video' : 'profile',
    };
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * Clean and trim text
   */
  private cleanText(text: string | undefined | null): string | null {
    if (!text) return null;
    return text.trim().replace(/\s+/g, ' ').slice(0, 500);
  }
}
