import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrderTrackingService } from './order-tracking.service';
import {
  RequestTrackingOtpDto,
  VerifyTrackingOtpDto,
  QuickTrackDto,
} from './dto/order-tracking.dto';

/**
 * 📦 API تتبع الطلبات
 *
 * Endpoints عامة لتتبع الطلبات عبر OTP
 */
@ApiTags('Order Tracking - تتبع الطلبات')
@Controller('track')
export class OrderTrackingController {
  constructor(private readonly trackingService: OrderTrackingService) {}

  /**
   * 🔍 فحص سريع لوجود الطلب (بدون OTP)
   */
  @Get('quick/:orderNumber')
  @ApiOperation({ summary: 'فحص سريع لوجود الطلب' })
  @ApiResponse({ status: 200, description: 'معلومات أساسية عن الطلب' })
  @ApiResponse({ status: 404, description: 'الطلب غير موجود' })
  async quickCheck(@Param('orderNumber') orderNumber: string) {
    return this.trackingService.getQuickOrderStatus(orderNumber);
  }

  /**
   * 📲 طلب OTP للتتبع
   */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 طلبات في الدقيقة
  @ApiOperation({ summary: 'طلب رمز OTP للتتبع' })
  @ApiResponse({ status: 200, description: 'تم إرسال رمز التحقق' })
  @ApiResponse({ status: 404, description: 'لا توجد طلبات لهذا الرقم' })
  @ApiResponse({ status: 429, description: 'تم تجاوز حد الطلبات' })
  async requestOtp(@Body() dto: RequestTrackingOtpDto) {
    return this.trackingService.requestTrackingOtp(dto);
  }

  /**
   * ✅ التحقق من OTP وجلب الطلبات
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 محاولات في الدقيقة
  @ApiOperation({ summary: 'التحقق من OTP وبدء جلسة التتبع' })
  @ApiResponse({ status: 200, description: 'تم التحقق - قائمة الطلبات' })
  @ApiResponse({ status: 400, description: 'رمز التحقق غير صالح' })
  async verifyOtp(@Body() dto: VerifyTrackingOtpDto) {
    return this.trackingService.verifyTrackingOtp(dto);
  }

  /**
   * 📋 جلب قائمة الطلبات (يتطلب جلسة تتبع)
   */
  @Post('orders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'جلب قائمة الطلبات برقم الهاتف' })
  @ApiResponse({ status: 200, description: 'قائمة الطلبات' })
  async getOrders(@Body('phoneNumber') phoneNumber: string) {
    // ملاحظة: في الواقع سيتم استخدام الـ JWT من الجلسة
    // هذا للتبسيط في المرحلة الأولى
    return this.trackingService.getOrdersByPhone(phoneNumber);
  }

  /**
   * 📦 جلب تفاصيل طلب معين
   */
  @Post('order/:orderNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'جلب تفاصيل طلب معين' })
  @ApiResponse({ status: 200, description: 'تفاصيل الطلب' })
  @ApiResponse({ status: 404, description: 'الطلب غير موجود' })
  async getOrderDetails(
    @Param('orderNumber') orderNumber: string,
    @Body('phoneNumber') phoneNumber: string,
  ) {
    return this.trackingService.getOrderDetails(orderNumber, phoneNumber);
  }
}
