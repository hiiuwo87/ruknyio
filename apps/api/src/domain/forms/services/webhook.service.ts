import { Injectable, Logger } from '@nestjs/common';
import * as net from 'node:net';
import axios from 'axios';
import * as crypto from 'crypto';

export interface WebhookPayload {
  event:
    | 'form.submission.created'
    | 'form.submission.updated'
    | 'form.submission.deleted';
  timestamp: string;
  formId: string;
  formSlug: string;
  submissionId?: string;
  data?: any;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  /**
   * Send webhook notification to external URL
   */
  async sendWebhook(
    webhookUrl: string,
    payload: WebhookPayload,
    secret?: string,
  ): Promise<boolean> {
    try {
      // Basic SSRF protection: validate URL before sending
      if (!this.isSafeWebhookUrl(webhookUrl)) {
        this.logger.warn(`Blocked webhook to unsafe URL: ${webhookUrl}`);
        return false;
      }
      // Generate signature if secret is provided
      const headers: any = {
        'Content-Type': 'application/json',
        'User-Agent': 'Rukny-Forms-Webhook/1.0',
      };

      if (secret) {
        const signature = this.generateSignature(payload, secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Send POST request
      const response = await axios.post(webhookUrl, payload, {
        headers,
        timeout: 10000, // 10 seconds timeout
        maxRedirects: 0,
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Webhook sent successfully to ${webhookUrl}`);
        return true;
      } else {
        this.logger.warn(
          `Webhook returned non-2xx status: ${response.status} for ${webhookUrl}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Failed to send webhook to ${webhookUrl}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Validate webhook URL to prevent SSRF to internal networks
   * - Only allow http/https
   * - Block localhost and private IP ranges
   */
  private isSafeWebhookUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return false;

      const host = url.hostname.toLowerCase();
      // Block localhost names
      if (['localhost', '127.0.0.1', '::1'].includes(host)) return false;

      // If host is an IP, block private ranges
      if (net.isIP(host)) {
        if (
          host.startsWith('10.') ||
          host.startsWith('192.168.') ||
          host.startsWith('127.') ||
          host === '::1' ||
          host.startsWith('169.254.') ||
          (host.startsWith('172.') &&
            (() => {
              const second = parseInt(host.split('.')[1] || '0', 10);
              return second >= 16 && second <= 31;
            })())
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Send form submission webhook
   */
  async notifyFormSubmission(
    webhookUrl: string,
    webhookSecret: string | null,
    formId: string,
    formSlug: string,
    submissionId: string,
    submissionData: any,
  ): Promise<void> {
    const payload: WebhookPayload = {
      event: 'form.submission.created',
      timestamp: new Date().toISOString(),
      formId,
      formSlug,
      submissionId,
      data: submissionData,
    };

    await this.sendWebhook(webhookUrl, payload, webhookSecret);
  }

  /**
   * Send form submission updated webhook
   */
  async notifyFormSubmissionUpdated(
    webhookUrl: string,
    webhookSecret: string | null,
    formId: string,
    formSlug: string,
    submissionId: string,
    submissionData: any,
  ): Promise<void> {
    const payload: WebhookPayload = {
      event: 'form.submission.updated',
      timestamp: new Date().toISOString(),
      formId,
      formSlug,
      submissionId,
      data: submissionData,
    };

    await this.sendWebhook(webhookUrl, payload, webhookSecret);
  }

  /**
   * Send form submission deleted webhook
   */
  async notifyFormSubmissionDeleted(
    webhookUrl: string,
    webhookSecret: string | null,
    formId: string,
    formSlug: string,
    submissionId: string,
  ): Promise<void> {
    const payload: WebhookPayload = {
      event: 'form.submission.deleted',
      timestamp: new Date().toISOString(),
      formId,
      formSlug,
      submissionId,
    };

    await this.sendWebhook(webhookUrl, payload, webhookSecret);
  }

  /**
   * Test webhook URL (for configuration testing)
   */
  async testWebhook(webhookUrl: string, secret?: string): Promise<boolean> {
    const testPayload: WebhookPayload = {
      event: 'form.submission.created',
      timestamp: new Date().toISOString(),
      formId: 'test-form-id',
      formSlug: 'test-form',
      submissionId: 'test-submission-id',
      data: {
        test: true,
        message: 'This is a test webhook from Rukny Forms',
      },
    };

    return this.sendWebhook(webhookUrl, testPayload, secret);
  }
}
