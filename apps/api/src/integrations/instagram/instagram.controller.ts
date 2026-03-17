import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InstagramService } from './instagram.service';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';

@Controller('integrations/instagram')
export class InstagramController {
  private readonly frontendUrl: string;

  constructor(
    private readonly instagramService: InstagramService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('FRONTEND_URL_DEV') ||
      'http://localhost:3000';
  }

  /**
   * Start Instagram OAuth flow
   * GET /api/v1/integrations/instagram/auth
   */
  @Get('auth')
  @UseGuards(JwtAuthGuard)
  async authorize(@Req() req: any, @Res() res: Response) {
    const state = Buffer.from(req.user.id).toString('base64url');
    const authUrl = this.instagramService.getAuthUrl(state);
    return res.redirect(authUrl);
  }

  /**
   * OAuth callback — Instagram redirects here with code
   * GET /api/v1/integrations/instagram/callback?code=xxx&state=xxx
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const redirectBase = `${this.frontendUrl}/app/links`;

    if (error || !code) {
      return res.redirect(`${redirectBase}?instagram=error&reason=${error ?? 'no_code'}`);
    }

    try {
      const userId = Buffer.from(state, 'base64url').toString('utf8');
      const result = await this.instagramService.exchangeCodeAndSave(code, userId);
      return res.redirect(
        `${redirectBase}?instagram=success&username=${result.username}`,
      );
    } catch (err: any) {
      console.error('[Instagram OAuth callback error]', err?.message);
      return res.redirect(`${redirectBase}?instagram=error&reason=server`);
    }
  }

  /**
   * Get current Instagram connection status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    const connection = await this.instagramService.getConnection(req.user.id);
    return { connected: !!connection, connection };
  }

  /**
   * Refresh long-lived token
   */
  @Get('refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@Req() req: any) {
    return this.instagramService.refreshToken(req.user.id);
  }

  /**
   * Fetch recent media
   */
  @Get('media')
  @UseGuards(JwtAuthGuard)
  async getMedia(@Req() req: any, @Query('limit') limit?: string) {
    return this.instagramService.getMedia(req.user.id, limit ? parseInt(limit, 10) : 12);
  }

  /**
   * Disconnect Instagram account
   */
  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: any) {
    return this.instagramService.disconnect(req.user.id);
  }

  /**
   * Instagram deauthorize callback (required by Facebook)
   * POST /api/v1/integrations/instagram/deauthorize
   */
  @Post('deauthorize')
  @HttpCode(HttpStatus.OK)
  async deauthorize(@Body() body: { signed_request?: string }) {
    // Facebook sends a signed_request when user removes the app
    return { success: true };
  }

  /**
   * Data deletion request callback (required by Facebook)
   * POST /api/v1/integrations/instagram/data-deletion
   */
  @Post('data-deletion')
  @HttpCode(HttpStatus.OK)
  async dataDeletion(@Body() body: { signed_request?: string }) {
    // Acknowledge data deletion request
    return {
      url: `${this.frontendUrl}/privacy`,
      confirmation_code: `del_${Date.now()}`,
    };
  }

  /**
   * Manual connect with access token
   * POST /api/v1/integrations/instagram/manual-connect
   */
  @Post('manual-connect')
  @UseGuards(JwtAuthGuard)
  async manualConnect(
    @Req() req: any,
    @Body('accessToken') accessToken: string,
  ) {
    return this.instagramService.connectWithToken(accessToken, req.user.id);
  }

  // ─── Block endpoints ─────────────────────────────────────

  /**
   * Create an Instagram block (GRID or FEED)
   */
  @Post('blocks')
  @UseGuards(JwtAuthGuard)
  async createBlock(
    @Req() req: any,
    @Body('type') type: 'GRID' | 'FEED',
  ) {
    return this.instagramService.createBlock(req.user.id, type);
  }

  /**
   * Get all blocks for current user
   */
  @Get('blocks')
  @UseGuards(JwtAuthGuard)
  async getBlocks(@Req() req: any) {
    return this.instagramService.getBlocks(req.user.id);
  }

  /**
   * Get public blocks for a user (by userId)
   */
  @Get('blocks/public/:userId')
  async getPublicBlocks(@Param('userId') userId: string) {
    const blocks = await this.instagramService.getActiveBlocks(userId);
    const media = await this.instagramService.getPublicMedia(userId);
    return { blocks, media };
  }

  /**
   * Toggle block active state
   */
  @Patch('blocks/:blockId/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleBlock(@Req() req: any, @Param('blockId') blockId: string) {
    return this.instagramService.toggleBlock(req.user.id, blockId);
  }

  /**
   * Delete a block
   */
  @Delete('blocks/:blockId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteBlock(@Req() req: any, @Param('blockId') blockId: string) {
    return this.instagramService.deleteBlock(req.user.id, blockId);
  }

  /**
   * Set a grid link for a media item inside a GRID block
   */
  @Post('blocks/:blockId/grid-links')
  @UseGuards(JwtAuthGuard)
  async setGridLink(
    @Req() req: any,
    @Param('blockId') blockId: string,
    @Body() body: { mediaId: string; linkUrl: string; linkTitle?: string },
  ) {
    return this.instagramService.setGridLink(
      req.user.id,
      blockId,
      body.mediaId,
      body.linkUrl,
      body.linkTitle,
    );
  }

  /**
   * Remove a grid link
   */
  @Delete('blocks/:blockId/grid-links/:mediaId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeGridLink(
    @Req() req: any,
    @Param('blockId') blockId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.instagramService.removeGridLink(req.user.id, blockId, mediaId);
  }
}
