import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from './google-calendar.service';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';

@Controller('google/calendar')
export class GoogleCalendarController {
  private readonly frontendUrl: string;

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || this.configService.get<string>('FRONTEND_URL_DEV') || 'http://localhost:3000';
  }

  /**
   * Start Google Calendar OAuth flow
   * GET /api/v1/google/calendar/auth?returnUrl=/app/events/create
   * Uses login_hint to auto-select the user's Google account
   */
  @Get('auth')
  @UseGuards(JwtAuthGuard)
  async authorize(@Req() req: any, @Query('returnUrl') returnUrl?: string) {
    // Encode returnUrl in state to redirect back after auth
    const state = returnUrl
      ? Buffer.from(returnUrl).toString('base64')
      : 'default';
    // Pass user's email as login_hint to skip account selection
    const userEmail = req.user?.email;
    const authUrl = this.googleCalendarService.getAuthUrl(state, userEmail);
    return {
      success: true,
      authUrl,
    };
  }

  /**
   * OAuth callback - receives authorization code
   * GET /api/v1/google/calendar/callback?code=xxx&state=xxx
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    // Decode returnUrl from state
    let returnUrl = '/app/events/create';
    if (state && state !== 'default') {
      try {
        returnUrl = Buffer.from(state, 'base64').toString('utf-8');
      } catch (e) {
        console.error('Error decoding state:', e);
      }
    }

    if (!code) {
      return res.redirect(
        `${this.frontendUrl}${returnUrl}?google_error=no_code`,
      );
    }

    try {
      // Redirect to frontend with code for exchange
      return res.redirect(
        `${this.frontendUrl}${returnUrl}?google_code=${code}`,
      );
    } catch (error) {
      console.error('OAuth callback error:', error);
      return res.redirect(
        `${this.frontendUrl}${returnUrl}?google_error=callback_failed`,
      );
    }
  }

  /**
   * Exchange authorization code for tokens
   * POST /api/v1/google/calendar/exchange
   */
  @Post('exchange')
  @UseGuards(JwtAuthGuard)
  async exchangeCode(@Req() req, @Query('code') code: string) {
    if (!code) {
      return {
        success: false,
        message: 'Authorization code is required',
      };
    }

    return this.googleCalendarService.exchangeCodeForTokens(code, req.user.id);
  }

  /**
   * Check if Google Calendar is linked
   * GET /api/v1/google/calendar/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req) {
    const isLinked = await this.googleCalendarService.isGoogleCalendarLinked(
      req.user.id,
    );
    return {
      success: true,
      linked: isLinked,
    };
  }

  /**
   * Create event in Google Calendar with Meet link
   * POST /api/v1/google/calendar/events/:eventId/create
   */
  @Post('events/:eventId/create')
  @UseGuards(JwtAuthGuard)
  async createEvent(@Req() req, @Param('eventId') eventId: string) {
    return this.googleCalendarService.createCalendarEvent(req.user.id, eventId);
  }

  /**
   * Update existing Google Calendar event
   * POST /api/v1/google/calendar/events/:eventId/update
   */
  @Post('events/:eventId/update')
  @UseGuards(JwtAuthGuard)
  async updateEvent(@Req() req, @Param('eventId') eventId: string) {
    return this.googleCalendarService.updateCalendarEvent(req.user.id, eventId);
  }

  /**
   * Delete Google Calendar event
   * DELETE /api/v1/google/calendar/events/:eventId
   */
  @Delete('events/:eventId')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(@Req() req, @Param('eventId') eventId: string) {
    return this.googleCalendarService.deleteCalendarEvent(req.user.id, eventId);
  }

  /**
   * Unlink Google Calendar from account
   * DELETE /api/v1/google/calendar/unlink
   */
  @Delete('unlink')
  @UseGuards(JwtAuthGuard)
  async unlinkCalendar(@Req() req) {
    return this.googleCalendarService.unlinkGoogleCalendar(req.user.id);
  }
}
