import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * 📧 Resend Email Service
 * Clean, minimal email design inspired by Google
 * https://resend.com/docs/api-reference/introduction
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private resend: Resend | null = null;
  private emailEnabled: boolean = false;
  private defaultFrom: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.emailEnabled = true;
      this.defaultFrom = this.configService.get<string>(
        'RESEND_FROM_EMAIL',
        'Rukny <notifications@rukny.store>'
      );
      this.logger.log('✅ Resend email service enabled');
    } else {
      this.logger.warn('⚠️ Resend disabled - Missing RESEND_API_KEY');
      this.logger.warn('   Email notifications will be logged to console only');
    }
  }

  /**
   * Base email template - Clean Google-like design
   */
  private getBaseTemplate(content: {
    greeting: string;
    title: string;
    message: string;
    buttonText?: string;
    buttonUrl?: string;
    footerText?: string;
    additionalContent?: string;
  }): string {
    const { greeting, title, message, buttonText, buttonUrl, footerText, additionalContent } = content;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <img src="https://rukny.store/logo.png" alt="Rukny" width="80" height="80" style="display: block; border-radius: 12px;" onerror="this.style.display='none'">
              <h1 style="margin: 16px 0 0 0; font-size: 24px; font-weight: 400; color: #5f6368; letter-spacing: -0.5px;">Rukny</h1>
            </td>
          </tr>
          
          <!-- Greeting & Title -->
          <tr>
            <td align="center" style="padding: 20px 40px 0 40px;">
              <h2 style="margin: 0; font-size: 24px; font-weight: 400; color: #202124; line-height: 1.4;">${greeting}</h2>
              <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: 400; color: #202124; line-height: 1.4;">${title}</p>
            </td>
          </tr>
          
          <!-- Message -->
          <tr>
            <td align="center" style="padding: 16px 40px 0 40px;">
              <p style="margin: 0; font-size: 14px; color: #5f6368; line-height: 1.6;">${message}</p>
            </td>
          </tr>
          
          ${additionalContent ? `
          <!-- Additional Content -->
          <tr>
            <td style="padding: 24px 40px 0 40px;">
              ${additionalContent}
            </td>
          </tr>
          ` : ''}
          
          ${buttonText && buttonUrl ? `
          <!-- Button -->
          <tr>
            <td align="center" style="padding: 32px 40px 0 40px;">
              <a href="${buttonUrl}" target="_blank" style="display: inline-block; background-color: #1a73e8; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 12px 24px; border-radius: 4px; min-width: 120px; text-align: center;">${buttonText}</a>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 40px 40px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #9aa0a6; line-height: 1.6;">
                ${footerText || `This email was sent to you by Rukny.`}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #9aa0a6;">
                © ${new Date().getFullYear()} Rukny. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Check if email service is enabled
   */
  isEnabled(): boolean {
    return this.emailEnabled;
  }

  /**
   * Send email using Resend
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, text, from, replyTo, cc, bcc, attachments } = options;

    if (!this.emailEnabled || !this.resend) {
      this.logger.log(`📧 [Email Disabled] To: ${to}, Subject: ${subject}`);
      return { success: true, messageId: 'console-only' };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: from || this.defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        replyTo,
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (error) {
        this.logger.error(`❌ Failed to send email: ${error.message}`);
        return { success: false, error: error.message };
      }

      this.logger.log(`✅ Email sent successfully to ${to} - ID: ${data?.id}`);
      return { success: true, messageId: data?.id };
    } catch (error) {
      this.logger.error(`❌ Email error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send QuickSign login link
   */
  async sendQuickSignLogin(
    to: string,
    token: string,
    deviceInfo: {
      ipAddress?: string;
      browser?: string;
      os?: string;
      deviceType?: string;
    },
  ): Promise<EmailResult> {
    const quickSignBaseUrl =
      this.configService.get<string>('AUTH_BASE_URL') ||
      this.configService.get<string>('API_BASE_URL') ||
      this.configService.get<string>('BACKEND_URL') ||
      'http://localhost:3001';
    const normalizedQuickSignBaseUrl = quickSignBaseUrl.replace(/\/+$/, '');
    const quickSignLink = `${normalizedQuickSignBaseUrl}/api/v1/auth/quicksign/verify/${token}`;
    const userName = to.split('@')[0];

    const html = this.getBaseTemplate({
      greeting: `Hi ${userName},`,
      title: 'Sign in to your Rukny account',
      message: 'Click the button below to securely sign in to your account. This link will expire in 15 minutes.',
      buttonText: 'Sign in',
      buttonUrl: quickSignLink,
      footerText: `This email was sent to ${to} because a sign-in was requested. If you didn't request this, you can safely ignore this email.`,
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa; border-radius: 8px;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6368;"><strong>Device:</strong> ${deviceInfo.browser || 'Unknown'} on ${deviceInfo.os || 'Unknown'}</p>
              <p style="margin: 0; font-size: 12px; color: #5f6368;"><strong>IP Address:</strong> ${deviceInfo.ipAddress || 'Unknown'}</p>
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: 'Sign in to Rukny',
      html,
    });
  }

  /**
   * Send QuickSign signup link (new user)
   */
  async sendQuickSignSignup(
    to: string,
    token: string,
    deviceInfo: {
      ipAddress?: string;
      browser?: string;
      os?: string;
      deviceType?: string;
    },
  ): Promise<EmailResult> {
    const quickSignBaseUrl =
      this.configService.get<string>('AUTH_BASE_URL') ||
      this.configService.get<string>('API_BASE_URL') ||
      this.configService.get<string>('BACKEND_URL') ||
      'http://localhost:3001';
    const normalizedQuickSignBaseUrl = quickSignBaseUrl.replace(/\/+$/, '');
    const quickSignLink = `${normalizedQuickSignBaseUrl}/api/v1/auth/quicksign/verify/${token}`;

    const html = this.getBaseTemplate({
      greeting: 'Welcome to Rukny!',
      title: 'Complete your account setup',
      message: 'You\'re just one click away from creating your online store. Click the button below to get started.',
      buttonText: 'Get started',
      buttonUrl: quickSignLink,
      footerText: `This email was sent to ${to} because an account was created with this email address.`,
    });

    return this.sendEmail({
      to,
      subject: 'Welcome to Rukny - Complete your signup',
      html,
    });
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlert(
    to: string,
    userName: string,
    alertData: {
      action: string;
      actionArabic: string;
      description: string;
      ipAddress?: string;
      location?: string;
      browser?: string;
      timestamp: Date;
    },
  ): Promise<EmailResult> {
    const html = this.getBaseTemplate({
      greeting: `Hi ${userName},`,
      title: 'Security alert for your account',
      message: alertData.description,
      buttonText: 'Review activity',
      buttonUrl: `${this.configService.get<string>('FRONTEND_URL', 'https://rukny.store')}/app/settings/security`,
      footerText: 'If you didn\'t perform this action, please change your password immediately.',
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef7e0; border-radius: 8px; border-left: 4px solid #f9ab00;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500; color: #202124;">⚠️ ${alertData.action}</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6368;"><strong>Time:</strong> ${alertData.timestamp.toLocaleString()}</p>
              ${alertData.ipAddress ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6368;"><strong>IP Address:</strong> ${alertData.ipAddress}</p>` : ''}
              ${alertData.browser ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6368;"><strong>Browser:</strong> ${alertData.browser}</p>` : ''}
              ${alertData.location ? `<p style="margin: 0; font-size: 12px; color: #5f6368;"><strong>Location:</strong> ${alertData.location}</p>` : ''}
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: 'Security alert - New activity on your account',
      html,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<EmailResult> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://rukny.store');
    
    const html = this.getBaseTemplate({
      greeting: `Hi ${userName},`,
      title: 'Welcome to Rukny!',
      message: 'Thanks for joining Rukny. We\'re excited to help you build your online presence. Start by creating your store or organizing your events.',
      buttonText: 'Get started',
      buttonUrl: `${frontendUrl}/app`,
    });

    return this.sendEmail({
      to,
      subject: 'Welcome to Rukny!',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetToken: string,
  ): Promise<EmailResult> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://rukny.store');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const html = this.getBaseTemplate({
      greeting: `Hi ${userName},`,
      title: 'Reset your password',
      message: 'We received a request to reset your password. Click the button below to create a new password. This link expires in 1 hour.',
      buttonText: 'Reset password',
      buttonUrl: resetUrl,
      footerText: 'If you didn\'t request a password reset, you can safely ignore this email.',
    });

    return this.sendEmail({
      to,
      subject: 'Reset your Rukny password',
      html,
    });
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    to: string,
    orderData: {
      orderNumber: string;
      customerName: string;
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
      currency?: string;
    },
  ): Promise<EmailResult> {
    const currency = orderData.currency || 'IQD';
    
    const itemsHtml = orderData.items.map(item => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e8eaed;">
          <p style="margin: 0; font-size: 14px; color: #202124;">${item.name}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #5f6368;">Qty: ${item.quantity}</p>
        </td>
        <td align="right" style="padding: 12px 0; border-bottom: 1px solid #e8eaed;">
          <p style="margin: 0; font-size: 14px; color: #202124;">${item.price.toLocaleString()} ${currency}</p>
        </td>
      </tr>
    `).join('');

    const html = this.getBaseTemplate({
      greeting: `Hi ${orderData.customerName},`,
      title: 'Your order is confirmed!',
      message: `Thanks for your order #${orderData.orderNumber}. We'll notify you when it ships.`,
      buttonText: 'View order',
      buttonUrl: `${this.configService.get<string>('FRONTEND_URL', 'https://rukny.store')}/orders/${orderData.orderNumber}`,
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 0 0 0;">
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #202124;">Total</p>
            </td>
            <td align="right" style="padding: 16px 0 0 0;">
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #1a73e8;">${orderData.total.toLocaleString()} ${currency}</p>
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: `Order confirmed #${orderData.orderNumber}`,
      html,
    });
  }

  /**
   * Send verification code email
   */
  async sendVerificationCode(
    to: string,
    code: string,
    expiresIn: string = '10 minutes',
  ): Promise<EmailResult> {
    const html = this.getBaseTemplate({
      greeting: 'Verification code',
      title: 'Enter this code to verify your identity',
      message: 'This code expires in ' + expiresIn + '. Don\'t share this code with anyone.',
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px 40px; display: inline-block;">
                <p style="margin: 0; font-size: 32px; font-weight: 500; letter-spacing: 8px; color: #202124; font-family: 'Roboto Mono', monospace;">${code}</p>
              </div>
            </td>
          </tr>
        </table>
      `,
      footerText: `This email was sent to ${to}. If you didn't request this code, you can safely ignore this email.`,
    });

    return this.sendEmail({
      to,
      subject: `${code} is your verification code`,
      html,
    });
  }

  /**
   * Send event registration confirmation
   */
  async sendEventRegistrationEmail(
    to: string,
    data: {
      userName: string;
      eventTitle: string;
      eventDate: string;
      eventLocation?: string;
      ticketNumber?: string;
    },
  ): Promise<EmailResult> {
    const html = this.getBaseTemplate({
      greeting: `Hi ${data.userName},`,
      title: 'You\'re registered!',
      message: `Your registration for "${data.eventTitle}" is confirmed.`,
      buttonText: 'View event details',
      buttonUrl: `${this.configService.get<string>('FRONTEND_URL', 'https://rukny.store')}/events`,
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #e8f5e9; border-radius: 8px;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 500; color: #1b5e20;">📅 ${data.eventTitle}</p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #2e7d32;"><strong>Date:</strong> ${data.eventDate}</p>
              ${data.eventLocation ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #2e7d32;"><strong>Location:</strong> ${data.eventLocation}</p>` : ''}
              ${data.ticketNumber ? `<p style="margin: 0; font-size: 14px; color: #2e7d32;"><strong>Ticket #:</strong> ${data.ticketNumber}</p>` : ''}
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: `You're registered for ${data.eventTitle}`,
      html,
    });
  }

  /**
   * Send form submission notification
   */
  async sendFormSubmissionNotification(
    to: string,
    data: {
      formTitle: string;
      submitterName?: string;
      submitterEmail?: string;
      submissionCount: number;
    },
  ): Promise<EmailResult> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://rukny.store');
    
    const html = this.getBaseTemplate({
      greeting: 'New form response',
      title: `"${data.formTitle}" received a response`,
      message: `You have ${data.submissionCount} total responses.`,
      buttonText: 'View responses',
      buttonUrl: `${frontendUrl}/app/forms`,
      additionalContent: data.submitterName || data.submitterEmail ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #e3f2fd; border-radius: 8px;">
          <tr>
            <td style="padding: 16px;">
              ${data.submitterName ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #1565c0;"><strong>From:</strong> ${data.submitterName}</p>` : ''}
              ${data.submitterEmail ? `<p style="margin: 0; font-size: 14px; color: #1565c0;"><strong>Email:</strong> ${data.submitterEmail}</p>` : ''}
            </td>
          </tr>
        </table>
      ` : '',
    });

    return this.sendEmail({
      to,
      subject: `New response: ${data.formTitle}`,
      html,
    });
  }

  /**
   * Send login alert email
   */
  async sendLoginAlert(
    to: string,
    userName: string,
    loginData: {
      success: boolean;
      ipAddress?: string;
      location?: string;
      browser?: string;
      os?: string;
      deviceType?: string;
      timestamp: Date;
    },
  ): Promise<EmailResult> {
    const html = this.getBaseTemplate({
      greeting: `Hi ${userName},`,
      title: 'New sign-in to your account',
      message: 'A new sign-in was detected on your Rukny account. If this was you, no action is needed.',
      buttonText: 'Review activity',
      buttonUrl: `${this.configService.get<string>('FRONTEND_URL', 'https://rukny.store')}/app/settings/security`,
      footerText: 'If you didn\'t sign in, please secure your account immediately.',
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa; border-radius: 8px;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6368;"><strong>Time:</strong> ${loginData.timestamp.toLocaleString()}</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6368;"><strong>Device:</strong> ${loginData.browser || 'Unknown'} on ${loginData.os || 'Unknown'}</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6368;"><strong>IP Address:</strong> ${loginData.ipAddress || 'Unknown'}</p>
              ${loginData.location ? `<p style="margin: 0; font-size: 12px; color: #5f6368;"><strong>Location:</strong> ${loginData.location}</p>` : ''}
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: 'New sign-in to your Rukny account',
      html,
    });
  }

  /**
   * Send order status update email
   */
  async sendOrderStatusUpdate(
    to: string,
    orderData: {
      orderNumber: string;
      customerName: string;
      status: string;
      statusMessage: string;
    },
  ): Promise<EmailResult> {
    const statusColors: Record<string, string> = {
      'processing': '#1a73e8',
      'shipped': '#34a853',
      'delivered': '#188038',
      'cancelled': '#ea4335',
    };

    const html = this.getBaseTemplate({
      greeting: `Hi ${orderData.customerName},`,
      title: `Order #${orderData.orderNumber} update`,
      message: orderData.statusMessage,
      buttonText: 'Track order',
      buttonUrl: `${this.configService.get<string>('FRONTEND_URL', 'https://rukny.store')}/orders/${orderData.orderNumber}`,
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding: 8px 0;">
              <span style="display: inline-block; background-color: ${statusColors[orderData.status.toLowerCase()] || '#5f6368'}; color: #ffffff; font-size: 12px; font-weight: 500; padding: 6px 16px; border-radius: 16px; text-transform: uppercase;">${orderData.status}</span>
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: `Order ${orderData.status} - #${orderData.orderNumber}`,
      html,
    });
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(
    to: string,
    data: {
      userName: string;
      planName: string;
      price: number;
      currency: string;
      billingPeriod: string;
      nextBillingDate: string;
    },
  ): Promise<EmailResult> {
    const html = this.getBaseTemplate({
      greeting: `Hi ${data.userName},`,
      title: 'Subscription confirmed!',
      message: `You're now subscribed to the ${data.planName} plan. Thank you for your trust in Rukny.`,
      buttonText: 'Manage subscription',
      buttonUrl: `${this.configService.get<string>('FRONTEND_URL', 'https://rukny.store')}/app/settings/billing`,
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #e8f5e9; border-radius: 8px;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #2e7d32;"><strong>Plan:</strong> ${data.planName}</p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #2e7d32;"><strong>Price:</strong> ${data.price.toLocaleString()} ${data.currency}/${data.billingPeriod}</p>
              <p style="margin: 0; font-size: 14px; color: #2e7d32;"><strong>Next billing:</strong> ${data.nextBillingDate}</p>
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: `Welcome to ${data.planName} - Subscription confirmed`,
      html,
    });
  }

  /**
   * Send auto-response to form submitter
   */
  async sendAutoResponse(
    to: string,
    formTitle: string,
    customMessage: string,
  ): Promise<EmailResult> {
    const html = this.getBaseTemplate({
      greeting: 'Thank you!',
      title: 'Your response has been received',
      message: `Your submission to "${formTitle}" was successful.`,
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #e8f5e9; border-radius: 8px; border-left: 4px solid #34a853;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0; font-size: 14px; color: #1b5e20; line-height: 1.6; white-space: pre-wrap;">${customMessage}</p>
            </td>
          </tr>
        </table>
      `,
      footerText: `This is an automated response from Rukny.`,
    });

    return this.sendEmail({
      to,
      subject: `✅ Thank you for your submission – ${formTitle}`,
      html,
    });
  }

  /**
   * Send form created notification with QR code
   */
  async sendFormCreatedNotification(
    to: string,
    userName: string,
    formData: {
      formTitle: string;
      formSlug: string;
      formId: string;
    },
  ): Promise<EmailResult> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://rukny.store');
    const formUrl = `${frontendUrl}/f/${formData.formSlug}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formUrl)}`;

    const html = this.getBaseTemplate({
      greeting: `Hi ${userName},`,
      title: 'Your form is ready!',
      message: `Your form "${formData.formTitle}" has been created successfully.`,
      buttonText: 'View Form',
      buttonUrl: formUrl,
      additionalContent: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding: 16px 0;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #5f6368;">Scan to open your form:</p>
              <img src="${qrCodeUrl}" alt="QR Code" width="120" height="120" style="border-radius: 8px; border: 1px solid #e8eaed;" />
            </td>
          </tr>
        </table>
      `,
    });

    return this.sendEmail({
      to,
      subject: `Your form "${formData.formTitle}" is ready – Rukny`,
      html,
    });
  }
}
