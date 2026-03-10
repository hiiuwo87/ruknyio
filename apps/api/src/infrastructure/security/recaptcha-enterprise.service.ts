import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 🔒 reCAPTCHA Enterprise Service
 * 
 * خدمة للتحقق من رموز reCAPTCHA Enterprise 
 * تستخدم Google reCAPTCHA Enterprise API لتقييم الرموز المميزة
 */
@Injectable()
export class RecaptchaEnterpriseService {
  private readonly logger = new Logger(RecaptchaEnterpriseService.name);
  private readonly projectId: string;
  private readonly siteKey: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.projectId = this.configService.get<string>('RECAPTCHA_PROJECT_ID') || '';
    this.siteKey = this.configService.get<string>('RECAPTCHA_SITE_KEY') || '6LcYWWAsAAAAAJpv0z4pIQqOIhl05dUUzauUEG2D';
    this.apiKey = this.configService.get<string>('RECAPTCHA_API_KEY') || '';
    
    if (!this.projectId || !this.apiKey) {
      this.logger.warn('reCAPTCHA Enterprise configuration missing. Service will be disabled.');
    }
  }

  /**
   * التحقق من رمز reCAPTCHA Enterprise
   */
  async verifyToken(
    token: string, 
    action: string = 'FORM_SUBMIT',
    remoteIp?: string
  ): Promise<{
    success: boolean;
    score: number;
    action: string;
    challenge_ts?: string;
    hostname?: string;
    error?: string;
  }> {
    if (!this.projectId || !this.apiKey) {
      this.logger.warn('reCAPTCHA verification skipped - service not configured');
      return {
        success: true,
        score: 1.0,
        action: action,
        error: 'Service not configured'
      };
    }

    if (!token) {
      throw new BadRequestException({
        message: 'reCAPTCHA token is required',
        code: 'RECAPTCHA_TOKEN_MISSING'
      });
    }

    try {
      const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${this.projectId}/assessments?key=${this.apiKey}`;
      
      const requestData = {
        event: {
          token: token,
          siteKey: this.siteKey,
          expectedAction: action,
          remoteIp: remoteIp
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(`reCAPTCHA API error: ${response.status}`, errorData);
        
        throw new BadRequestException({
          message: 'reCAPTCHA verification failed',
          code: 'RECAPTCHA_API_ERROR',
          details: errorData
        });
      }

      const data = await response.json();
      
      // تحليل الاستجابة
      const riskAnalysis = data.riskAnalysis || {};
      const score = riskAnalysis.score || 0;
      const valid = riskAnalysis.reasons && !riskAnalysis.reasons.includes('INVALID_TOKEN');
      
      // التحقق من العمل المتوقع
      const actionMatch = data.tokenProperties?.action === action;
      
      // تسجيل النتائج للمراقبة
      this.logger.log(`reCAPTCHA verification - Score: ${score}, Action: ${action}, Valid: ${valid}, ActionMatch: ${actionMatch}`);
      
      // عتبة النجاح - يمكن تعديلها حسب الحاجة
      const scoreThreshold = 0.5;
      const isSuccess = valid && actionMatch && score >= scoreThreshold;
      
      if (!isSuccess) {
        const reasons = riskAnalysis.reasons || [];
        this.logger.warn(`reCAPTCHA verification failed - Reasons: ${reasons.join(', ')}, Score: ${score}`);
      }
      
      return {
        success: isSuccess,
        score: score,
        action: data.tokenProperties?.action || action,
        challenge_ts: data.tokenProperties?.createTime,
        hostname: data.tokenProperties?.hostname,
        error: !isSuccess ? `Low score or invalid token (${score})` : undefined
      };
      
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error('reCAPTCHA verification error:', error);
      
      throw new BadRequestException({
        message: 'reCAPTCHA verification failed',
        code: 'RECAPTCHA_VERIFICATION_ERROR',
        details: error.message
      });
    }
  }

  /**
   * التحقق من صحة العمل
   */
  isValidAction(action: string): boolean {
    const validActions = [
      'FORM_SUBMIT',
      'LOGIN',
      'REGISTER',
      'CONTACT',
      'NEWSLETTER',
      'CHECKOUT',
      'COMMENT'
    ];
    
    return validActions.includes(action);
  }

  /**
   * تحديد العتبة المناسبة للنتيجة حسب نوع العمل
   */
  getScoreThreshold(action: string): number {
    const thresholds = {
      'FORM_SUBMIT': 0.5,
      'LOGIN': 0.7,
      'REGISTER': 0.6,
      'CONTACT': 0.3,
      'NEWSLETTER': 0.3,
      'CHECKOUT': 0.8,
      'COMMENT': 0.4
    };
    
    return thresholds[action] || 0.5;
  }
}