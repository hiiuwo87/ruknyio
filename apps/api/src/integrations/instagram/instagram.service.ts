import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma/prisma.service';

const IG_OAUTH_BASE = 'https://www.instagram.com/oauth/authorize';
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_LONG_LIVED_URL = 'https://graph.instagram.com/access_token';
const IG_REFRESH_URL = 'https://graph.instagram.com/refresh_access_token';
const IG_GRAPH_BASE = 'https://graph.instagram.com/v21.0';

@Injectable()
export class InstagramService {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;

  // Type workaround for monorepo Prisma type cache mismatch in editor.
  private get instagramConnectionModel(): any {
    return (this.prisma as any).instagramConnection;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.appId = this.config.get<string>('INSTAGRAM_APP_ID') ?? '';
    this.appSecret = this.config.get<string>('INSTAGRAM_APP_SECRET') ?? '';
    this.redirectUri = this.config.get<string>('INSTAGRAM_REDIRECT_URI') ?? '';
  }

  private ensureConfigured() {
    const missing: string[] = [];
    if (!this.appId) missing.push('INSTAGRAM_APP_ID');
    if (!this.appSecret) missing.push('INSTAGRAM_APP_SECRET');
    if (!this.redirectUri) missing.push('INSTAGRAM_REDIRECT_URI');

    if (missing.length > 0) {
      throw new BadRequestException(
        `Instagram integration is not configured. Missing: ${missing.join(', ')}`,
      );
    }
  }

