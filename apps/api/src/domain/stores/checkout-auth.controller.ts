import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CheckoutAuthService } from './checkout-auth.service';
import {
  RequestCheckoutOtpDto,
  VerifyCheckoutOtpDto,
  ResendCheckoutOtpDto,
  OtpRequestResponse,
  OtpVerifyResponse,
} from './dto/checkout-otp.dto';

/**
 * 📱 Checkout Auth Controller
 *
 * التحقق عبر واتساب للشراء كضيف
 *
 * الميزات:
 * - طلب OTP
 * - التحقق من OTP
 * - إعادة إرسال OTP
 */
@ApiTags('Checkout Auth')
@Controller('auth/checkout')
export class CheckoutAuthController {
  constructor(private readonly checkoutAuthService: CheckoutAuthService) {}

  /**
   * 📲 طلب رمز OTP للشراء
   */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @ApiOperation({
    summary: 'طلب رمز تحقق OTP',
    description: 'إرسال رمز تحقق عبر واتساب أو البريد الإلكتروني للشراء كضيف',
  })
  @ApiBody({ type: RequestCheckoutOtpDto })
  @ApiResponse({
    status: 200,
    description: 'تم إرسال رمز التحقق بنجاح',
    type: OtpRequestResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'خطأ في البيانات أو تجاوز حد الطلبات',
  })
  @ApiResponse({
    status: 429,
    description: 'تم تجاوز حد الطلبات (Rate Limit)',
  })
  async requestOtp(
    @Body() dto: RequestCheckoutOtpDto,
  ): Promise<OtpRequestResponse> {
    return this.checkoutAuthService.requestOtp(dto);
  }

  /**
   * ✅ التحقق من رمز OTP
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({
    summary: 'التحقق من رمز OTP',
    description: 'التحقق من صحة الرمز وإنشاء جلسة للشراء',
  })
  @ApiBody({ type: VerifyCheckoutOtpDto })
  @ApiResponse({
    status: 200,
    description: 'تم التحقق بنجاح',
    type: OtpVerifyResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'رمز غير صحيح أو منتهي الصلاحية',
  })
  async verifyOtp(
    @Body() dto: VerifyCheckoutOtpDto,
  ): Promise<OtpVerifyResponse> {
    return this.checkoutAuthService.verifyOtp(dto);
  }

  /**
   * 🔄 إعادة إرسال رمز OTP
   */
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 60000 } }) // 2 resends per minute
  @ApiOperation({
    summary: 'إعادة إرسال رمز OTP',
    description: 'إعادة إرسال رمز التحقق عبر واتساب أو البريد الإلكتروني',
  })
  @ApiBody({ type: ResendCheckoutOtpDto })
  @ApiResponse({
    status: 200,
    description: 'تم إعادة إرسال الرمز بنجاح',
    type: OtpRequestResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'خطأ في البيانات أو تجاوز حد الطلبات',
  })
  @ApiResponse({
    status: 429,
    description: 'تم تجاوز حد الطلبات (Rate Limit)',
  })
  async resendOtp(
    @Body() dto: ResendCheckoutOtpDto,
  ): Promise<OtpRequestResponse> {
    return this.checkoutAuthService.resendOtp(dto);
  }

  /**
   * 🔍 فحص حالة خدمات الإرسال (WhatsApp & Email)
   */
  @Get('check-services')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'فحص حالة خدمات الإرسال',
    description: 'التحقق من حالة WhatsApp و Email Services',
  })
  @ApiResponse({
    status: 200,
    description: 'حالة الخدمات',
  })
  async checkServices() {
    return this.checkoutAuthService.checkServicesStatus();
  }
}
