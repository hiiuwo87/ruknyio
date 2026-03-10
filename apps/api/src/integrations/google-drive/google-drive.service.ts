import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class GoogleDriveService {
  private oauth2Client;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.config.get('GOOGLE_SHEETS_CLIENT_ID') ||
        this.config.get('GOOGLE_CALENDAR_CLIENT_ID'),
      this.config.get('GOOGLE_SHEETS_CLIENT_SECRET') ||
        this.config.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
      this.config.get('GOOGLE_DRIVE_REDIRECT_URI') ||
        `${this.config.get('API_URL')}/integrations/google-drive/callback`,
    );
  }

  /**
   * Generate Google OAuth URL for Drive authorization
   * @param formId - The form ID
   * @param userId - The user ID
   * @param userEmail - Optional: User's email to auto-select Google account (login_hint)
   */
  getAuthUrl(formId: string, userId: string, userEmail?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ];

    const state = Buffer.from(
      JSON.stringify({ formId, userId, type: 'drive' }),
    ).toString('base64');

    const authOptions: any = {
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    };

    // Add login_hint if user email is provided
    if (userEmail) {
      authOptions.login_hint = userEmail;
    }

    return this.oauth2Client.generateAuthUrl(authOptions);
  }

  /**
   * Get authenticated Drive client for a form
   */
  private async getDriveClient(formId: string): Promise<drive_v3.Drive> {
    const integration = await this.prisma.formIntegration.findFirst({
      where: {
        formId,
        type: 'google_sheets', // We reuse the same integration since scopes include Drive
        isActive: true,
      },
    });

    if (!integration) {
      throw new UnauthorizedException(
        'Google Drive not connected for this form',
      );
    }

    // Check if token is expired and refresh if needed
    if (integration.tokenExpiry && new Date() >= integration.tokenExpiry) {
      if (!integration.refreshToken) {
        throw new UnauthorizedException(
          'Token expired and no refresh token available',
        );
      }

      this.oauth2Client.setCredentials({
        refresh_token: integration.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      await this.prisma.formIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: credentials.access_token,
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });

      this.oauth2Client.setCredentials(credentials);
    } else {
      this.oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
      });
    }

    return google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Upload a file to Google Drive (PRIVATE - no public access)
   * Files are only accessible through the secure proxy endpoint
   */
  async uploadFile(
    formId: string,
    file: {
      buffer: Buffer | any;
      originalname: string;
      mimetype: string;
    },
    submissionId?: string,
    folderId?: string,
  ): Promise<{
    fileId: string;
    webViewLink: string;
    webContentLink: string;
    thumbnailLink?: string;
  }> {
    try {
      const drive = await this.getDriveClient(formId);

      // Get or create form folder
      const formFolderId =
        folderId || (await this.getOrCreateFormFolder(drive, formId));

      // If submissionId is provided, create/get response subfolder
      let targetFolderId = formFolderId;
      if (submissionId) {
        targetFolderId = await this.getOrCreateResponseFolder(
          drive,
          formFolderId,
          submissionId,
        );
      }

      // Create file metadata
      const fileMetadata: drive_v3.Schema$File = {
        name: file.originalname,
        parents: [targetFolderId],
      };

      // Ensure we have a proper Buffer
      let fileBuffer: Buffer;
      const originalBuffer = (file as any).buffer;

      try {
        if (Buffer.isBuffer(originalBuffer)) {
          fileBuffer = originalBuffer;
        } else if (
          originalBuffer &&
          typeof originalBuffer === 'object' &&
          originalBuffer.type === 'Buffer' &&
          Array.isArray(originalBuffer.data)
        ) {
          // Handle serialized Buffer objects like { type: 'Buffer', data: [...] }
          fileBuffer = Buffer.from(originalBuffer.data);
        } else if (ArrayBuffer.isView(originalBuffer)) {
          // TypedArray / DataView
          fileBuffer = Buffer.from(originalBuffer as unknown as Uint8Array);
        } else if (originalBuffer instanceof ArrayBuffer) {
          fileBuffer = Buffer.from(originalBuffer);
        } else if (
          originalBuffer &&
          typeof originalBuffer === 'object' &&
          typeof originalBuffer.data !== 'undefined' &&
          ArrayBuffer.isView(originalBuffer.data)
        ) {
          // Objects that wrap a typed array in a `data` property
          fileBuffer = Buffer.from(originalBuffer.data as Uint8Array);
        } else if (typeof originalBuffer === 'string') {
          // Try to decode base64/string content
          try {
            fileBuffer = Buffer.from(originalBuffer, 'base64');
          } catch {
            fileBuffer = Buffer.from(originalBuffer);
          }
        } else if (
          originalBuffer &&
          typeof originalBuffer === 'object' &&
          originalBuffer.constructor?.name === 'Object'
        ) {
          // Plain object with numeric keys (JSON-serialized Buffer)
          // Check if keys are numeric strings like '0', '1', '2', ...
          const keys = Object.keys(originalBuffer);
          if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
            const byteArray = keys
              .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
              .map((k) => originalBuffer[k]);
            fileBuffer = Buffer.from(byteArray);
          } else {
            console.error(
              'Invalid file buffer passed to uploadFile, type:',
              typeof originalBuffer,
              {
                constructorName: originalBuffer?.constructor?.name,
                keys: keys.slice(0, 20),
              },
            );
            throw new BadRequestException('Invalid file buffer');
          }
        } else {
          console.error(
            'Invalid file buffer passed to uploadFile, type:',
            typeof originalBuffer,
            {
              constructorName: originalBuffer?.constructor?.name,
              keys: originalBuffer
                ? Object.keys(originalBuffer).slice(0, 20)
                : [],
            },
          );
          throw new BadRequestException('Invalid file buffer');
        }
      } catch (e) {
        console.error('Failed to normalize file buffer in uploadFile:', e);
        throw new BadRequestException('Invalid file buffer');
      }

      // Convert buffer to readable stream
      const bufferStream = Readable.from(fileBuffer);

      // Upload file (PRIVATE - no public permissions)
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: file.mimetype,
          body: bufferStream,
        },
        fields: 'id, webViewLink, webContentLink, thumbnailLink',
      });

      // ⚠️ SECURITY: No public permissions are added
      // Files are only accessible through the secure proxy endpoint:
      // GET /api/v1/integrations/google-drive/secure/:formId/:fileId

      return {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
        webContentLink:
          response.data.webContentLink || response.data.webViewLink,
        thumbnailLink: response.data.thumbnailLink,
      };
    } catch (error) {
      console.error('Error uploading to Google Drive:', error);
      throw new BadRequestException('Failed to upload file to Google Drive');
    }
  }

  /**
   * Upload a signature image (base64) to Google Drive
   */
  async uploadSignature(
    formId: string,
    signatureBase64: string,
    submissionId: string,
  ): Promise<{
    fileId: string;
    webViewLink: string;
    webContentLink: string;
  }> {
    try {
      // Remove data URL prefix if present
      const base64Data = signatureBase64.replace(
        /^data:image\/\w+;base64,/,
        '',
      );
      const buffer = Buffer.from(base64Data, 'base64');

      // Determine image type from base64 header
      let mimeType = 'image/png';
      if (signatureBase64.includes('image/jpeg')) {
        mimeType = 'image/jpeg';
      } else if (signatureBase64.includes('image/svg')) {
        mimeType = 'image/svg+xml';
      }

      const filename = `signature_${submissionId}_${Date.now()}.${mimeType.split('/')[1]}`;

      // Pass submissionId to create response subfolder
      return await this.uploadFile(
        formId,
        {
          buffer,
          originalname: filename,
          mimetype: mimeType,
        },
        submissionId,
      );
    } catch (error) {
      console.error('Error uploading signature:', error);
      throw new BadRequestException('Failed to upload signature');
    }
  }

  /**
   * Get or create a folder for form uploads
   * Uses folder naming convention to identify existing folders
   */
  private async getOrCreateFormFolder(
    drive: drive_v3.Drive,
    formId: string,
  ): Promise<string> {
    // Get form info for folder name
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      select: { title: true },
    });

    // Search for existing folder by name pattern
    const folderName = `Rukny Forms - ${form?.title || formId}`;
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id;
    }

    // Create new folder
    const folderMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });

    return folder.data.id;
  }

  /**
   * Get or create a subfolder for a specific response/submission
   * Creates folder structure: Form Folder / Response X (sequential numbering)
   */
  private async getOrCreateResponseFolder(
    drive: drive_v3.Drive,
    formFolderId: string,
    submissionId: string,
  ): Promise<string> {
    // First, check if we already have a folder for this submission
    // Note: Drive API doesn't support searching by description, so we search all folders
    // and check their descriptions manually
    const allFoldersResponse = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and '${formFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, description)',
      orderBy: 'name',
    });

    // Check if folder for this submission already exists (by description)
    if (allFoldersResponse.data.files) {
      const existingFolder = allFoldersResponse.data.files.find(
        (f) => f.description === submissionId,
      );
      if (existingFolder) {
        return existingFolder.id;
      }
    }

    // Count existing Response folders to determine the next number
    let nextNumber = 1;
    if (
      allFoldersResponse.data.files &&
      allFoldersResponse.data.files.length > 0
    ) {
      // Find the highest response number
      const numbers = allFoldersResponse.data.files
        .map((f) => {
          const match = f.name?.match(/^Response (\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    const folderName = `Response ${nextNumber}`;

    // Create new response folder inside form folder with submissionId in description
    const folderMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [formFolderId],
      description: submissionId, // Store submissionId in description for future lookups
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });

    return folder.data.id;
  }

  /**
   * Get file info from Google Drive
   */
  async getFileInfo(formId: string, fileId: string) {
    try {
      const drive = await this.getDriveClient(formId);

      const response = await drive.files.get({
        fileId,
        fields:
          'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, iconLink',
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file info:', error);
      throw new NotFoundException('File not found');
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(formId: string, fileId: string): Promise<void> {
    try {
      const drive = await this.getDriveClient(formId);
      await drive.files.delete({ fileId });
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw - file might already be deleted
    }
  }

  /**
   * Check if Google Drive is connected for a form
   */
  async isConnected(formId: string): Promise<boolean> {
    const integration = await this.prisma.formIntegration.findFirst({
      where: {
        formId,
        type: 'google_sheets', // Same integration as sheets
        isActive: true,
      },
    });

    return !!integration;
  }

  /**
   * Upload a file to Google Drive (PRIVATE - no public access)
   */
  async uploadFilePrivate(
    formId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
    folderId?: string,
  ): Promise<{
    fileId: string;
    webViewLink: string;
  }> {
    try {
      const drive = await this.getDriveClient(formId);

      // Get or create form folder
      const formFolderId =
        folderId || (await this.getOrCreateFormFolder(drive, formId));

      // Create file metadata
      const fileMetadata: drive_v3.Schema$File = {
        name: file.originalname,
        parents: [formFolderId],
      };

      // Convert buffer to readable stream
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      // Upload file (NO public permissions - file stays private)
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: file.mimetype,
          body: bufferStream,
        },
        fields: 'id, webViewLink',
      });

      return {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
      };
    } catch (error) {
      console.error('Error uploading private file to Google Drive:', error);
      throw new BadRequestException('Failed to upload file to Google Drive');
    }
  }

  /**
   * Upload signature (PRIVATE - no public access)
   */
  async uploadSignaturePrivate(
    formId: string,
    signatureBase64: string,
    submissionId: string,
  ): Promise<{
    fileId: string;
    webViewLink: string;
  }> {
    try {
      const base64Data = signatureBase64.replace(
        /^data:image\/\w+;base64,/,
        '',
      );
      const buffer = Buffer.from(base64Data, 'base64');

      let mimeType = 'image/png';
      if (signatureBase64.includes('image/jpeg')) {
        mimeType = 'image/jpeg';
      }

      const filename = `signature_${submissionId}_${Date.now()}.${mimeType.split('/')[1]}`;

      return await this.uploadFilePrivate(formId, {
        buffer,
        originalname: filename,
        mimetype: mimeType,
      });
    } catch (error) {
      console.error('Error uploading private signature:', error);
      throw new BadRequestException('Failed to upload signature');
    }
  }

  /**
   * Get file content from Google Drive (for proxying)
   * This downloads the file and returns it as a buffer
   */
  async getFileContent(
    formId: string,
    fileId: string,
  ): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    try {
      const drive = await this.getDriveClient(formId);

      // Get file metadata
      const metaResponse = await drive.files.get({
        fileId,
        fields: 'name, mimeType',
      });

      // Download file content
      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' },
      );

      return {
        buffer: Buffer.from(response.data as ArrayBuffer),
        mimeType: metaResponse.data.mimeType || 'application/octet-stream',
        filename: metaResponse.data.name || 'file',
      };
    } catch (error) {
      console.error('Error getting file content:', error);
      throw new NotFoundException('File not found or access denied');
    }
  }

  /**
   * Generate a signed URL for temporary file access
   * The URL includes a signature that expires after the specified duration
   */
  generateSignedUrl(
    formId: string,
    fileId: string,
    expiresInMinutes: number = 60,
  ): { url: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const expiresTimestamp = expiresAt.getTime();

    // Create signature using secret + formId + fileId + expiry
    const secret = this.config.get('JWT_SECRET') || 'default-secret';
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${formId}:${fileId}:${expiresTimestamp}`)
      .digest('hex');

    // Build the URL
    const apiUrl = this.config.get('API_URL') || 'http://localhost:3001';
    const url = `${apiUrl}/api/v1/integrations/google-drive/secure/${formId}/${fileId}?expires=${expiresTimestamp}&sig=${signature}`;

    return { url, expiresAt };
  }

  /**
   * Verify a signed URL signature
   */
  verifySignedUrl(
    formId: string,
    fileId: string,
    expiresTimestamp: number,
    signature: string,
  ): boolean {
    // Check if expired
    if (Date.now() > expiresTimestamp) {
      return false;
    }

    // Verify signature
    const secret = this.config.get('JWT_SECRET') || 'default-secret';
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${formId}:${fileId}:${expiresTimestamp}`)
      .digest('hex');

    return signature === expectedSignature;
  }
}