  /** Build OAuth authorization URL */
  getAuthUrl(state: string): string {
    this.ensureConfigured();

    const scopes = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
      'instagram_business_content_publish',
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      state,
    });

    return `${IG_OAUTH_BASE}?${params.toString()}`;
  }

  /** Exchange code → short-lived token → long-lived token → save */
  async exchangeCodeAndSave(code: string, userId: string) {
    this.ensureConfigured();

    // 1. Short-lived token
    const formData = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code,
    });

    const shortRes = await fetch(IG_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!shortRes.ok) {
      const err = await shortRes.text();
      throw new BadRequestException(`Instagram token exchange failed: ${err}`);
    }

    const { access_token: shortToken, user_id: igUserId } = (await shortRes.json()) as {
      access_token: string;
      user_id: string;
    };

    // 2. Long-lived token
    const longParams = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.appSecret,
      access_token: shortToken,
    });

    const longRes = await fetch(
      `${IG_LONG_LIVED_URL}?${longParams.toString()}`,
    );

    if (!longRes.ok) {
      const err = await longRes.text();
      throw new BadRequestException(`Instagram long-lived token failed: ${err}`);
    }

    const {
      access_token: longToken,
      expires_in: expiresIn,
    } = (await longRes.json()) as {
      access_token: string;
      expires_in: number;
    };

    // 3. Fetch user profile
    const profileParams = new URLSearchParams({
      fields: 'username,name,profile_picture_url,followers_count',
      access_token: longToken,
    });

    const profileRes = await fetch(
      `${IG_GRAPH_BASE}/${igUserId}?${profileParams.toString()}`,
    );

    const profile = profileRes.ok
      ? ((await profileRes.json()) as {
          username?: string;
          name?: string;
          profile_picture_url?: string;
          followers_count?: number;
        })
      : {};

    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    // 4. Upsert connection
    await this.instagramConnectionModel.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: longToken,
        tokenExpiry,
        igUserId: String(igUserId),
        username: profile.username ?? '',
        name: profile.name ?? null,
        profilePicUrl: profile.profile_picture_url ?? null,
        followersCount: profile.followers_count ?? null,
      },
      update: {
        accessToken: longToken,
        tokenExpiry,
        igUserId: String(igUserId),
        username: profile.username ?? '',
        name: profile.name ?? null,
        profilePicUrl: profile.profile_picture_url ?? null,
        followersCount: profile.followers_count ?? null,
      },
    });

    return { success: true, username: profile.username };
  }

  /** Get current connection status for a user */
  async getConnection(userId: string) {
    const conn = await this.instagramConnectionModel.findUnique({
      where: { userId },
      select: {
        igUserId: true,
        username: true,
        name: true,
        profilePicUrl: true,
        followersCount: true,
        tokenExpiry: true,
        createdAt: true,
      },
    });
    return conn ?? null;
  }

  /** Refresh long-lived token (valid for 60 days, can refresh after 24h) */
  async refreshToken(userId: string) {
    const conn = await this.instagramConnectionModel.findUnique({
      where: { userId },
    });

    if (!conn) throw new NotFoundException('لا يوجد حساب Instagram مرتبط');

    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: conn.accessToken,
    });

    const res = await fetch(`${IG_REFRESH_URL}?${params.toString()}`);

    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`Token refresh failed: ${err}`);
    }

    const { access_token, expires_in } = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    await this.instagramConnectionModel.update({
      where: { userId },
      data: { accessToken: access_token, tokenExpiry },
    });

    return { success: true };
  }

  /** Disconnect Instagram account */
  async disconnect(userId: string) {
    await this.instagramConnectionModel.delete({
      where: { userId },
    });
    return { success: true };
  }

  /** Fetch recent media for a connected user */
  async getMedia(userId: string, limit = 12) {
    const conn = await this.instagramConnectionModel.findUnique({
      where: { userId },
    });
    if (!conn) throw new NotFoundException('لا يوجد حساب Instagram مرتبط');

    const params = new URLSearchParams({
      fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count',
      limit: String(limit),
      access_token: conn.accessToken,
    });

    const res = await fetch(
      `${IG_GRAPH_BASE}/${conn.igUserId}/media?${params.toString()}`,
    );

    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`Failed to fetch Instagram media: ${err}`);
    }

    return res.json();
  }

  // ─── Instagram Blocks ───────────────────────────────────────

  private get instagramBlockModel(): any {
    return (this.prisma as any).instagramBlock;
  }

  private get instagramGridLinkModel(): any {
    return (this.prisma as any).instagramGridLink;
  }

  /** Create an Instagram block (GRID or FEED) */
  async createBlock(userId: string, type: 'GRID' | 'FEED') {
    // Ensure user has Instagram connected
    const conn = await this.instagramConnectionModel.findUnique({
      where: { userId },
    });
    if (!conn) throw new BadRequestException('يجب ربط حساب إنستغرام أولاً');

    // Get max display order
    const maxOrder = await this.instagramBlockModel.aggregate({
      where: { userId },
      _max: { displayOrder: true },
    });

    return this.instagramBlockModel.create({
      data: {
        userId,
        type,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });
  }

  /** Get all instagram blocks for a user */
  async getBlocks(userId: string) {
    return this.instagramBlockModel.findMany({
      where: { userId },
      include: { gridLinks: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** Get active instagram blocks for a user (public profile) */
  async getActiveBlocks(userId: string) {
    return this.instagramBlockModel.findMany({
      where: { userId, isActive: true },
      include: { gridLinks: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** Delete an instagram block */
  async deleteBlock(userId: string, blockId: string) {
    const block = await this.instagramBlockModel.findFirst({
      where: { id: blockId, userId },
    });
    if (!block) throw new NotFoundException('البلوك غير موجود');

    await this.instagramBlockModel.delete({ where: { id: blockId } });
    return { success: true };
  }

  /** Toggle block active status */
  async toggleBlock(userId: string, blockId: string) {
    const block = await this.instagramBlockModel.findFirst({
      where: { id: blockId, userId },
    });
    if (!block) throw new NotFoundException('البلوك غير موجود');

    return this.instagramBlockModel.update({
      where: { id: blockId },
      data: { isActive: !block.isActive },
    });
  }

  /** Set/update a grid link for a specific media item */
  async setGridLink(
    userId: string,
    blockId: string,
    mediaId: string,
    linkUrl: string,
    linkTitle?: string,
  ) {
    // Verify block belongs to user
    const block = await this.instagramBlockModel.findFirst({
      where: { id: blockId, userId, type: 'GRID' },
    });
    if (!block) throw new NotFoundException('البلوك غير موجود');

    return this.instagramGridLinkModel.upsert({
      where: { blockId_mediaId: { blockId, mediaId } },
      create: { blockId, mediaId, linkUrl, linkTitle },
      update: { linkUrl, linkTitle },
    });
  }

  /** Remove a grid link */
  async removeGridLink(userId: string, blockId: string, mediaId: string) {
    const block = await this.instagramBlockModel.findFirst({
      where: { id: blockId, userId },
    });
    if (!block) throw new NotFoundException('البلوك غير موجود');

    await this.instagramGridLinkModel.deleteMany({
      where: { blockId, mediaId },
    });
    return { success: true };
  }

  /** Fetch media for public display (by profile userId, uses stored token) */
  async getPublicMedia(userId: string, limit = 12) {
    const conn = await this.instagramConnectionModel.findUnique({
      where: { userId },
    });
    if (!conn) return null;

    try {
      const params = new URLSearchParams({
        fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink',
        limit: String(limit),
        access_token: conn.accessToken,
      });

      const res = await fetch(
        `${IG_GRAPH_BASE}/${conn.igUserId}/media?${params.toString()}`,
      );

      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  /**
   * Connect Instagram manually using an existing access token.
   * Validates the token by fetching profile info from Graph API,
   * then exchanges it for a long-lived token and saves the connection.
   */
  async connectWithToken(accessToken: string, userId: string) {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new BadRequestException('Access Token مطلوب');
    }

    // 1. Validate the token by fetching the profile
    const profileParams = new URLSearchParams({
      fields: 'user_id,username,name,profile_picture_url,followers_count',
      access_token: accessToken,
    });

    const profileRes = await fetch(`${IG_GRAPH_BASE}/me?${profileParams.toString()}`);

    if (!profileRes.ok) {
      const errText = await profileRes.text();
      throw new BadRequestException(
        `Access Token غير صالح أو منتهي الصلاحية: ${errText}`,
      );
    }

    const profile = (await profileRes.json()) as {
      id?: string;
      user_id?: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
      followers_count?: number;
    };

    const igUserId = profile.id || profile.user_id;
    if (!igUserId) {
      throw new BadRequestException('لم يتم العثور على معرف المستخدم في الاستجابة');
    }

    // 2. Try to exchange for a long-lived token (if short-lived was provided)
    let longToken = accessToken;
    let expiresIn = 60 * 60 * 24 * 60; // default 60 days

    if (this.appSecret) {
      try {
        const longParams = new URLSearchParams({
          grant_type: 'ig_exchange_token',
          client_secret: this.appSecret,
          access_token: accessToken,
        });

        const longRes = await fetch(`${IG_LONG_LIVED_URL}?${longParams.toString()}`);
        if (longRes.ok) {
          const longData = (await longRes.json()) as {
            access_token: string;
            expires_in: number;
          };
          longToken = longData.access_token;
          expiresIn = longData.expires_in;
        }
      } catch {
        // If exchange fails, use the original token
      }
    }

    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    // 3. Upsert connection
    await this.instagramConnectionModel.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: longToken,
        tokenExpiry,
        igUserId: String(igUserId),
        username: profile.username ?? '',
        name: profile.name ?? null,
        profilePicUrl: profile.profile_picture_url ?? null,
        followersCount: profile.followers_count ?? null,
      },
      update: {
        accessToken: longToken,
        tokenExpiry,
        igUserId: String(igUserId),
        username: profile.username ?? '',
        name: profile.name ?? null,
        profilePicUrl: profile.profile_picture_url ?? null,
        followersCount: profile.followers_count ?? null,
      },
    });

    return { success: true, username: profile.username };
  }
}
