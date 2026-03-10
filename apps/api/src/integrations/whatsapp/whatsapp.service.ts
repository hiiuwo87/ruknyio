import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * 📱 خدمة واتساب - WhatsApp Service
 *
 * التعامل مع WhatsApp Personal API لإرسال الرسائل
 * يشمل: OTP، تأكيد الطلبات، تحديثات الحالة
 */

export interface WhatsappMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsappSessionStatus {
  connected: boolean;
  phone?: string;
  name?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly client: AxiosInstance;
  private readonly sessionId: string;
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'WHATSAPP_API_URL',
      'https://message.dashboard.technoplus.tech',
    );
    this.sessionId = this.configService.get<string>('WHATSAPP_SESSION_ID', '');
    const accessToken = this.configService.get<string>(
      'WHATSAPP_ACCESS_TOKEN',
      '',
    );

    this.enabled = !!(this.sessionId && accessToken);

    if (!this.enabled) {
      this.logger.warn(
        '⚠️ WhatsApp service disabled - Missing WHATSAPP_SESSION_ID or WHATSAPP_ACCESS_TOKEN',
      );
    } else {
      this.logger.log('✅ WhatsApp service enabled');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 45000, // ⏱️ 45 seconds timeout (WhatsApp API can be slow)
    });
  }

  /**
   * 🔍 فحص حالة الاتصال بواتساب
   */
  async checkConnection(): Promise<WhatsappSessionStatus> {
    if (!this.enabled) {
      return { connected: false };
    }

    try {
      const response = await this.client.get(
        `/whatsapp/api/v1/session/${this.sessionId}/check`,
      );

      return {
        connected: response.data?.connected || false,
        phone: response.data?.phone,
        name: response.data?.name,
      };
    } catch (error) {
      this.logger.error('Failed to check WhatsApp connection:', error?.message);
      return { connected: false };
    }
  }

  /**
   * 📤 إرسال رسالة نصية
   */
  async sendTextMessage(
    receiver: string,
    text: string,
  ): Promise<WhatsappMessageResult> {
    if (!this.enabled) {
      this.logger.warn('⚠️ WhatsApp disabled, skipping message to:', receiver);
      return {
        success: false,
        error: 'WhatsApp service disabled - Missing credentials',
      };
    }

    try {
      const formattedReceiver = this.formatPhoneNumber(receiver);
      this.logger.log(`📤 Sending WhatsApp message to ${formattedReceiver}`);

      const response = await this.client.post(
        '/whatsapp/api/v1/message/text/send',
        {
          session_id: this.sessionId,
          receiver: formattedReceiver,
          text,
        },
      );

      this.logger.log(
        `✅ WhatsApp message sent to ${receiver}. MessageId: ${response.data?.messageId}`,
      );
      return {
        success: true,
        messageId: response.data?.messageId,
      };
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      const providerMessage =
        data?.message ||
        data?.error ||
        data?.msg ||
        (typeof data === 'string' ? data : undefined);

      this.logger.error(
        `❌ Failed to send WhatsApp message to ${receiver}: ${error?.message}` +
          (status ? ` (HTTP ${status})` : '') +
          (providerMessage ? ` | Provider: ${providerMessage}` : ''),
      );

      if (data && typeof data === 'object') {
        try {
          this.logger.debug(`WhatsApp API response: ${JSON.stringify(data)}`);
        } catch {
          // ignore JSON stringify errors
        }
      }

      // Check if it's a timeout error
      if (
        error?.code === 'ECONNABORTED' ||
        error?.message?.includes('timeout')
      ) {
        return {
          success: false,
          error: 'WhatsApp API timeout - service might be unavailable',
        };
      }

      return {
        success: false,
        error:
          providerMessage || error?.message || 'Unknown WhatsApp API error',
      };
    }
  }

  /**
   * 🔐 إرسال رمز OTP
   */
  async sendOtpMessage(
    phoneNumber: string,
    code: string,
  ): Promise<WhatsappMessageResult> {
    const message = this.formatOtpMessage(code);
    return this.sendTextMessage(phoneNumber, message);
  }

  /**
   * 📦 إرسال تأكيد الطلب
   */
  async sendOrderConfirmation(
    phoneNumber: string,
    orderData: {
      orderNumber: string;
      items: Array<{ name: string; price: number }>;
      total: number;
      address: string;
      paymentMethod: string;
    },
  ): Promise<WhatsappMessageResult> {
    const message = this.formatOrderConfirmationMessage(orderData);
    return this.sendTextMessage(phoneNumber, message);
  }

  /**
   * 📦 إرسال تحديث حالة الطلب
   */
  async sendOrderStatusUpdate(
    phoneNumber: string,
    updateData: {
      orderNumber: string;
      status: string;
      statusMessage: string;
      trackingUrl?: string;
      deliveryPhone?: string;
      total?: number;
    },
  ): Promise<WhatsappMessageResult> {
    const message = this.formatOrderStatusMessage(updateData);
    return this.sendTextMessage(phoneNumber, message);
  }

  // ============ Private Helper Methods ============

  /**
   * تنسيق رقم الهاتف
   */
  private formatPhoneNumber(phone: string): string {
    // إزالة المسافات والشرطات
    let formatted = phone.replace(/[\s-]/g, '');

    // التأكد من وجود + في البداية
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }

    return formatted;
  }

  /**
   * 🔐 قالب رسالة OTP
   */
  private formatOtpMessage(code: string): string {
    return `*${code}* هو رمز التحقق الخاص بك. للحفاظ على أمانك، لا تشارك هذا الرمز مع أي شخص.`;
  }

  /**
   * 📦 قالب تأكيد الطلب
   */
  private formatOrderConfirmationMessage(orderData: {
    orderNumber: string;
    items: Array<{ name: string; price: number }>;
    total: number;
    address: string;
    paymentMethod: string;
  }): string {
    return `تم تأكيد طلبك رقم ${orderData.orderNumber} بمبلغ ${this.formatPrice(orderData.total)}. سيتم التواصل معك لتأكيد موعد التوصيل.`;
  }

  /**
   * 📦 قالب تحديث حالة الطلب
   */
  private formatOrderStatusMessage(updateData: {
    orderNumber: string;
    status: string;
    statusMessage: string;
    trackingUrl?: string;
    deliveryPhone?: string;
    total?: number;
  }): string {
    let message = `طلبك ${updateData.orderNumber}: ${updateData.statusMessage}`;

    if (updateData.deliveryPhone) {
      message += ` | المندوب: ${updateData.deliveryPhone}`;
    }

    if (updateData.total && updateData.status === 'OUT_FOR_DELIVERY') {
      message += ` | المبلغ: ${this.formatPrice(updateData.total)}`;
    }

    return message;
  }

  /**
   * تنسيق السعر بالدينار العراقي
   */
  private formatPrice(price: number): string {
    return `${price.toLocaleString('ar-IQ')} د.ع`;
  }

  /**
   * هل الخدمة مفعلة؟
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
