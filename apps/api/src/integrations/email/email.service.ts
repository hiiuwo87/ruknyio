import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;
  private emailEnabled: boolean = false;
  private useResend: boolean = false;
  private fromEmail: string;
  private fromName: string;

  constructor(private configService: ConfigService) {
    // First, check for Resend API (preferred)
    const resendApiKey = this.configService.get('RESEND_API_KEY');
    
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.emailEnabled = true;
      this.useResend = true;
      this.fromEmail = this.configService.get('RESEND_FROM_EMAIL', 'notifications@rukny.store');
      this.fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');
      console.log(`✅ Email service enabled via Resend API - From: ${this.fromEmail}`);
    } else {
      // Fallback to SMTP if no Resend
      const smtpHost =
        this.configService.get('MAIL_HOST') ||
        this.configService.get('SMTP_HOST');
      const smtpUser =
        this.configService.get('MAIL_USER') ||
        this.configService.get('SMTP_USER');
      const smtpPassword =
        this.configService.get('MAIL_PASSWORD') ||
        this.configService.get('SMTP_PASSWORD') ||
        this.configService.get('SMTP_PASS');

      if (smtpHost && smtpUser && smtpPassword) {
        this.emailEnabled = true;
        const port = parseInt(this.configService.get('MAIL_PORT') || this.configService.get('SMTP_PORT') || '587');
        const secure = this.configService.get('MAIL_SECURE') === 'true';
        
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: port,
          secure: secure,
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
          connectionTimeout: 30000,
          socketTimeout: 30000,
          greetingTimeout: 15000,
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        } as nodemailer.TransportOptions);
        
        this.fromEmail = this.configService.get('SMTP_FROM_EMAIL', 'notifications@rukny.store');
        this.fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');
        console.log(`✅ Email service enabled via SMTP - Host: ${smtpHost}:${port}`);
      } else {
        console.warn(
          '⚠️  Email service disabled - Missing RESEND_API_KEY or SMTP credentials',
        );
        console.warn('   Email notifications will be logged to console only');
      }
    }
  }

  /**
   * Send email using Resend or SMTP based on configuration
   * This is the main public method for sending emails
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<boolean> {
    if (!this.emailEnabled) {
      console.log(`📧 [SIMULATED] Email would be sent to ${options.to}: ${options.subject}`);
      return false;
    }

    const from = options.from || `"${this.fromName}" <${this.fromEmail}>`;

    try {
      if (this.useResend && this.resend) {
        // Use Resend API
        const result = await this.resend.emails.send({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });
        
        if (result.error) {
          throw new Error(result.error.message);
        }
        
        console.log(`✅ Email sent via Resend to ${options.to}`);
        return true;
      } else if (this.transporter) {
        // Use SMTP
        await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });
        
        console.log(`✅ Email sent via SMTP to ${options.to}`);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error(`❌ Failed to send email to ${options.to}:`, error.message);
      throw error;
    }
  }

  /**
   * Get the frontend URL from config
   */
  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

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
      os?: string;
      deviceType?: string;
      timestamp: Date;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to,
        subject: '🔔 تنبيه أمني - نشاط جديد على حسابك',
        html: this.getSecurityAlertTemplate(userName, alertData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Security alert email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send security alert email:', error);
      // Don't throw error - email should be non-blocking
    }
  }

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
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to,
        subject: loginData.success
          ? '✅ تسجيل دخول جديد إلى حسابك'
          : '⚠️ محاولة تسجيل دخول فاشلة',
        html: this.getLoginAlertTemplate(userName, loginData),
      };

      if (this.transporter) {
        await this.transporter.sendMail(mailOptions);
        console.log(`Login alert email sent to ${to}`);
      } else {
        console.log(`📧 [SIMULATED] Login alert would be sent to ${to}`);
      }
    } catch (error) {
      console.error('Failed to send login alert email:', error);
    }
  }

  async sendPasswordChangeAlert(
    to: string,
    userName: string,
    changeData: {
      ipAddress?: string;
      location?: string;
      browser?: string;
      timestamp: Date;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to,
        subject: '🔐 تم تغيير كلمة المرور لحسابك',
        html: this.getPasswordChangeTemplate(userName, changeData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Password change alert sent to ${to}`);
    } catch (error) {
      console.error('Failed to send password change alert:', error);
    }
  }

  async sendNewDeviceAlert(
    to: string,
    userName: string,
    deviceData: {
      deviceName: string;
      browser?: string;
      os?: string;
      deviceType: string;
      ipAddress?: string;
      location?: string;
      timestamp: Date;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to,
        subject: '🆕 تسجيل دخول من جهاز جديد',
        html: this.getNewDeviceTemplate(userName, deviceData),
      };

      if (this.transporter) {
        await this.transporter.sendMail(mailOptions);
        console.log(`New device alert sent to ${to}`);
      } else {
        console.log(`📧 [SIMULATED] New device alert would be sent to ${to}`);
      }
    } catch (error) {
      console.error('Failed to send new device alert:', error);
    }
  }

  async sendFailedLoginAlert(
    to: string,
    userName: string,
    alertData: {
      failedAttempts: number;
      ipAddress?: string;
      timeWindow: number;
      timestamp: Date;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to,
        subject: '🚨 محاولات دخول فاشلة متعددة على حسابك',
        html: this.getFailedLoginAlertTemplate(userName, alertData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Failed login alert sent to ${to}`);
    } catch (error) {
      console.error('Failed to send failed login alert:', error);
    }
  }

  async sendEmailChangeAlert(
    oldEmail: string,
    newEmail: string,
    userName: string,
    changeData: {
      ipAddress?: string;
      browser?: string;
      timestamp: Date;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      // Send to OLD email
      const oldEmailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to: oldEmail,
        subject: '⚠️ تم تغيير البريد الإلكتروني لحسابك',
        html: this.getEmailChangeAlertTemplate(
          userName,
          oldEmail,
          newEmail,
          changeData,
        ),
      };

      await this.transporter.sendMail(oldEmailOptions);

      // Send to NEW email
      const newEmailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to: newEmail,
        subject: '✅ تم ربط حسابك بهذا البريد الإلكتروني',
        html: this.getEmailChangeConfirmationTemplate(
          userName,
          newEmail,
          changeData,
        ),
      };

      await this.transporter.sendMail(newEmailOptions);

      console.log(`Email change alerts sent to ${oldEmail} and ${newEmail}`);
    } catch (error) {
      console.error('Failed to send email change alert:', error);
    }
  }

  // ============================================
  // EVENT NOTIFICATIONS
  // ============================================

  async sendEventRegistrationConfirmation(
    to: string,
    userName: string,
    eventData: {
      eventTitle: string;
      eventTitleAr?: string;
      startDate: Date;
      endDate: Date;
      location?: string;
      isVirtual: boolean;
      meetingUrl?: string;
      organizerName: string;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `✅ تأكيد التسجيل: ${eventData.eventTitleAr || eventData.eventTitle}`,
        html: this.getEventRegistrationTemplate(userName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Event registration confirmation sent to ${to}`);
    } catch (error) {
      console.error('Failed to send event registration email:', error);
    }
  }

  async sendEventReminder(
    to: string,
    userName: string,
    eventData: {
      eventTitle: string;
      eventTitleAr?: string;
      startDate: Date;
      location?: string;
      isVirtual: boolean;
      meetingUrl?: string;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `⏰ تذكير: ${eventData.eventTitleAr || eventData.eventTitle} - غداً`,
        html: this.getEventReminderTemplate(userName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Event reminder sent to ${to}`);
    } catch (error) {
      console.error('Failed to send event reminder:', error);
    }
  }

  async sendWaitlistNotification(
    to: string,
    userName: string,
    eventData: {
      eventTitle: string;
      eventTitleAr?: string;
      startDate: Date;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `📋 قائمة الانتظار: ${eventData.eventTitleAr || eventData.eventTitle}`,
        html: this.getWaitlistTemplate(userName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Waitlist notification sent to ${to}`);
    } catch (error) {
      console.error('Failed to send waitlist notification:', error);
    }
  }

  async sendWaitlistPromotionNotification(
    to: string,
    userName: string,
    eventData: {
      eventTitle: string;
      eventTitleAr?: string;
      startDate: Date;
      expiresAt: Date;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `🎉 مقعد متاح الآن: ${eventData.eventTitleAr || eventData.eventTitle}`,
        html: this.getWaitlistPromotionTemplate(userName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Waitlist promotion notification sent to ${to}`);
    } catch (error) {
      console.error('Failed to send waitlist promotion notification:', error);
    }
  }

  async sendEventCancellation(
    to: string,
    userName: string,
    eventData: {
      eventTitle: string;
      eventTitleAr?: string;
      cancellationReason?: string;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `❌ إلغاء الحدث: ${eventData.eventTitleAr || eventData.eventTitle}`,
        html: this.getEventCancellationTemplate(userName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Event cancellation sent to ${to}`);
    } catch (error) {
      console.error('Failed to send cancellation email:', error);
    }
  }

  async sendEventCreatedNotification(
    to: string,
    organizerName: string,
    eventData: {
      eventTitle: string;
      startDate: Date;
      endDate: Date;
      location?: string;
      isVirtual: boolean;
      slug: string;
      maxAttendees?: number;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `🎉 تم إنشاء حدثك: ${eventData.eventTitle}`,
        html: this.getEventCreatedTemplate(organizerName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Event created notification sent to ${to}`);
    } catch (error) {
      console.error('Failed to send event created notification:', error);
    }
  }

  async sendNewRegistrationNotification(
    to: string,
    organizerName: string,
    eventData: {
      eventTitle: string;
      attendeeName: string;
      attendeeEmail: string;
      totalRegistrations: number;
      maxAttendees?: number;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `🔔 تسجيل جديد: ${eventData.eventTitle}`,
        html: this.getNewRegistrationTemplate(organizerName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`New registration notification sent to ${to}`);
    } catch (error) {
      console.error('Failed to send new registration notification:', error);
    }
  }

  async sendOrganizerInvitation(
    to: string,
    userName: string,
    eventData: {
      eventTitle: string;
      eventSlug: string;
      role: string;
      inviterName: string;
      permissions: string[];
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      const mailOptions = {
        from: `"${fromName} Events" <${fromEmail}>`,
        to,
        subject: `🎯 دعوة لتنظيم حدث: ${eventData.eventTitle}`,
        html: this.getOrganizerInvitationTemplate(userName, eventData),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Organizer invitation sent to ${to}`);
    } catch (error) {
      console.error('Failed to send organizer invitation:', error);
    }
  }

  /**
   * إرسال دعوة للانضمام لمساحة عمل
   */
  async sendWorkspaceInvitation(
    to: string,
    invitationData: {
      listName: string;
      listColor?: string;
      inviterName: string;
      inviterEmail: string;
      role: string;
      token: string;
      message?: string;
      expiresAt: Date;
    },
  ) {
    const roleLabels: Record<string, string> = {
      ADMIN: 'مدير',
      MEMBER: 'عضو',
      VIEWER: 'مشاهد',
    };

    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'https://rukny.store',
    );
    // TODO: Re-enable when tasks feature is launched
    const acceptUrl = `${frontendUrl}/app/tasks/invite/accept?token=${invitationData.token}`;

    if (!this.emailEnabled) {
      console.log('📧 [Workspace Invitation - Not Sent]');
      console.log(`   To: ${to}`);
      console.log(`   List: ${invitationData.listName}`);
      console.log(
        `   From: ${invitationData.inviterName} (${invitationData.inviterEmail})`,
      );
      console.log(
        `   Role: ${roleLabels[invitationData.role] || invitationData.role}`,
      );
      console.log(`   Token: ${invitationData.token || '(direct add)'}`);
      console.log(`   Accept URL: ${acceptUrl}`);
      console.log(`   Frontend URL: ${frontendUrl}`);
      return;
    }

    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');
      const isDirectAdd = !invitationData.token;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: isDirectAdd
          ? `✅ تمت إضافتك إلى "${invitationData.listName}"`
          : `📋 ${invitationData.inviterName} يدعوك للانضمام إلى "${invitationData.listName}"`,
        html: this.getWorkspaceInvitationTemplate(
          invitationData,
          acceptUrl,
          roleLabels,
          frontendUrl,
        ),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Workspace invitation sent to ${to}`);
    } catch (error) {
      console.error('Failed to send workspace invitation:', error);
    }
  }

  private getWorkspaceInvitationTemplate(
    data: any,
    acceptUrl: string,
    roleLabels: Record<string, string>,
    frontendUrl: string,
  ): string {
    const roleLabel = roleLabels[data.role] || data.role;
    const isDirectAdd = !data.token;
    // TODO: Re-enable when tasks feature is launched
    const tasksUrl = `${frontendUrl}/app/tasks`;
    const buttonUrl = isDirectAdd ? tasksUrl : acceptUrl;

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #f0f0f0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    
    <h1 style="color: #333; margin: 0 0 24px; font-size: 24px; font-weight: 600;">Rukny</h1>
    
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
      مرحباً،
    </p>
    
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      ${
        isDirectAdd
          ? `تمت إضافتك إلى مساحة العمل "<strong>${data.listName}</strong>" بواسطة ${data.inviterName} كـ <strong>${roleLabel}</strong>.`
          : `${data.inviterName} يدعوك للانضمام إلى مساحة العمل "<strong>${data.listName}</strong>" كـ <strong>${roleLabel}</strong>.`
      }
    </p>
    
    <a href="${buttonUrl}" style="display: block; background-color: #e8f5e9; color: #2e7d32; text-align: center; padding: 16px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 15px; margin-bottom: 24px;">
      ${data.listName}
    </a>
    
    <p style="color: #666; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
      ${
        isDirectAdd
          ? 'يمكنك الآن عرض المهام والبدء بالعمل.'
          : 'اضغط على الزر أعلاه لقبول الدعوة.'
      }
    </p>
    
    <p style="color: #999; font-size: 12px; margin: 0;">
      لم تقم بهذا الإجراء؟ <a href="${frontendUrl}/contact" style="color: #666;">تواصل معنا</a>.
    </p>
    
  </div>
  
  <p style="text-align: center; color: #999; font-size: 12px; margin-top: 24px;">
    Rukny © ${new Date().getFullYear()}
  </p>
</body>
</html>
    `;
  }

  // Helper function for consistent email template design
  private getBaseEmailTemplate(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #333446 0%, #424560 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.85; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 20px; color: #333; margin-bottom: 16px; font-weight: 500; }
    .alert-box { padding: 18px 20px; margin: 24px 0; border-radius: 6px; font-size: 14px; }
    .alert-success { background-color: #d4edda; border-right: 4px solid #28a745; }
    .alert-warning { background-color: #fff8e1; border-right: 4px solid #ffc107; color: #856404; }
    .alert-info { background-color: #d1ecf1; border-right: 4px solid #17a2b8; }
    .info-box { background-color: #f8f9fa; border-radius: 6px; padding: 18px 20px; margin: 24px 0; font-size: 14px; color: #666; line-height: 1.8; }
    .info-box div { margin-bottom: 6px; }
    .info-box strong { color: #333; }
    .footer { background-color: #fafafa; padding: 24px; text-align: center; border-top: 1px solid #e8e8e8; }
    .footer p { margin: 6px 0; color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ركني</h1>
      <p>منصتك المتكاملة للفعاليات والمتاجر</p>
    </div>
    <div class="content">
      <div class="greeting">${title}</div>
      ${content}
    </div>
    <div class="footer">
      <p><strong>ركني © 2025</strong></p>
      <p><a href="mailto:support@rukny.io" style="color: #333446; text-decoration: none;">support@rukny.io</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getSecurityAlertTemplate(userName: string, data: any): string {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #333446 0%, #424560 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.85; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 20px; color: #333; margin-bottom: 16px; font-weight: 500; }
    .alert-box { background-color: #fff8e1; border-right: 4px solid #ffc107; padding: 18px 20px; margin: 24px 0; border-radius: 6px; font-size: 14px; color: #856404; }
    .alert-box strong { color: #333; }
    .info-box { background-color: #f8f9fa; border-radius: 6px; padding: 18px 20px; margin: 24px 0; font-size: 14px; color: #666; line-height: 1.8; }
    .info-box div { margin-bottom: 6px; }
    .info-box strong { color: #333; }
    .footer { background-color: #fafafa; padding: 24px; text-align: center; border-top: 1px solid #e8e8e8; }
    .footer p { margin: 6px 0; color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ركني</h1>
      <p>منصتك المتكاملة للفعاليات والمتاجر</p>
    </div>
    <div class="content">
      <div class="greeting">تنبيه أمني 🔔</div>
      <div class="alert-box">
        <strong>تم تسجيل نشاط جديد على حسابك:</strong>
        <p style="margin: 10px 0 0;">${data.actionArabic}</p>
      </div>
      <div class="info-box">
        <div><strong>تفاصيل النشاط:</strong></div>
        <div>الوقت: ${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        ${data.ipAddress ? `<div>العنوان: ${data.ipAddress}</div>` : ''}
        ${data.browser || data.os ? `<div>الجهاز: ${data.browser || ''} - ${data.os || ''}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">إذا لم تكن أنت من قام بهذا النشاط، يرجى تأمين حسابك فوراً.</p>
    </div>
    <div class="footer">
      <p><strong>ركني © 2025</strong></p>
      <p><a href="mailto:support@rukny.io" style="color: #333446; text-decoration: none;">support@rukny.io</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getLoginAlertTemplate(userName: string, data: any): string {
    const isSuccess = data.success;
    const title = isSuccess ? 'تسجيل دخول ناجح' : 'محاولة دخول فاشلة';
    const alertColor = isSuccess ? '#d4edda' : '#fff8e1';
    const borderColor = isSuccess ? '#28a745' : '#ffc107';

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #333446 0%, #424560 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.85; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 20px; color: #333; margin-bottom: 16px; font-weight: 500; }
    .alert-box { background-color: ${alertColor}; border-right: 4px solid ${borderColor}; padding: 18px 20px; margin: 24px 0; border-radius: 6px; font-size: 14px; }
    .info-box { background-color: #f8f9fa; border-radius: 6px; padding: 18px 20px; margin: 24px 0; font-size: 14px; color: #666; line-height: 1.8; }
    .info-box div { margin-bottom: 6px; }
    .info-box strong { color: #333; }
    .footer { background-color: #fafafa; padding: 24px; text-align: center; border-top: 1px solid #e8e8e8; }
    .footer p { margin: 6px 0; color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ركني</h1>
      <p>منصتك المتكاملة للفعاليات والمتاجر</p>
    </div>
    <div class="content">
      <div class="greeting">${title} ${isSuccess ? '✅' : '⚠️'}</div>
      <div class="alert-box">
        ${
          isSuccess
            ? '<p style="margin: 0;">تم تسجيل دخول جديد إلى حسابك.</p>'
            : '<p style="margin: 0;"><strong>تنبيه:</strong> محاولة تسجيل دخول فاشلة إلى حسابك.</p>'
        }
      </div>
      <div class="info-box">
        <div><strong>تفاصيل المحاولة:</strong></div>
        <div>الوقت: ${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        ${data.ipAddress ? `<div>العنوان: ${data.ipAddress}</div>` : ''}
        ${data.browser || data.os ? `<div>الجهاز: ${data.browser || ''} - ${data.os || ''}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">
        ${!isSuccess ? 'إذا لم تكن أنت من حاول تسجيل الدخول، يرجى تأمين حسابك فوراً.' : 'إذا لم تكن أنت، يرجى تأمين حسابك.'}
      </p>
    </div>
    <div class="footer">
      <p><strong>ركني © 2025</strong></p>
      <p><a href="mailto:support@rukny.io" style="color: #333446; text-decoration: none;">support@rukny.io</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getPasswordChangeTemplate(userName: string, data: any): string {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #333446 0%, #424560 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.85; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 20px; color: #333; margin-bottom: 16px; font-weight: 500; }
    .alert-box { background-color: #d4edda; border-right: 4px solid #28a745; padding: 18px 20px; margin: 24px 0; border-radius: 6px; font-size: 14px; }
    .info-box { background-color: #f8f9fa; border-radius: 6px; padding: 18px 20px; margin: 24px 0; font-size: 14px; color: #666; line-height: 1.8; }
    .info-box div { margin-bottom: 6px; }
    .info-box strong { color: #333; }
    .footer { background-color: #fafafa; padding: 24px; text-align: center; border-top: 1px solid #e8e8e8; }
    .footer p { margin: 6px 0; color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ركني</h1>
      <p>منصتك المتكاملة للفعاليات والمتاجر</p>
    </div>
    <div class="content">
      <div class="greeting">تغيير كلمة المرور 🔐</div>
      <div class="alert-box">
        <p style="margin: 0;"><strong>تم تغيير كلمة المرور لحسابك بنجاح.</strong></p>
      </div>
      <div class="info-box">
        <div><strong>تفاصيل التغيير:</strong></div>
        <div>الوقت: ${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        ${data.ipAddress ? `<div>العنوان: ${data.ipAddress}</div>` : ''}
        ${data.browser ? `<div>المتصفح: ${data.browser}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">إذا لم تكن أنت من قام بهذا التغيير، يرجى التواصل معنا فوراً.</p>
    </div>
    <div class="footer">
      <p><strong>ركني © 2025</strong></p>
      <p><a href="mailto:support@rukny.io" style="color: #333446; text-decoration: none;">support@rukny.io</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getNewDeviceTemplate(userName: string, data: any): string {
    const content = `
      <div class="alert-box alert-warning">
        <p style="margin: 0;"><strong>تم رصد تسجيل دخول من جهاز جديد لم يُستخدم من قبل.</strong></p>
      </div>
      <div class="info-box">
        <div><strong>معلومات الجهاز:</strong></div>
        <div>الاسم: ${data.deviceName}</div>
        ${data.deviceType ? `<div>النوع: ${data.deviceType === 'mobile' ? 'هاتف' : data.deviceType === 'tablet' ? 'لوحي' : 'كمبيوتر'}</div>` : ''}
        ${data.browser || data.os ? `<div>المتصفح: ${data.browser || ''} - ${data.os || ''}</div>` : ''}
        ${data.ipAddress ? `<div>العنوان: ${data.ipAddress}</div>` : ''}
        <div>الوقت: ${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">إذا لم تكن أنت، يرجى تأمين حسابك فوراً.</p>
    `;
    return this.getBaseEmailTemplate('جهاز جديد 🆕', content);
  }

  private getFailedLoginAlertTemplate(userName: string, data: any): string {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ff6b6b 0%, #c92a2a 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .danger-box { background-color: #f8d7da; border-right: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: center; }
    .danger-icon { font-size: 64px; margin-bottom: 15px; }
    .attempts-box { background-color: #fff; border: 3px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center; }
    .attempts-number { font-size: 48px; font-weight: bold; color: #dc3545; margin: 10px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .info-label { font-weight: bold; color: #666; }
    .info-value { color: #333; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 تنبيه أمني عاجل</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="danger-box">
        <div class="danger-icon">⚠️</div>
        <h2 style="color: #dc3545; margin: 10px 0;">محاولات دخول فاشلة متعددة!</h2>
        <p style="color: #666; margin: 10px 0;">تم رصد عدة محاولات فاشلة لتسجيل الدخول إلى حسابك.</p>
      </div>
      
      <div class="attempts-box">
        <p style="margin: 5px 0; color: #666; font-size: 14px;">عدد المحاولات الفاشلة</p>
        <div class="attempts-number">${data.failedAttempts}</div>
        <p style="margin: 5px 0; color: #666; font-size: 12px;">خلال ${data.timeWindow} دقيقة</p>
      </div>
      
      <h3 style="color: #333; margin-top: 25px;">تفاصيل المحاولات:</h3>
      
      <div class="info-row">
        <span class="info-label">آخر محاولة:</span>
        <span class="info-value">${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'long' })}</span>
      </div>
      
      ${
        data.ipAddress
          ? `
      <div class="info-row">
        <span class="info-label">عنوان IP:</span>
        <span class="info-value">${data.ipAddress}</span>
      </div>
      `
          : ''
      }
      
      <p style="margin-top: 25px; padding: 20px; background-color: #fff3cd; border-right: 4px solid #ffc107; border-radius: 6px;">
        <strong>⚠️ إجراء مطلوب:</strong><br><br>
        إذا لم تكن أنت من حاول تسجيل الدخول، فقد يحاول شخص ما الوصول إلى حسابك.<br><br>
        <strong>يُنصح بشدة بـ:</strong><br>
        ✓ تغيير كلمة المرور فوراً<br>
        ✓ تفعيل المصادقة الثنائية (2FA)<br>
        ✓ مراجعة النشاطات الأمنية الأخيرة<br>
        ✓ التحقق من الأجهزة الموثوقة
      </p>
      
      <p style="margin-top: 15px; padding: 15px; background-color: #d1ecf1; border-right: 4px solid #0c5460; border-radius: 6px; font-size: 14px;">
        <strong>ℹ️ ملاحظة:</strong> تم حظر عنوان IP هذا مؤقتاً لمدة 24 ساعة لحماية حسابك.
      </p>
      
      <center>
        <a href="${this.getFrontendUrl()}/settings?tab=security" class="button">تأمين الحساب الآن</a>
      </center>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
      <p style="margin-top: 10px; font-size: 12px;">© 2025 Rukny.io. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getEmailChangeAlertTemplate(
    userName: string,
    oldEmail: string,
    newEmail: string,
    data: any,
  ): string {
    const content = `
      <div class="alert-box alert-warning">
        <p style="margin: 0;"><strong>تم تغيير البريد الإلكتروني لحسابك</strong></p>
      </div>
      <div class="info-box">
        <div><strong>التغيير:</strong></div>
        <div>من: ${oldEmail}</div>
        <div>إلى: ${newEmail}</div>
        <div>الوقت: ${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        ${data.ipAddress ? `<div>العنوان: ${data.ipAddress}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">إذا لم تكن أنت من قام بهذا التغيير، يرجى التواصل معنا فوراً.</p>
    `;
    return this.getBaseEmailTemplate('تغيير البريد الإلكتروني ⚠️', content);
  }

  private getEmailChangeConfirmationTemplate(
    userName: string,
    newEmail: string,
    data: any,
  ): string {
    const content = `
      <div class="alert-box alert-success">
        <p style="margin: 0;"><strong>تم تأكيد البريد الإلكتروني الجديد بنجاح</strong></p>
      </div>
      <div class="info-box">
        <div><strong>البريد الجديد:</strong> ${newEmail}</div>
        <div>الوقت: ${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">يمكنك الآن استخدام هذا البريد لتسجيل الدخول.</p>
    `;
    return this.getBaseEmailTemplate('تأكيد البريد الجديد ✅', content);
  }

  private getEventRegistrationTemplate(userName: string, data: any): string {
    const content = `
      <div class="alert-box alert-success">
        <p style="margin: 0;"><strong>تم تسجيلك في الفعالية بنجاح!</strong></p>
      </div>
      <div class="info-box">
        <div><strong>الفعالية:</strong> ${data.eventName}</div>
        ${data.eventDate ? `<div>التاريخ: ${new Date(data.eventDate).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}</div>` : ''}
        ${data.location ? `<div>المكان: ${data.location}</div>` : ''}
        ${data.ticketNumber ? `<div>رقم التذكرة: ${data.ticketNumber}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">نتطلع لرؤيتك في الفعالية!</p>
    `;
    return this.getBaseEmailTemplate('تأكيد التسجيل 🎟️', content);
  }

  private getEventReminderTemplate(userName: string, data: any): string {
    const content = `
      <div class="alert-box alert-info">
        <p style="margin: 0;"><strong>تذكير: الفعالية قريباً!</strong></p>
      </div>
      <div class="info-box">
        <div><strong>الفعالية:</strong> ${data.eventName}</div>
        ${data.eventDate ? `<div>التاريخ: ${new Date(data.eventDate).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}</div>` : ''}
        ${data.location ? `<div>المكان: ${data.location}</div>` : ''}
        ${data.timeUntilEvent ? `<div>المتبقي: ${data.timeUntilEvent}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">لا تنسى حضور الفعالية!</p>
    `;
    return this.getBaseEmailTemplate('تذكير بالفعالية ⏰', content);
  }

  private getWaitlistTemplate(userName: string, data: any): string {
    const content = `
      <div class="alert-box alert-info">
        <p style="margin: 0;"><strong>تم إضافتك إلى قائمة الانتظار</strong></p>
      </div>
      <div class="info-box">
        <div><strong>الفعالية:</strong> ${data.eventName}</div>
        ${data.position ? `<div>موقعك في القائمة: ${data.position}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">سنخبرك عند توفر مقعد لك.</p>
    `;
    return this.getBaseEmailTemplate('قائمة الانتظار 📋', content);
  }

  private getWaitlistPromotionTemplate(userName: string, data: any): string {
    const content = `
      <div class="alert-box alert-success">
        <p style="margin: 0;"><strong>مبروك! تمت ترقيتك من قائمة الانتظار</strong></p>
      </div>
      <div class="info-box">
        <div><strong>الفعالية:</strong> ${data.eventName}</div>
        ${data.eventDate ? `<div>التاريخ: ${new Date(data.eventDate).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}</div>` : ''}
        ${data.expiresAt ? `<div>أكد حضورك قبل: ${new Date(data.expiresAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">يرجى تأكيد حضورك في أقرب وقت.</p>
    `;
    return this.getBaseEmailTemplate('تأكيد المقعد 🎉', content);
  }

  private getEventCancellationTemplate(userName: string, data: any): string {
    const content = `
      <div class="alert-box alert-warning">
        <p style="margin: 0;"><strong>تم إلغاء الفعالية</strong></p>
      </div>
      <div class="info-box">
        <div><strong>الفعالية:</strong> ${data.eventName}</div>
        ${data.reason ? `<div>السبب: ${data.reason}</div>` : ''}
        ${data.refundInfo ? `<div>معلومات الاسترداد: ${data.refundInfo}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">نعتذر عن الإزعاج.</p>
    `;
    return this.getBaseEmailTemplate('إلغاء الفعالية ❌', content);
  }

  private getEventCreatedTemplate(organizerName: string, data: any): string {
    const eventName = data.eventName || data.eventTitle || 'Your Event';
    const eventDate = data.eventDate
      ? new Date(data.eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';
    const eventUrl = data.slug
      ? `${this.getFrontendUrl()}/events/e/${data.slug}`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 400px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <span style="font-size: 24px; font-weight: bold; color: #1a1a1a;">Rukny</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px;">
              <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.5;">Hello ${organizerName},</p>
              <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 25px 0; line-height: 1.5;">Your event has been created successfully.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px;">
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center;">
                <span style="font-size: 18px; font-weight: 600; color: #166534;">${eventName}</span>
              </div>
            </td>
          </tr>
          ${
            eventDate
              ? `
          <tr>
            <td style="padding: 20px 30px 10px 30px;">
              <p style="font-size: 14px; color: #4b5563; margin: 0;"><strong>Date:</strong> ${eventDate}</p>
            </td>
          </tr>
          `
              : ''
          }
          ${
            eventUrl
              ? `
          <tr>
            <td style="padding: 15px 30px 25px 30px;">
              <a href="${eventUrl}" style="display: block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 8px; text-align: center; font-size: 14px; font-weight: 500;">View Event</a>
            </td>
          </tr>
          `
              : ''
          }
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="font-size: 14px; color: #9ca3af; margin: 0;">Didn't create this? <a href="mailto:support@rukny.store" style="color: #6366f1; text-decoration: underline;">Contact us</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">Rukny © ${new Date().getFullYear()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private getNewRegistrationTemplate(organizerName: string, data: any): string {
    const content = `
      <div class="alert-box alert-info">
        <p style="margin: 0;"><strong>تسجيل جديد في فعاليتك</strong></p>
      </div>
      <div class="info-box">
        <div><strong>الفعالية:</strong> ${data.eventName}</div>
        ${data.attendeeName ? `<div>الاسم: ${data.attendeeName}</div>` : ''}
        ${data.totalRegistrations ? `<div>إجمالي التسجيلات: ${data.totalRegistrations}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">يمكنك متابعة جميع التسجيلات من لوحة التحكم.</p>
    `;
    return this.getBaseEmailTemplate('تسجيل جديد 🎫', content);
  }

  private getOrganizerInvitationTemplate(userName: string, data: any): string {
    const content = `
      <div class="alert-box alert-info">
        <p style="margin: 0;"><strong>تمت دعوتك كمنظم فعالية</strong></p>
      </div>
      <div class="info-box">
        <div><strong>الفعالية:</strong> ${data.eventName}</div>
        ${data.inviterName ? `<div>من قبل: ${data.inviterName}</div>` : ''}
        ${data.role ? `<div>الدور: ${data.role}</div>` : ''}
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">يرجى قبول الدعوة للبدء في إدارة الفعالية.</p>
    `;
    return this.getBaseEmailTemplate('دعوة منظم 📨', content);
  }

  // ============================================
  // QUICKSIGN EMAIL METHODS
  // ============================================

  /**
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .warning-box { background-color: #fff3cd; border-right: 4px solid #ff6a88; padding: 20px; margin: 20px 0; border-radius: 6px; }
    .email-change { background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .email-item { padding: 10px; margin: 10px 0; border-radius: 6px; }
    .old-email { background-color: #f8d7da; border-right: 3px solid #dc3545; }
    .new-email { background-color: #d4edda; border-right: 3px solid #28a745; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .info-label { font-weight: bold; color: #666; }
    .info-value { color: #333; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .button { display: inline-block; background: linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ تغيير البريد الإلكتروني</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="warning-box">
        <h3 style="margin-top: 0; color: #856404;">تم تغيير البريد الإلكتروني لحسابك</h3>
        <p style="color: #666;">هذه رسالة تنبيهية لإعلامك بأنه تم تحديث البريد الإلكتروني المرتبط بحسابك.</p>
      </div>
      
      <div class="email-change">
        <div class="email-item old-email">
          <strong>البريد القديم:</strong><br>
          <span style="font-family: monospace;">${oldEmail}</span>
        </div>
        <div style="text-align: center; font-size: 24px; margin: 10px 0;">⬇️</div>
        <div class="email-item new-email">
          <strong>البريد الجديد:</strong><br>
          <span style="font-family: monospace;">${newEmail}</span>
        </div>
      </div>
      
      <h3 style="color: #333; margin-top: 25px;">تفاصيل التغيير:</h3>
      
      <div class="info-row">
        <span class="info-label">الوقت:</span>
        <span class="info-value">${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'long' })}</span>
      </div>
      
      ${data.ipAddress ? `
      <div class="info-row">
        <span class="info-label">عنوان IP:</span>
        <span class="info-value">${data.ipAddress}</span>
      </div>
      ` : ''}
      
      ${data.browser ? `
      <div class="info-row">
        <span class="info-label">المتصفح:</span>
        <span class="info-value">${data.browser}</span>
      </div>
      ` : ''}
      
      <p style="margin-top: 25px; padding: 20px; background-color: #f8d7da; border-right: 4px solid #dc3545; border-radius: 6px;">
        <strong>⚠️ هام جداً:</strong><br><br>
        • لن تتمكن من استخدام هذا البريد (${oldEmail}) لتسجيل الدخول بعد الآن<br>
        • إذا لم تكن أنت من قام بهذا التغيير، تواصل معنا فوراً<br>
        • لن تصلك رسائل تنبيهية مستقبلية على هذا البريد
      </p>
      
      <a href="${this.getFrontendUrl()}/settings?tab=security" class="button">عرض إعدادات الأمان</a>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
      <p style="margin-top: 10px; font-size: 12px;">© 2025 Rukny.io. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getEmailChangeConfirmationTemplate(userName: string, newEmail: string, data: any): string {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .success-box { background-color: #d4edda; border-right: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: center; }
    .success-icon { font-size: 64px; margin-bottom: 15px; }
    .email-box { background-color: #e7f3ff; border: 2px solid #2196F3; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; font-family: monospace; font-size: 18px; color: #2196F3; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .info-label { font-weight: bold; color: #666; }
    .info-value { color: #333; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .button { display: inline-block; background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> تم ربط حسابك بنجاح</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="success-box">
        <div class="success-icon">✅</div>
        <h3 style="color: #28a745; margin: 10px 0;">تم تحديث البريد الإلكتروني بنجاح!</h3>
      </div>
      
      <p style="text-align: center; color: #666;">سيتم استخدام هذا البريد الإلكتروني من الآن فصاعداً:</p>
      
      <div class="email-box">
        📧 ${newEmail}
      </div>
      
      <h3 style="color: #333; margin-top: 25px;">ما الذي تغير؟</h3>
      
      <ul style="color: #666; line-height: 1.8;">
        <li>✓ استخدم هذا البريد لتسجيل الدخول</li>
        <li>✓ ستصلك جميع التنبيهات على هذا البريد</li>
        <li>✓ سيتم استخدامه لاستعادة الحساب</li>
        <li>✓ رسائل التحقق ستُرسل إلى هذا البريد</li>
      </ul>
      
      <h3 style="color: #333; margin-top: 25px;">معلومات التغيير:</h3>
      
      <div class="info-row">
        <span class="info-label">الوقت:</span>
        <span class="info-value">${new Date(data.timestamp).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'long' })}</span>
      </div>
      
      
      <p style="margin-top: 25px; padding: 15px; background-color: #fff3cd; border-right: 4px solid #ffc107; border-radius: 6px;">
        <strong> تذكير:</strong> إذا لم تكن أنت من قام بهذا التغيير، يرجى التواصل مع فريق الدعم فوراً.
      </p>
      
      <center>
        <a href="${this.getFrontendUrl()}/settings" class="button">الذهاب إلى الإعدادات</a>
      </center>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
      <p style="margin-top: 10px; font-size: 12px;">© 2025 Rukny.io. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // ============================================
  // EVENT EMAIL TEMPLATES
  // ============================================

  private getEventRegistrationTemplate(userName: string, data: any): string {
    const eventTitle = data.eventTitleAr || data.eventTitle;
    const startDate = new Date(data.startDate).toLocaleString('ar-EG', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .event-box { background: #f8f9fa; border-right: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> تم التسجيل بنجاح!</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      <p>تم تسجيلك بنجاح في:</p>
      
      <div class="event-box">
        <h2 style="margin-top: 0; color: #333;">${eventTitle}</h2>
        <p><strong> الموعد:</strong> ${startDate}</p>
        ${data.location ? `<p><strong> الموقع:</strong> ${data.location}</p>` : ''}
        ${data.isVirtual && data.meetingUrl ? `<p><strong>🔗 رابط الاجتماع:</strong><br><a href="${data.meetingUrl}">${data.meetingUrl}</a></p>` : ''}
        ${data.organizerName ? `<p><strong> المنظم:</strong> ${data.organizerName}</p>` : ''}
      </div>
      
      <p>سيتم إرسال تذكير لك قبل الحدث بـ 24 ساعة.</p>
      
      <center>
        <a href="${this.getFrontendUrl()}/dashboard" class="btn">عرض تفاصيل الحدث</a>
      </center>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getEventReminderTemplate(userName: string, data: any): string {
    const eventTitle = data.eventTitleAr || data.eventTitle;
    const startDate = new Date(data.startDate).toLocaleString('ar-EG', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .reminder-box { background: #fff3cd; border-right: 4px solid #ffa726; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .btn { display: inline-block; background: #ffa726; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> تذكير بالحدث</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="reminder-box">
        <h2 style="margin-top: 0; color: #856404;">الحدث غداً!</h2>
        <h3 style="color: #333;">${eventTitle}</h3>
        <p><strong>📅 الموعد:</strong> ${startDate}</p>
        ${data.location ? `<p><strong>📍 الموقع:</strong> ${data.location}</p>` : ''}
        ${data.isVirtual && data.meetingUrl ? `<p><strong>🔗 رابط الاجتماع:</strong><br><a href="${data.meetingUrl}">${data.meetingUrl}</a></p>` : ''}
      </div>
      
      <p>نتطلع لرؤيتك في الحدث! 🎉</p>
      
      <center>
        <a href="${this.getFrontendUrl()}/dashboard" class="btn">عرض التفاصيل</a>
      </center>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getWaitlistTemplate(userName: string, data: any): string {
    const eventTitle = data.eventTitleAr || data.eventTitle;
    const startDate = new Date(data.startDate).toLocaleString('ar-EG', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .waitlist-box { background: #e3f2fd; border-right: 4px solid #42a5f5; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .btn { display: inline-block; background: #42a5f5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> قائمة الانتظار</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="waitlist-box">
        <h3 style="margin-top: 0; color: #1565c0;">تم إضافتك لقائمة الانتظار</h3>
        <h3 style="color: #333;">${eventTitle}</h3>
        <p><strong>📅 الموعد:</strong> ${startDate}</p>
      </div>
      
      <p>الحدث ممتلئ حالياً، لكن تم إضافتك لقائمة الانتظار.</p>
      <p>سيتم إشعارك فوراً عند توفر مقعد! ✨</p>
      
      <center>
        <a href="${this.getFrontendUrl()}/dashboard" class="btn">عرض حالة التسجيل</a>
      </center>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getWaitlistPromotionTemplate(userName: string, data: any): string {
    const eventTitle = data.eventTitleAr || data.eventTitle;
    const startDate = new Date(data.startDate).toLocaleString('ar-EG', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });
    const expiresAt = new Date(data.expiresAt).toLocaleString('ar-EG', { 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    });
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .promotion-box { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-right: 4px solid #66bb6a; padding: 25px; margin: 20px 0; border-radius: 8px; }
    .urgent-box { background: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 6px; text-align: center; }
    .btn { display: inline-block; background: #66bb6a; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .btn:hover { background: #43a047; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .emoji { font-size: 48px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">🎉</div>
      <h1>مقعد متاح الآن!</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="promotion-box">
        <h2 style="margin-top: 0; color: #2e7d32;">✨ أخبار رائعة!</h2>
        <h3 style="color: #333;">${eventTitle}</h3>
        <p><strong>📅 موعد الحدث:</strong> ${startDate}</p>
        <p style="font-size: 18px; color: #2e7d32; font-weight: bold;">مقعد أصبح متاحاً لك الآن! 🎊</p>
      </div>
      
      <div class="urgent-box">
        <h3 style="margin: 0 0 10px 0; color: #f57c00;">⏰ مهم جداً</h3>
        <p style="margin: 5px 0; font-size: 16px;">لديك <strong>24 ساعة فقط</strong> للتسجيل</p>
        <p style="margin: 5px 0; color: #666;">تنتهي الفرصة في: <strong>${expiresAt}</strong></p>
      </div>
      
      <p style="font-size: 16px;">لا تفوت هذه الفرصة! سارع بالتسجيل الآن قبل أن يتم منح المقعد لشخص آخر في قائمة الانتظار.</p>
      
      <center>
        <a href="${this.getFrontendUrl()}/dashboard/registrations" class="btn">تسجيل الآن 🚀</a>
      </center>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        <strong>ملاحظة:</strong> إذا لم تقم بالتسجيل خلال 24 ساعة، سيتم منح المقعد للشخص التالي في قائمة الانتظار.
      </p>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
      <p>لا تتردد في التواصل معنا إذا كان لديك أي استفسار</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getEventCancellationTemplate(userName: string, data: any): string {
    const eventTitle = data.eventTitleAr || data.eventTitle;
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #ef5350 0%, #d32f2f 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .cancel-box { background: #ffebee; border-right: 4px solid #ef5350; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .btn { display: inline-block; background: #ef5350; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> إلغاء الحدث</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="cancel-box">
        <h3 style="margin-top: 0; color: #c62828;">تم إلغاء الحدث</h3>
        <h3 style="color: #333;">${eventTitle}</h3>
        ${data.cancellationReason ? `<p><strong>السبب:</strong> ${data.cancellationReason}</p>` : ''}
      </div>
      
      <p>نعتذر عن أي إزعاج. نأمل أن نراك في أحداثنا القادمة! 🙏</p>
      
      <center>
        <a href="${this.getFrontendUrl()}/events" class="btn">تصفح الأحداث الأخرى</a>
      </center>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getEventCreatedTemplate(organizerName: string, data: any): string {
    const startDate = new Date(data.startDate).toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const eventUrl = `${this.getFrontendUrl()}/events/e/${data.slug}`;
    
    return `
<!DOCTYPE html>
<html lang="en">
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
                Hello ${organizerName},
              </p>
              <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 25px 0; line-height: 1.5;">
                Your event has been created successfully.
              </p>
            </td>
          </tr>
          
          <!-- Event Name Box -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center;">
                <span style="font-size: 18px; font-weight: 600; color: #166534;">${data.eventTitle}</span>
              </div>
            </td>
          </tr>
          
          <!-- Event Details -->
          <tr>
            <td style="padding: 20px 30px 10px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #4b5563;">
                    <strong>Date:</strong> ${startDate}
                  </td>
                </tr>
                ${data.location ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #4b5563;">
                    <strong>Location:</strong> ${data.location}
                  </td>
                </tr>
                ` : ''}
                ${data.isVirtual ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #4b5563;">
                    <strong>Type:</strong> Virtual Event
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          
          <!-- View Button -->
          <tr>
            <td style="padding: 15px 30px 25px 30px;">
              <a href="${eventUrl}" style="display: block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 8px; text-align: center; font-size: 14px; font-weight: 500;">
                View Event
              </a>
            </td>
          </tr>
          
          <!-- Info Text -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="font-size: 14px; color: #9ca3af; margin: 0;">
                Didn't create this event? <a href="mailto:support@rukny.store" style="color: #6366f1; text-decoration: underline;">Contact us</a>.
              </p>
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
  }

  private getNewRegistrationTemplate(organizerName: string, data: any): string {
    const progress = data.maxAttendees 
      ? `${data.totalRegistrations} / ${data.maxAttendees}` 
      : data.totalRegistrations;
    const percentage = data.maxAttendees 
      ? Math.round((data.totalRegistrations / data.maxAttendees) * 100)
      : 0;
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .notification-box { background: #d4edda; border-right: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .attendee-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px; border-right: 3px solid #4caf50; }
    .progress-box { margin: 20px 0; }
    .progress-bar { background: #e0e0e0; height: 25px; border-radius: 12px; overflow: hidden; }
    .progress-fill { background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%); height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; }
    .btn { display: inline-block; background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> تسجيل جديد!</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${organizerName}</strong>،</p>
      
      <div class="notification-box">
        <h3 style="margin-top: 0; color: #155724;">مشارك جديد في حدثك!</h3>
        <h3 style="color: #333;">${data.eventTitle}</h3>
      </div>
      
      <div class="attendee-box">
        <p><strong>👤 الاسم:</strong> ${data.attendeeName}</p>
        <p><strong>📧 البريد:</strong> ${data.attendeeEmail}</p>
      </div>
      
      ${data.maxAttendees ? `
      <div class="progress-box">
        <h4 style="color: #333; margin-bottom: 10px;">📊 عدد المسجلين: ${progress}</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%;">
            ${percentage}%
          </div>
        </div>
        ${percentage >= 80 ? `
        <p style="color: #ff9800; margin-top: 10px; font-weight: bold;">
          ⚠️ الحدث يقترب من الامتلاء!
        </p>
        ` : ''}
      </div>
      ` : `
      <div class="progress-box">
        <h4 style="color: #333;">📊 إجمالي المسجلين: ${data.totalRegistrations}</h4>
      </div>
      `}
      
      <p style="color: #666; margin-top: 20px;">
        يمكنك عرض جميع المسجلين وإدارة حدثك من لوحة التحكم.
      </p>
      
      <center>
        <a href="${this.getFrontendUrl()}/dashboard" class="btn">عرض جميع المسجلين</a>
      </center>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getOrganizerInvitationTemplate(userName: string, data: any): string {
    const roleNames = {
      OWNER: 'مالك الحدث',
      CO_ORGANIZER: 'منظم مشارك',
      MODERATOR: 'مشرف',
      ASSISTANT: 'مساعد',
    };
    const roleName = roleNames[data.role] || data.role;
    const acceptUrl = `${this.getFrontendUrl()}/events/e/${data.eventSlug}/organizers/accept`;
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #9c27b0 0%, #673ab7 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .invitation-box { background: #f3e5f5; border-right: 4px solid #9c27b0; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .role-badge { display: inline-block; background: #9c27b0; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
    .permissions-box { background: #fff; border: 1px solid #e0e0e0; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .permission-item { padding: 8px; margin: 5px 0; background: #f5f5f5; border-radius: 4px; }
    .btn-accept { display: inline-block; background: #4caf50; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: bold; }
    .btn-decline { display: inline-block; background: #f44336; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 دعوة لتنظيم حدث</h1>
    </div>
    <div class="content">
      <p>مرحباً <strong>${userName}</strong>،</p>
      
      <div class="invitation-box">
        <h3 style="margin-top: 0; color: #6a1b9a;">لقد تمت دعوتك لتكون منظماً!</h3>
        <p style="margin: 10px 0;"><strong>${data.inviterName}</strong> يدعوك لتنظيم الحدث التالي:</p>
        <h2 style="color: #333; margin: 15px 0;">${data.eventTitle}</h2>
        <div class="role-badge">${roleName}</div>
      </div>
      
      <h3 style="color: #333;">📋 صلاحياتك:</h3>
      <div class="permissions-box">
        ${data.permissions.map(perm => {
          const permNames = {
            manage_event: 'إدارة الحدث',
            edit_event: 'تعديل الحدث',
            delete_event: 'حذف الحدث',
            manage_organizers: 'إدارة المنظمين',
            manage_sponsors: 'إدارة الرعاة',
            manage_registrations: 'إدارة التسجيلات',
            view_registrations: 'عرض التسجيلات',
            view_analytics: 'عرض الإحصائيات',
            send_notifications: 'إرسال الإشعارات',
          };
          return `<div class="permission-item">✓ ${permNames[perm] || perm}</div>`;
        }).join('')}
      </div>
      
      <p style="margin-top: 25px; color: #666;">
        بصفتك <strong>${roleName}</strong>، ستتمكن من المساهمة في تنظيم وإدارة هذا الحدث.
      </p>
      
      <center>
        <a href="${acceptUrl}" class="btn-accept">✅ قبول الدعوة</a>
        <a href="${acceptUrl}" class="btn-decline">❌ رفض</a>
      </center>
      
      <p style="margin-top: 25px; padding: 15px; background: #e3f2fd; border-right: 4px solid #2196F3; border-radius: 4px; font-size: 14px;">
        <strong>💡 ملاحظة:</strong> يمكنك إدارة صلاحياتك وعرض تفاصيل الحدث بعد قبول الدعوة.
      </p>
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من Rukny.io</p>
      <p style="margin-top: 10px; font-size: 12px;">شكراً لمساهمتك! 🎉</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // ============================================
  // QUICKSIGN EMAIL METHODS
  // ============================================

  /**
   * إرسال QuickSign link للتسجيل الدخول
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
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');
      const quickSignBaseUrl =
        this.configService.get('AUTH_BASE_URL') ||
        this.configService.get('API_BASE_URL') ||
        this.configService.get('BACKEND_URL') ||
        'http://localhost:3001';
      const normalizedQuickSignBaseUrl = quickSignBaseUrl.replace(/\/+$/, '');
      const quickSignLink = `${normalizedQuickSignBaseUrl}/api/v1/auth/quicksign/verify/${token}`;

      // قراءة template من الملف - دعم development و production
      const isDevelopment = !__dirname.includes('dist');
      const templatePath = isDevelopment
        ? path.join(__dirname, 'templates', 'quicksign-login.html')
        : path.join(
            __dirname,
            '..',
            '..',
            'integrations',
            'email',
            'templates',
            'quicksign-login.html',
          );
      let template = fs.readFileSync(templatePath, 'utf-8');

      // استبدال المتغيرات
      template = template
        .replace(/{{name}}/g, to.split('@')[0])
        .replace(/{{quickSignLink}}/g, quickSignLink);

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: 'Sign in to Rukny',
        html: template,
      };

      if (this.transporter) {
        await this.transporter.sendMail(mailOptions);
        console.log(`✅ QuickSign login link sent to ${to}`);
      } else {
        console.log(
          `📧 [SIMULATED] QuickSign login link would be sent to ${to}`,
        );
        console.log(`   Link: ${quickSignLink}`);
      }
    } catch (error) {
      console.error('❌ Failed to send QuickSign login email:', error);
    }
  }

  /**
   * إرسال QuickSign link للتسجيل (مستخدم جديد)
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
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');
      const quickSignBaseUrl =
        this.configService.get('AUTH_BASE_URL') ||
        this.configService.get('API_BASE_URL') ||
        this.configService.get('BACKEND_URL') ||
        'http://localhost:3001';
      const normalizedQuickSignBaseUrl = quickSignBaseUrl.replace(/\/+$/, '');
      const quickSignLink = `${normalizedQuickSignBaseUrl}/api/v1/auth/quicksign/verify/${token}`;

      // قراءة template من الملف - دعم development و production
      const isDevelopment = !__dirname.includes('dist');
      const templatePath = isDevelopment
        ? path.join(__dirname, 'templates', 'quicksign-signup.html')
        : path.join(
            __dirname,
            '..',
            '..',
            'integrations',
            'email',
            'templates',
            'quicksign-signup.html',
          );
      let template = fs.readFileSync(templatePath, 'utf-8');

      // استبدال المتغيرات
      template = template
        .replace(/{{email}}/g, to)
        .replace(/{{quickSignLink}}/g, quickSignLink)
        .replace(/{{ipAddress}}/g, deviceInfo.ipAddress || 'غير معروف')
        .replace(/{{browser}}/g, deviceInfo.browser || 'غير معروف')
        .replace(/{{os}}/g, deviceInfo.os || 'غير معروف')
        .replace(
          /{{timestamp}}/g,
          new Date().toLocaleString('ar-EG', {
            dateStyle: 'full',
            timeStyle: 'long',
          }),
        );

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: '🎉 مرحباً بك في Rukny.io - إكمال التسجيل',
        html: template,
      };

      if (this.transporter) {
        await this.transporter.sendMail(mailOptions);
        console.log(`✅ QuickSign signup link sent to ${to}`);
      } else {
        console.log(
          `📧 [SIMULATED] QuickSign signup link would be sent to ${to}`,
        );
        console.log(`   Link: ${quickSignLink}`);
      }
    } catch (error) {
      console.error('❌ Failed to send QuickSign signup email:', error);
    }
  }

  /**
   * إرسال رمز التحقق لتغيير IP
   */
  async sendIPVerificationCode(
    to: string,
    name: string,
    code: string,
    ipInfo: {
      currentIP: string;
      lastKnownIP: string;
      browser?: string;
      os?: string;
      deviceType?: string;
    },
  ) {
    try {
      const fromEmail = this.configService.get(
        'SMTP_FROM_EMAIL',
        'notifications@rukny.store',
      );
      const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

      // قراءة template من الملف
      const templatePath = path.join(
        __dirname,
        'templates',
        'verification-code.html',
      );
      let template = fs.readFileSync(templatePath, 'utf-8');

      // استبدال المتغيرات
      template = template
        .replace(/{{name}}/g, name)
        .replace(/{{code}}/g, code)
        .replace(/{{currentIP}}/g, ipInfo.currentIP)
        .replace(/{{lastKnownIP}}/g, ipInfo.lastKnownIP)
        .replace(/{{browser}}/g, ipInfo.browser || 'غير معروف')
        .replace(/{{os}}/g, ipInfo.os || 'غير معروف')
        .replace(/{{deviceType}}/g, ipInfo.deviceType || 'غير معروف')
        .replace(
          /{{timestamp}}/g,
          new Date().toLocaleString('ar-EG', {
            dateStyle: 'full',
            timeStyle: 'long',
          }),
        );

      const mailOptions = {
        from: `"${fromName} Security" <${fromEmail}>`,
        to,
        subject: '🔐 رمز التحقق - تم اكتشاف IP جديد',
        html: template,
      };

      if (this.transporter) {
        await this.transporter.sendMail(mailOptions);
        console.log(`✅ IP verification code sent to ${to}`);
      } else {
        console.log(
          `📧 [SIMULATED] IP verification code would be sent to ${to}`,
        );
        console.log(`   Code: ${code}`);
      }
    } catch (error) {
      console.error('❌ Failed to send IP verification code:', error);
    }
  }

  /**
   * Send notification when a form receives a new submission
   */
  async sendFormSubmissionNotification(
    to: string,
    formTitle: string,
    submissionData: Record<string, any>,
    formId: string,
  ) {
    try {
      const frontendUrl = this.getFrontendUrl();
      const formUrl = `${frontendUrl}/app/forms/${formId}/responses`;
      
      // Build submission summary (limit to first 5 fields)
      const entries = Object.entries(submissionData || {}).slice(0, 5);
      const submissionHtml = entries.length > 0
        ? entries.map(([key, value]) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 40%;">${key}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #1a1a1a;">${String(value || '-').substring(0, 100)}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #9ca3af;">No data submitted</td></tr>';

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <span style="font-size: 24px; font-weight: bold; color: #1a1a1a;">Rukny</span>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px;">
              <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 10px 0;">
                📝 <strong>New Form Response</strong>
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0;">
                Your form "<strong>${formTitle}</strong>" has received a new submission.
              </p>
            </td>
          </tr>
          
          <!-- Submission Data -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                ${submissionHtml}
              </table>
              ${entries.length >= 5 ? '<p style="font-size: 12px; color: #9ca3af; margin: 10px 0 0 0; text-align: center;">+ more fields</p>' : ''}
            </td>
          </tr>
          
          <!-- Button -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <a href="${formUrl}" style="display: block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 8px; text-align: center; font-size: 14px; font-weight: 500;">
                View All Responses
              </a>
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

      await this.sendEmail({
        to,
        subject: `📝 New response: ${formTitle}`,
        html,
      });
    } catch (error) {
      console.error('❌ Failed to send form submission notification:', error);
      // Don't throw - email failure shouldn't block submission
    }
  }

  /**
   * Send auto-response email to form submitter
   */
  async sendAutoResponse(
    to: string,
    formTitle: string,
    customMessage: string,
  ) {
    try {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 450px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <span style="font-size: 24px; font-weight: bold; color: #1a1a1a;">Rukny</span>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td style="padding: 0 30px; text-align: center;">
              <div style="width: 60px; height: 60px; background-color: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 28px;">✅</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px;">
              <p style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 0 0 10px 0; text-align: center;">
                Response Received!
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0; text-align: center;">
                Thank you for submitting "<strong>${formTitle}</strong>"
              </p>
            </td>
          </tr>
          
          <!-- Custom Message -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; border-left: 4px solid #22c55e;">
                <p style="font-size: 14px; color: #166534; margin: 0; line-height: 1.6; white-space: pre-wrap;">${customMessage}</p>
              </div>
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

      await this.sendEmail({
        to,
        subject: `✅ Thank you for your submission – ${formTitle}`,
        html,
      });
    } catch (error) {
      console.error('❌ Failed to send auto-response:', error);
      // Don't throw - email failure shouldn't block submission
    }
  }

  /**
   * Send notification when a new form is created with QR code
   */
  async sendFormCreatedNotification(
    to: string,
    userName: string,
    formData: {
      formTitle: string;
      formSlug: string;
      formId: string;
    },
  ) {
    try {
      const frontendUrl = this.getFrontendUrl();
      const formUrl = `${frontendUrl}/f/${formData.formSlug}`;
      // Generate QR code as base64 using Google Charts API (works in emails)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(formUrl)}`;

      const html = this.getFormCreatedTemplate(userName, {
        ...formData,
        formUrl,
        qrCodeUrl,
      });

      await this.sendEmail({
        to,
        subject: `Your form has been created – Rukny`,
        html,
      });
    } catch (error) {
      console.error('❌ Failed to send form created notification:', error);
      // Don't throw - email failure shouldn't block form creation
    }
  }

  private getFormCreatedTemplate(
    userName: string,
    data: {
      formTitle: string;
      formSlug: string;
      formUrl: string;
      qrCodeUrl: string;
    },
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
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
                Your form has been created successfully.
              </p>
            </td>
          </tr>
          
          <!-- Form Name Box -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center;">
                <span style="font-size: 18px; font-weight: 600; color: #166534;">${data.formTitle}</span>
              </div>
            </td>
          </tr>
          
          <!-- QR Code -->
          <tr>
            <td style="padding: 25px 30px; text-align: center;">
              <p style="font-size: 14px; color: #4b5563; margin: 0 0 15px 0;">Scan to open your form:</p>
              <img src="${data.qrCodeUrl}" alt="QR Code" width="150" height="150" style="border-radius: 8px; border: 1px solid #e5e7eb;" />
            </td>
          </tr>
          
          <!-- View Button -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <a href="${data.formUrl}" style="display: block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 8px; text-align: center; font-size: 14px; font-weight: 500;">
                View Form
              </a>
            </td>
          </tr>
          
          <!-- Info Text -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="font-size: 14px; color: #9ca3af; margin: 0;">
                Didn't create this form? <a href="mailto:support@rukny.store" style="color: #6366f1; text-decoration: underline;">Contact us</a>.
              </p>
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
  }
}
