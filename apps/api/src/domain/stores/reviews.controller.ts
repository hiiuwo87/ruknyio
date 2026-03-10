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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewFiltersDto,
} from './dto/review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ============ User Reviews ============

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إضافة تقييم جديد' })
  @ApiResponse({ status: 201, description: 'تم إضافة التقييم بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 409, description: 'التقييم موجود مسبقاً' })
  async createReview(@Request() req, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, createReviewDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تعديل تقييم' })
  @ApiResponse({ status: 200, description: 'تم تحديث التقييم' })
  @ApiResponse({ status: 404, description: 'التقييم غير موجود' })
  async updateReview(
    @Param('id') reviewId: string,
    @Request() req,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(
      reviewId,
      req.user.id,
      updateReviewDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حذف تقييم' })
  @ApiResponse({ status: 200, description: 'تم حذف التقييم' })
  @ApiResponse({ status: 404, description: 'التقييم غير موجود' })
  async deleteReview(@Param('id') reviewId: string, @Request() req) {
    return this.reviewsService.deleteReview(reviewId, req.user.id);
  }

  @Get('my-reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'عرض تقييماتي' })
  @ApiResponse({ status: 200, description: 'قائمة تقييمات المستخدم' })
  async getMyReviews(@Request() req, @Query() filters: ReviewFiltersDto) {
    return this.reviewsService.getMyReviews(req.user.id, filters);
  }

  @Get('can-review/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'التحقق من إمكانية تقييم المنتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق' })
  async canReview(@Param('productId') productId: string, @Request() req) {
    return this.reviewsService.canReview(req.user.id, productId);
  }

  // ============ Product Reviews (Public) ============

  @Get('product/:productId')
  @ApiOperation({ summary: 'عرض تقييمات المنتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiQuery({
    name: 'rating',
    required: false,
    description: 'تصفية حسب التقييم',
  })
  @ApiQuery({ name: 'sortBy', required: false, description: 'ترتيب النتائج' })
  @ApiQuery({ name: 'page', required: false, description: 'رقم الصفحة' })
  @ApiQuery({ name: 'limit', required: false, description: 'عدد العناصر' })
  @ApiResponse({ status: 200, description: 'قائمة التقييمات' })
  async getProductReviews(
    @Param('productId') productId: string,
    @Query() filters: ReviewFiltersDto,
  ) {
    return this.reviewsService.getProductReviews(productId, filters);
  }

  @Get('product/:productId/stats')
  @ApiOperation({ summary: 'إحصائيات تقييمات المنتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'إحصائيات التقييمات' })
  async getProductReviewStats(@Param('productId') productId: string) {
    return this.reviewsService.getProductReviewStats(productId);
  }

  // ============ Store Reviews (Public) ============

  @Get('store/:storeId')
  @ApiOperation({ summary: 'عرض تقييمات المتجر' })
  @ApiParam({ name: 'storeId', description: 'معرف المتجر' })
  @ApiQuery({
    name: 'rating',
    required: false,
    description: 'تصفية حسب التقييم',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'تصفية حسب المنتج',
  })
  @ApiQuery({ name: 'sortBy', required: false, description: 'ترتيب النتائج' })
  @ApiQuery({ name: 'page', required: false, description: 'رقم الصفحة' })
  @ApiQuery({ name: 'limit', required: false, description: 'عدد العناصر' })
  @ApiResponse({ status: 200, description: 'قائمة التقييمات' })
  async getStoreReviews(
    @Param('storeId') storeId: string,
    @Query() filters: ReviewFiltersDto,
  ) {
    return this.reviewsService.getStoreReviews(storeId, filters);
  }

  @Get('store/:storeId/stats')
  @ApiOperation({ summary: 'إحصائيات تقييمات المتجر' })
  @ApiParam({ name: 'storeId', description: 'معرف المتجر' })
  @ApiResponse({ status: 200, description: 'إحصائيات التقييمات' })
  async getStoreReviewStats(@Param('storeId') storeId: string) {
    return this.reviewsService.getStoreReviewStats(storeId);
  }
}
