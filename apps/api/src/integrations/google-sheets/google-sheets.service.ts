import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

// Google Sheets cell character limit
const MAX_CELL_LENGTH = 50000;

/**
 * Truncate string to fit within Google Sheets cell limit
 * Adds indication when truncated
 */
function truncateCellValue(
  value: string,
  maxLength = MAX_CELL_LENGTH - 50,
): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.substring(0, maxLength) + '... [TRUNCATED - Content too long]';
}

/**
 * Safely process a cell value for Google Sheets
 * Handles base64, long strings, and objects
 */
function processCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    // Skip base64 data entirely
    if (value.startsWith('data:image/')) {
      return '[Signature - See original submission]';
    }
    if (value.startsWith('data:')) {
      return '[File - See original submission]';
    }
    // Truncate long strings
    return truncateCellValue(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const processed = value.map((item) => {
      if (typeof item === 'object' && item !== null) {
        // Extract URL if available
        if (item.webViewLink) return item.webViewLink;
        if (item.url) return item.url;
        if (item.secureUrl) return item.secureUrl;
        if (item.fileId) return `[File: ${item.fileId}]`;
        // Skip complex objects in arrays
        return '[Object]';
      }
      return typeof item === 'string'
        ? truncateCellValue(item, 1000)
        : String(item);
    });
    return truncateCellValue(processed.join(', '));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Extract URL if available
    if (obj.type === 'secure_file' && obj.webViewLink) {
      return String(obj.webViewLink);
    }
    if (obj.webViewLink || obj.url) {
      return String(obj.webViewLink || obj.url);
    }
    if (obj.secureUrl) {
      return String(obj.secureUrl);
    }
    if (obj.fileId) {
      return `[File: ${obj.fileId}]`;
    }
    // For other objects, stringify but truncate
    try {
      const json = JSON.stringify(obj);
      return truncateCellValue(json, 5000);
    } catch {
      return '[Complex Object]';
    }
  }

  return String(value);
}

@Injectable()
export class GoogleSheetsService {
  private oauth2Client;

