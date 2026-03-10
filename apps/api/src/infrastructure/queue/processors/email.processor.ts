import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from '../../../integrations/email/email.service';

/**
 * 📧 Email Processor
 *
 * معالج مهام إرسال البريد الإلكتروني
 */
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('welcome')
  async handleWelcome(job: Job<{ to: string; context: { name: string } }>) {
    this.logger.debug(`Processing welcome email to ${job.data.to}`);

    // Use generic email method for welcome
    await this.emailService.sendEmail({
      to: job.data.to,
      subject: 'مرحباً بك في ركني',
      html: `<h1>مرحباً ${job.data.context.name}</h1><p>شكراً لانضمامك إلى ركني!</p>`,
    });

    this.logger.log(`Welcome email sent to ${job.data.to}`);
  }

  @Process('verification')
  async handleVerification(
    job: Job<{ to: string; context: { code: string; name: string; ipAddress?: string } }>,
  ) {
    this.logger.debug(`Processing verification email to ${job.data.to}`);

    await this.emailService.sendIPVerificationCode(
      job.data.to,
      job.data.context.name,
      job.data.context.code,
      {
        currentIP: job.data.context.ipAddress || 'unknown',
        lastKnownIP: 'unknown',
      },
    );

    this.logger.log(`Verification email sent to ${job.data.to}`);
  }

  @Process('security-alert')
  async handleSecurityAlert(
    job: Job<{ to: string; context: { alertType: string; [key: string]: any } }>,
  ) {
    this.logger.debug(`Processing security alert email to ${job.data.to}`);

    const { alertType, name, ...details } = job.data.context;

    switch (alertType) {
      case 'new_device':
        await this.emailService.sendNewDeviceAlert(
          job.data.to,
          name || 'User',
          {
            deviceName: details.deviceName || 'Unknown Device',
            deviceType: details.deviceType || 'unknown',
            browser: details.browser,
            os: details.os,
            ipAddress: details.ipAddress,
            location: details.location,
            timestamp: details.timestamp ? new Date(details.timestamp) : new Date(),
          },
        );
        break;

      case 'password_changed':
        await this.emailService.sendPasswordChangeAlert(
          job.data.to,
          name || 'User',
          {
            ipAddress: details.ipAddress,
            location: details.location,
            timestamp: details.timestamp ? new Date(details.timestamp) : new Date(),
          },
        );
        break;

      case 'failed_login':
        await this.emailService.sendFailedLoginAlert(
          job.data.to,
          name || 'User',
          {
            failedAttempts: details.failedAttempts || 1,
            ipAddress: details.ipAddress,
            timeWindow: details.timeWindow || 60,
            timestamp: details.timestamp ? new Date(details.timestamp) : new Date(),
          },
        );
        break;

      default:
        this.logger.warn(`Unknown security alert type: ${alertType}`);
    }

    this.logger.log(`Security alert (${alertType}) sent to ${job.data.to}`);
  }

  @Process('password-reset')
  async handlePasswordReset(
    job: Job<{ to: string; context: { name: string; resetUrl: string } }>,
  ) {
    this.logger.debug(`Processing password reset email to ${job.data.to}`);

    // Use generic email method for password reset
    await this.emailService.sendEmail({
      to: job.data.to,
      subject: 'إعادة تعيين كلمة المرور',
      html: `
        <h1>إعادة تعيين كلمة المرور</h1>
        <p>مرحباً ${job.data.context.name}</p>
        <p>لإعادة تعيين كلمة المرور، اضغط على الرابط التالي:</p>
        <a href="${job.data.context.resetUrl}">إعادة تعيين كلمة المرور</a>
        <p>هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
      `,
    });

    this.logger.log(`Password reset email sent to ${job.data.to}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Email job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }
}
