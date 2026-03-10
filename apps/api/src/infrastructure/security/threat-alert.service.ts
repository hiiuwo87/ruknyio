import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityLogService } from './log.service';

/**
 * 🚨 Threat Alert Service
 *
 * إرسال تنبيهات فورية للتهديدات الأمنية عبر:
 * - Telegram
 * - Slack
 * - Discord
 * - Webhook مخصص
 */
@Injectable()
export class ThreatAlertService {
  private readonly logger = new Logger(ThreatAlertService.name);

  private readonly telegramBotToken: string;
  private readonly telegramChatId: string;
  private readonly slackWebhook: string;
  private readonly discordWebhook: string;
  private readonly customWebhook: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly securityLogService: SecurityLogService,
  ) {
    this.telegramBotToken = this.configService.get('TELEGRAM_BOT_TOKEN') || '';
    this.telegramChatId = this.configService.get('TELEGRAM_CHAT_ID') || '';
    this.slackWebhook = this.configService.get('SLACK_WEBHOOK_URL') || '';
    this.discordWebhook = this.configService.get('DISCORD_WEBHOOK_URL') || '';
    this.customWebhook = this.configService.get('ALERT_WEBHOOK_URL') || '';
  }

  /**
   * إرسال تنبيه تهديد
   */
  async sendThreatAlert(alert: {
    type:
      | 'BRUTE_FORCE'
      | 'SUSPICIOUS_LOGIN'
      | 'ACCOUNT_TAKEOVER'
      | 'DATA_BREACH'
      | 'INJECTION_ATTEMPT'
      | 'RATE_LIMIT_EXCEEDED'
      | 'UNAUTHORIZED_ACCESS';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    description: string;
    userId?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const timestamp = new Date().toISOString();

    // تسجيل في السجلات
    await this.securityLogService.createLog({
      userId: alert.userId || 'unknown',
      action: 'SUSPICIOUS_ACTIVITY',
      status: 'WARNING',
      description: `[${alert.severity}] ${alert.type} - ${alert.title}: ${alert.description}`,
      ipAddress: alert.ipAddress,
      metadata: alert.metadata,
    });

    // إنشاء الرسالة
    const message = this.formatAlertMessage(alert, timestamp);

    // إرسال التنبيهات بالتوازي
    const promises: Promise<void>[] = [];

    if (this.telegramBotToken && this.telegramChatId) {
      promises.push(this.sendTelegramAlert(message, alert.severity));
    }

    if (this.slackWebhook) {
      promises.push(this.sendSlackAlert(alert, timestamp));
    }

    if (this.discordWebhook) {
      promises.push(this.sendDiscordAlert(alert, timestamp));
    }

    if (this.customWebhook) {
      promises.push(this.sendWebhookAlert(alert, timestamp));
    }

    await Promise.allSettled(promises);
  }

  /**
   * تنسيق رسالة التنبيه
   */
  private formatAlertMessage(
    alert: any,
    timestamp: string,
  ): string {
    const severityEmoji = {
      LOW: 'ℹ️',
      MEDIUM: '⚠️',
      HIGH: '🔴',
      CRITICAL: '🚨',
    };

    return `
${severityEmoji[alert.severity]} **${alert.severity} SECURITY ALERT**

📌 **Type:** ${alert.type}
📝 **Title:** ${alert.title}
📄 **Description:** ${alert.description}
${alert.userId ? `👤 **User ID:** ${alert.userId}` : ''}
${alert.ipAddress ? `🌐 **IP:** ${alert.ipAddress}` : ''}
⏰ **Time:** ${timestamp}
    `.trim();
  }

  /**
   * إرسال تنبيه Telegram
   */
  private async sendTelegramAlert(
    message: string,
    severity: string,
  ): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text: message,
          parse_mode: 'Markdown',
          disable_notification: severity === 'LOW',
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      this.logger.debug('Telegram alert sent successfully');
    } catch (error) {
      this.logger.error(`Failed to send Telegram alert: ${error.message}`);
    }
  }

  /**
   * إرسال تنبيه Slack
   */
  private async sendSlackAlert(alert: any, timestamp: string): Promise<void> {
    try {
      const color = {
        LOW: '#36a64f',
        MEDIUM: '#daa520',
        HIGH: '#ff6600',
        CRITICAL: '#ff0000',
      };

      const response = await fetch(this.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color: color[alert.severity],
              title: `🚨 ${alert.severity} Security Alert: ${alert.title}`,
              text: alert.description,
              fields: [
                { title: 'Type', value: alert.type, short: true },
                { title: 'Severity', value: alert.severity, short: true },
                ...(alert.userId
                  ? [{ title: 'User ID', value: alert.userId, short: true }]
                  : []),
                ...(alert.ipAddress
                  ? [{ title: 'IP Address', value: alert.ipAddress, short: true }]
                  : []),
              ],
              footer: 'Rukny Security',
              ts: Math.floor(new Date(timestamp).getTime() / 1000),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      this.logger.debug('Slack alert sent successfully');
    } catch (error) {
      this.logger.error(`Failed to send Slack alert: ${error.message}`);
    }
  }

  /**
   * إرسال تنبيه Discord
   */
  private async sendDiscordAlert(alert: any, timestamp: string): Promise<void> {
    try {
      const color = {
        LOW: 0x36a64f,
        MEDIUM: 0xdaa520,
        HIGH: 0xff6600,
        CRITICAL: 0xff0000,
      };

      const response = await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `🚨 ${alert.severity} Security Alert`,
              description: alert.description,
              color: color[alert.severity],
              fields: [
                { name: 'Type', value: alert.type, inline: true },
                { name: 'Title', value: alert.title, inline: true },
                ...(alert.userId
                  ? [{ name: 'User ID', value: alert.userId, inline: true }]
                  : []),
                ...(alert.ipAddress
                  ? [{ name: 'IP Address', value: alert.ipAddress, inline: true }]
                  : []),
              ],
              timestamp,
              footer: { text: 'Rukny Security System' },
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
      }

      this.logger.debug('Discord alert sent successfully');
    } catch (error) {
      this.logger.error(`Failed to send Discord alert: ${error.message}`);
    }
  }

  /**
   * إرسال تنبيه Webhook مخصص
   */
  private async sendWebhookAlert(alert: any, timestamp: string): Promise<void> {
    try {
      const response = await fetch(this.customWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Severity': alert.severity,
          'X-Alert-Type': alert.type,
        },
        body: JSON.stringify({
          ...alert,
          timestamp,
          source: 'rukny-security',
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      this.logger.debug('Webhook alert sent successfully');
    } catch (error) {
      this.logger.error(`Failed to send webhook alert: ${error.message}`);
    }
  }

  // ==================== Quick Alert Methods ====================

  async alertBruteForce(
    ip: string,
    attempts: number,
    userId?: string,
  ): Promise<void> {
    await this.sendThreatAlert({
      type: 'BRUTE_FORCE',
      severity: attempts > 20 ? 'CRITICAL' : 'HIGH',
      title: 'Brute Force Attack Detected',
      description: `${attempts} failed login attempts from IP ${ip}`,
      userId,
      ipAddress: ip,
      metadata: { attempts },
    });
  }

  async alertSuspiciousLogin(
    userId: string,
    reasons: string[],
    riskScore: number,
    ip?: string,
  ): Promise<void> {
    const severity =
      riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : 'MEDIUM';

    await this.sendThreatAlert({
      type: 'SUSPICIOUS_LOGIN',
      severity,
      title: 'Suspicious Login Detected',
      description: reasons.join(', '),
      userId,
      ipAddress: ip,
      metadata: { riskScore, reasons },
    });
  }

  async alertUnauthorizedAccess(
    resource: string,
    userId?: string,
    ip?: string,
  ): Promise<void> {
    await this.sendThreatAlert({
      type: 'UNAUTHORIZED_ACCESS',
      severity: 'HIGH',
      title: 'Unauthorized Access Attempt',
      description: `Attempted access to protected resource: ${resource}`,
      userId,
      ipAddress: ip,
      metadata: { resource },
    });
  }

  async alertInjectionAttempt(
    type: 'SQL' | 'XSS' | 'CMD',
    payload: string,
    ip?: string,
  ): Promise<void> {
    await this.sendThreatAlert({
      type: 'INJECTION_ATTEMPT',
      severity: 'CRITICAL',
      title: `${type} Injection Attempt`,
      description: `Malicious payload detected: ${payload.substring(0, 100)}...`,
      ipAddress: ip,
      metadata: { injectionType: type, payload: payload.substring(0, 500) },
    });
  }

  async alertRateLimitExceeded(
    endpoint: string,
    requests: number,
    ip?: string,
    userId?: string,
  ): Promise<void> {
    await this.sendThreatAlert({
      type: 'RATE_LIMIT_EXCEEDED',
      severity: requests > 1000 ? 'HIGH' : 'MEDIUM',
      title: 'Rate Limit Exceeded',
      description: `${requests} requests to ${endpoint}`,
      userId,
      ipAddress: ip,
      metadata: { endpoint, requests },
    });
  }
}