  private emailService: EmailService;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.config.get('GOOGLE_SHEETS_CLIENT_ID') ||
        this.config.get('GOOGLE_CALENDAR_CLIENT_ID'),
      this.config.get('GOOGLE_SHEETS_CLIENT_SECRET') ||
        this.config.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
      this.config.get('GOOGLE_SHEETS_REDIRECT_URI') ||
        `${this.config.get('API_URL')}/integrations/google-sheets/callback`,
    );
  }

  setEmailService(emailService: EmailService) {
    this.emailService = emailService;
  }

  /**
   * Generate Google OAuth URL for Sheets authorization
   * @param formId - The form ID to connect
   * @param userId - The user ID
   * @param userEmail - Optional: User's email to auto-select Google account (login_hint)
   */
  getAuthUrl(formId: string, userId: string, userEmail?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ];

    // Encode state with formId and userId
    const state = Buffer.from(JSON.stringify({ formId, userId })).toString(
      'base64',
    );

    const authOptions: any = {
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    };

    // Add login_hint if user email is provided
    // This auto-selects the user's Google account without showing account picker
    if (userEmail) {
      authOptions.login_hint = userEmail;
    }

    return this.oauth2Client.generateAuthUrl(authOptions);
  }

  /**
   * Exchange authorization code for tokens and save integration
   */
  async exchangeCodeForTokens(code: string, state: string) {
    try {
      // Decode state
      const { formId, userId } = JSON.parse(
        Buffer.from(state, 'base64').toString(),
      );

      // Verify form belongs to user
      const form = await this.prisma.form.findFirst({
        where: { id: formId, userId },
        include: { user: { include: { profile: true } } },
      });

      if (!form) {
        throw new NotFoundException('النموذج غير موجود');
      }

      // Get tokens
      const { tokens } = await this.oauth2Client.getToken(code);

      // Create or update integration
      const integration = await this.prisma.formIntegration.upsert({
        where: {
          formId_type: { formId, type: 'google_sheets' },
        },
        create: {
          formId,
          type: 'google_sheets',
          name: `${form.title} - Google Sheets`,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          isActive: true,
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          isActive: true,
        },
      });

      // Send congratulation email
      if (this.emailService && form.user?.email) {
        try {
          const userName =
            form.user.profile?.name || form.user.email.split('@')[0] || 'User';
          await this.sendConnectionSuccessEmail(
            form.user.email,
            userName,
            form.title,
          );
        } catch (emailError) {
          console.error('Error sending connection success email:', emailError);
          // Don't throw - email failure shouldn't break the connection
        }
      }

      return {
        success: true,
        message: 'تم ربط Google Sheets بنجاح',
        integrationId: integration.id,
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new BadRequestException('فشل في ربط Google Sheets');
    }
  }

  /**
   * Send email on successful Google Sheets connection
   */
  private async sendConnectionSuccessEmail(
    email: string,
    userName: string,
    formTitle: string,
  ): Promise<void> {
    const subject = 'Google Sheets has been successfully linked – Rukny';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 400px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <!-- Logo -->
                <tr>
                  <td style="padding: 30px 30px 20px 30px;">
                    <span style="font-size: 24px; font-weight: bold; color: #1a1a1a;">Rukny</span>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 0 30px;">
                    <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.5;">
                     Hello ${userName},
                    </p>
                    <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 25px 0; line-height: 1.5;">
                      Google Sheets has been successfully linked – Rukny .
                    </p>
                  </td>
                </tr>
                
                <!-- Form Name Box -->
                <tr>
                  <td style="padding: 0 30px;">
                    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center;">
                      <span style="font-size: 18px; font-weight: 600; color: #166534;">${formTitle}</span>
                    </div>
                  </td>
                </tr>
                
                <!-- Info Text -->
                <tr>
                  <td style="padding: 25px 30px 10px 30px;">
                    <p style="font-size: 14px; color: #4b5563; margin: 0; line-height: 1.6;">
                      New responses will be synced automatically.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <p style="font-size: 14px; color: #9ca3af; margin: 0;">
                      Didn’t do this action? <a href="mailto:support@rukny.store" style="color: #6366f1; text-decoration: underline;">Contact us</a>.                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
                      Rukny © ${new Date().getFullYear()}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await this.emailService.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Refresh access token if expired
   */
  private async refreshAccessToken(integrationId: string): Promise<string> {
    const integration = await this.prisma.formIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration?.refreshToken) {
      throw new UnauthorizedException('لم يتم ربط Google Sheets');
    }

    // Check if token is expired or about to expire (5 minutes buffer)
    const now = new Date();
    if (integration.tokenExpiry) {
      const expiryWithBuffer = new Date(integration.tokenExpiry);
      expiryWithBuffer.setMinutes(expiryWithBuffer.getMinutes() - 5);

      if (now < expiryWithBuffer && integration.accessToken) {
        return integration.accessToken;
      }
    }

    // Refresh token
    this.oauth2Client.setCredentials({
      refresh_token: integration.refreshToken,
    });

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      await this.prisma.formIntegration.update({
        where: { id: integrationId },
        data: {
          accessToken: credentials.access_token,
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });

      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new UnauthorizedException(
        'فشل في تجديد صلاحية Google Sheets. الرجاء إعادة الربط',
      );
    }
  }

  /**
   * Get authenticated Sheets client
   */
  private async getSheetsClient(
    integrationId: string,
  ): Promise<sheets_v4.Sheets> {
    const accessToken = await this.refreshAccessToken(integrationId);

    this.oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return google.sheets({ version: 'v4', auth: this.oauth2Client });
  }

  /**
   * Create a new spreadsheet for form responses (or return existing one)
   */
  async createSpreadsheet(
    formId: string,
    userId: string,
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    if (!form) {
      throw new NotFoundException('النموذج غير موجود');
    }

    const integration = await this.prisma.formIntegration.findFirst({
      where: { formId, type: 'google_sheets', isActive: true },
    });

    if (!integration) {
      throw new BadRequestException(
        'لم يتم ربط Google Sheets. الرجاء الربط أولاً',
      );
    }

    // If spreadsheet already exists, return it
    if (integration.spreadsheetId && integration.spreadsheetUrl) {
      console.log('Spreadsheet already exists:', integration.spreadsheetId);
      return {
        spreadsheetId: integration.spreadsheetId,
        spreadsheetUrl: integration.spreadsheetUrl,
      };
    }

    console.log('Creating new spreadsheet for form:', form.title);
    const sheets = await this.getSheetsClient(integration.id);

    // Create spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `${form.title} - Responses`,
          locale: 'en_US',
        },
        sheets: [
          {
            properties: {
              title: 'Responses',
              rightToLeft: false,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

    // Get the actual sheet ID from the response
    const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId || 0;

    // Create headers in English
    const headers = [
      'Response #',
      'Submitted At',
      'Submitted By',
      ...form.fields.map((f) => f.label),
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Responses!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    // Format header row - use try/catch to not fail if formatting fails
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.66, blue: 0.33 }, // Google Sheets green
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields:
                  'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: headers.length,
                },
              },
            },
          ],
        },
      });
    } catch (formatError) {
      console.error('Error formatting header row:', formatError);
      // Continue anyway - data is more important than formatting
    }

    // Update integration with spreadsheet info
    await this.prisma.formIntegration.update({
      where: { id: integration.id },
      data: {
        spreadsheetId,
        spreadsheetUrl,
        sheetName: 'Responses',
      },
    });

    return { spreadsheetId, spreadsheetUrl };
  }

  /**
   * Export all existing submissions to spreadsheet
   */
  async exportSubmissions(
    formId: string,
    userId: string,
  ): Promise<{ count: number; spreadsheetUrl: string }> {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId },
      include: {
        fields: { orderBy: { order: 'asc' } },
        submissions: {
          orderBy: { createdAt: 'asc' },
          include: { user: { include: { profile: true } } },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('النموذج غير موجود');
    }

    let integration = await this.prisma.formIntegration.findFirst({
      where: { formId, type: 'google_sheets', isActive: true },
    });

    if (!integration) {
      throw new BadRequestException(
        'لم يتم ربط Google Sheets. الرجاء الربط أولاً',
      );
    }

    // Create spreadsheet if not exists
    let spreadsheetId = integration.spreadsheetId;
    if (!spreadsheetId) {
      console.log('Creating new spreadsheet for form:', formId);
      const result = await this.createSpreadsheet(formId, userId);
      spreadsheetId = result.spreadsheetId;
      // Refresh integration to get updated data
      integration = await this.prisma.formIntegration.findUnique({
        where: { id: integration.id },
      });
      console.log('Spreadsheet created:', spreadsheetId);
    }

    if (!spreadsheetId) {
      throw new BadRequestException('فشل في إنشاء جدول البيانات');
    }

    const sheets = await this.getSheetsClient(integration.id);

    // Prepare data rows
    const rows = form.submissions.map((submission, index) => {
      const responses = (submission.data || {}) as Record<string, any>;
      const submitterName =
        submission.user?.profile?.name || submission.user?.email || 'Anonymous';
      const row: (string | number)[] = [
        index + 1,
        new Date(submission.createdAt)
          .toISOString()
          .replace('T', ' ')
          .slice(0, 19),
        submitterName,
      ];

      form.fields.forEach((field) => {
        // Try multiple ways to find the value
        let value = responses[field.label] ?? responses[field.id] ?? '';

        // Also check if the field label is a key in the data
        if (value === '' || value === undefined || value === null) {
          // Try to find by iterating through keys
          for (const key of Object.keys(responses)) {
            if (key === field.label || key === field.id) {
              value = responses[key];
              break;
            }
          }
        }

        // Use safe cell value processor to handle all types and prevent exceeding 50k limit
        row.push(processCellValue(value));
      });

      return row;
    });

    console.log('Exporting rows to Google Sheets:', rows.length);
    console.log('Sample row:', rows[0]);
    console.log('Using spreadsheetId:', spreadsheetId);

    if (rows.length > 0) {
      // Clear existing data (except header)
      try {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: spreadsheetId,
          range: 'Responses!A2:ZZ',
        });
      } catch (clearError) {
        console.log('Clear failed (might be empty sheet):', clearError.message);
      }

      // Add new data
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'Responses!A2',
        valueInputOption: 'RAW',
        requestBody: {
          values: rows,
        },
      });

      console.log('Data exported successfully:', rows.length, 'rows');
    } else {
      console.log('No submissions to export');
    }

    // Update sync info
    await this.prisma.formIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        syncedCount: rows.length,
      },
    });

    return {
      count: rows.length,
      spreadsheetUrl: integration.spreadsheetUrl,
    };
  }

  /**
   * Add a single submission to spreadsheet (for auto-sync)
   */
  async addSubmissionToSheet(
    formId: string,
    submissionId: string,
  ): Promise<boolean> {
    try {
      const integration = await this.prisma.formIntegration.findFirst({
        where: {
          formId,
          type: 'google_sheets',
          isActive: true,
          isAutoSync: true,
        },
      });

      if (!integration?.spreadsheetId) {
        return false;
      }

      const form = await this.prisma.form.findUnique({
        where: { id: formId },
        include: { fields: { orderBy: { order: 'asc' } } },
      });

      const submission = await this.prisma.form_submissions.findUnique({
        where: { id: submissionId },
        include: { user: { include: { profile: true } } },
      });

      if (!form || !submission) {
        return false;
      }

      const sheets = await this.getSheetsClient(integration.id);

      // Use the form's submissionCount which was already atomically incremented
      // This avoids race conditions when multiple submissions happen simultaneously
      const responseNumber = form.submissionCount || 1;
      const submitterName =
        submission.user?.profile?.name || submission.user?.email || 'Anonymous';

      // Prepare row data
      const responses = (submission.data || {}) as Record<string, any>;
      const row: (string | number)[] = [
        responseNumber,
        new Date(submission.createdAt)
          .toISOString()
          .replace('T', ' ')
          .slice(0, 19),
        submitterName,
      ];

      form.fields.forEach((field) => {
        const value = responses[field.label] ?? responses[field.id] ?? '';

        // Use safe cell value processor to handle all types and prevent exceeding 50k limit
        row.push(processCellValue(value));
      });

      // Append row
      await sheets.spreadsheets.values.append({
        spreadsheetId: integration.spreadsheetId,
        range: 'Responses!A:A',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [row],
        },
      });

      // Update sync count
      await this.prisma.formIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          syncedCount: { increment: 1 },
        },
      });

      return true;
    } catch (error) {
      console.error('Error adding submission to sheet:', error);
      return false;
    }
  }

  /**
   * Get integration status for a form
   */
  async getIntegrationStatus(formId: string, userId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new NotFoundException('النموذج غير موجود');
    }

    const integration = await this.prisma.formIntegration.findFirst({
      where: { formId, type: 'google_sheets' },
    });

    if (!integration) {
      return {
        connected: false,
        spreadsheetUrl: null,
        lastSyncAt: null,
        syncedCount: 0,
        isAutoSync: false,
      };
    }

    return {
      connected: integration.isActive,
      spreadsheetId: integration.spreadsheetId,
      spreadsheetUrl: integration.spreadsheetUrl,
      lastSyncAt: integration.lastSyncAt,
      syncedCount: integration.syncedCount,
      isAutoSync: integration.isAutoSync,
    };
  }

  /**
   * Toggle auto-sync setting
   */
  async toggleAutoSync(formId: string, userId: string, enabled: boolean) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new NotFoundException('النموذج غير موجود');
    }

    const integration = await this.prisma.formIntegration.findFirst({
      where: { formId, type: 'google_sheets', isActive: true },
    });

    if (!integration) {
      throw new BadRequestException('لم يتم ربط Google Sheets');
    }

    await this.prisma.formIntegration.update({
      where: { id: integration.id },
      data: { isAutoSync: enabled },
    });

    return { success: true, isAutoSync: enabled };
  }

  /**
   * Disconnect Google Sheets integration
   */
  async disconnect(formId: string, userId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new NotFoundException('النموذج غير موجود');
    }

    await this.prisma.formIntegration.deleteMany({
      where: { formId, type: 'google_sheets' },
    });

    return { success: true, message: 'تم إلغاء ربط Google Sheets' };
  }

  /**
   * Create a new spreadsheet (force create even if one exists)
   */
  async createNewSpreadsheet(formId: string, userId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, userId },
    });

    if (!form) {
      throw new NotFoundException('النموذج غير موجود');
    }

    const integration = await this.prisma.formIntegration.findFirst({
      where: { formId, type: 'google_sheets', isActive: true },
    });

    if (!integration) {
      throw new BadRequestException(
        'لم يتم ربط Google Sheets. الرجاء ربط حسابك أولاً',
      );
    }

    // Clear existing spreadsheet info
    await this.prisma.formIntegration.update({
      where: { id: integration.id },
      data: {
        spreadsheetId: null,
        spreadsheetUrl: null,
        sheetName: null,
        syncedCount: 0,
        lastSyncAt: null,
      },
    });

    // Create new spreadsheet
    return this.createSpreadsheet(formId, userId);
  }

  /**
   * Reconnect with a different Google account
   */
  async getReconnectUrl(formId: string, userId: string): Promise<string> {
    // First disconnect the existing integration
    await this.disconnect(formId, userId);

    // Return new auth URL
    return this.getAuthUrl(formId, userId);
  }
}
