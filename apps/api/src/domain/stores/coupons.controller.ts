import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { CouponsService } from './coupons.service';
import {
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
  CouponFiltersDto,
} from './dto/coupon.dto';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // ============ Store Owner Endpoints ============

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إنشاء كود خصم جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الكوبون بنجاح' })
  @ApiResponse({ status: 409, description: 'الكود مستخدم مسبقاً' })
  async createCoupon(@Request() req, @Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.createCoupon(req.user.id, createCouponDto);
  }

  @Get('store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'عرض كوبونات متجري' })
  @ApiQuery({ name: 'search', required: false, description: 'بحث بالكود' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'تصفية حسب الحالة',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'قائمة الكوبونات' })
  async getStoreCoupons(@Request() req, @Query() filters: CouponFiltersDto) {
    return this.couponsService.getStoreCoupons(req.user.id, filters);
  }

  @Get('store/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إحصائيات الكوبونات' })
  @ApiResponse({ status: 200, description: 'إحصائيات الكوبونات' })
  async getCouponStats(@Request() req) {
    return this.couponsService.getCouponStats(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'عرض تفاصيل كوبون' })
  @ApiParam({ name: 'id', description: 'معرف الكوبون' })
  @ApiResponse({ status: 200, description: 'تفاصيل الكوبون' })
  @ApiResponse({ status: 404, description: 'الكوبون غير موجود' })
  async getCoupon(@Param('id') couponId: string, @Request() req) {
    return this.couponsService.getCoupon(couponId, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تحديث كوبون' })
  @ApiParam({ name: 'id', description: 'معرف الكوبون' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  async updateCoupon(
    @Param('id') couponId: string,
    @Request() req,
    @Body() updateCouponDto: UpdateCouponDto,
  ) {
    return this.couponsService.updateCoupon(
      couponId,
      req.user.id,
      updateCouponDto,
    );
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تفعيل/إلغاء تفعيل كوبون' })
  @ApiParam({ name: 'id', description: 'معرف الكوبون' })
  @ApiResponse({ status: 200, description: 'تم تغيير الحالة' })
  async toggleCouponStatus(@Param('id') couponId: string, @Request() req) {
    return this.couponsService.toggleCouponStatus(couponId, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حذف كوبون' })
  @ApiParam({ name: 'id', description: 'معرف الكوبون' })
  @ApiResponse({ status: 200, description: 'تم الحذف بنجاح' })
  async deleteCoupon(@Param('id') couponId: string, @Request() req) {
    return this.couponsService.deleteCoupon(couponId, req.user.id);
  }

  // ============ Public/Customer Endpoints ============

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'التحقق من صلاحية كود الخصم' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق' })
  async validateCoupon(@Request() req, @Body() validateDto: ValidateCouponDto) {
    return this.couponsService.validateCoupon(req.user.id, validateDto);
  }
}
