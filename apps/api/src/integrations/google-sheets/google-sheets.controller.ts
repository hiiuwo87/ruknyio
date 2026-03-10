import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GoogleSheetsService } from './google-sheets.service';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/common/decorators/auth/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('integrations/google-sheets')
export class GoogleSheetsController {
  constructor(
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get OAuth URL to connect Google Sheets
   * Uses login_hint to auto-select the user's Google account
   */
  @Get('connect/:formId')
  @UseGuards(JwtAuthGuard)
  getConnectUrl(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
  ) {
    // Pass user's email as login_hint to skip account selection
    const authUrl = this.googleSheetsService.getAuthUrl(formId, userId, userEmail);
    return { authUrl };
  }

  /**
   * OAuth callback - exchange code for tokens and export data
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      // First exchange code for tokens
      const result = await this.googleSheetsService.exchangeCodeForTokens(
        code,
        state,
      );

      // Decode state to get formId and userId
      const { formId, userId } = JSON.parse(
        Buffer.from(state, 'base64').toString(),
      );

      // Create spreadsheet and export data automatically
      try {
        await this.googleSheetsService.createSpreadsheet(formId, userId);
        await this.googleSheetsService.exportSubmissions(formId, userId);
      } catch (exportError) {
        console.error('Error creating spreadsheet or exporting:', exportError);
        // Continue anyway - the connection was successful
      }

      // Redirect to the form's responses page with success
      const frontendUrl =
        this.config.get('FRONTEND_URL') || 'http://localhost:3000';
      res.redirect(
        `${frontendUrl}/app/forms/${formId}/responses?sheets_connected=true`,
      );
    } catch (error) {
      console.error('Google Sheets callback error:', error);
      const frontendUrl =
        this.config.get('FRONTEND_URL') || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/app/forms?sheets_error=true`);
    }
  }

  /**
   * Get integration status for a form
   */
  @Get('status/:formId')
  @UseGuards(JwtAuthGuard)
  getStatus(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.googleSheetsService.getIntegrationStatus(formId, userId);
  }

  /**
   * Export all submissions to Google Sheets
   */
  @Post('export/:formId')
  @UseGuards(JwtAuthGuard)
  exportSubmissions(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.googleSheetsService.exportSubmissions(formId, userId);
  }

  /**
   * Create a new spreadsheet for the form
   */
  @Post('create-spreadsheet/:formId')
  @UseGuards(JwtAuthGuard)
  createSpreadsheet(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.googleSheetsService.createSpreadsheet(formId, userId);
  }

  /**
   * Toggle auto-sync setting
   */
  @Post('auto-sync/:formId')
  @UseGuards(JwtAuthGuard)
  toggleAutoSync(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.googleSheetsService.toggleAutoSync(formId, userId, enabled);
  }

  /**
   * Create a NEW spreadsheet (force create even if one exists)
   */
  @Post('new-spreadsheet/:formId')
  @UseGuards(JwtAuthGuard)
  createNewSpreadsheet(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.googleSheetsService.createNewSpreadsheet(formId, userId);
  }

  /**
   * Get URL to reconnect with a different Google account
   */
  @Get('reconnect/:formId')
  @UseGuards(JwtAuthGuard)
  getReconnectUrl(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.googleSheetsService
      .getReconnectUrl(formId, userId)
      .then((authUrl) => ({ authUrl }));
  }

  /**
   * Disconnect Google Sheets integration
   */
  @Delete('disconnect/:formId')
  @UseGuards(JwtAuthGuard)
  disconnect(
    @Param('formId') formId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.googleSheetsService.disconnect(formId, userId);
  }
}
