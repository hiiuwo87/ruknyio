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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProductCategoriesService } from './product-categories.service';
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  ReorderCategoriesDto,
  ProductCategoryResponseDto,
} from './dto/product-category.dto';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';

@ApiTags('Product Categories')
@Controller('stores/my-store/categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductCategoriesController {
  constructor(private readonly categoriesService: ProductCategoriesService) {}

  /**
   * إنشاء فئة منتج جديدة
   */
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'إنشاء فئة منتج جديدة' })
  @ApiResponse({
    status: 201,
    description: 'تم إنشاء الفئة بنجاح',
    type: ProductCategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  @ApiResponse({ status: 404, description: 'لم يتم العثور على المتجر' })
  create(@Request() req, @Body() createDto: CreateProductCategoryDto) {
    return this.categoriesService.create(req.user.id, createDto);
  }

  /**
   * الحصول على جميع فئات المتجر
   */
  @Get()
  @ApiOperation({ summary: 'الحصول على جميع فئات المتجر' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'تضمين الفئات غير النشطة',
  })
  @ApiResponse({
    status: 200,
    description: 'قائمة الفئات',
    type: [ProductCategoryResponseDto],
  })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  @ApiResponse({ status: 404, description: 'لم يتم العثور على المتجر' })
  findAll(@Request() req, @Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.categoriesService.findAll(req.user.id, include);
  }

  /**
   * الحصول على فئة واحدة
   */
  @Get(':id')
  @ApiOperation({ summary: 'الحصول على فئة بالمعرف' })
  @ApiParam({ name: 'id', description: 'معرف الفئة' })
  @ApiResponse({
    status: 200,
    description: 'بيانات الفئة',
    type: ProductCategoryResponseDto,
  })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  @ApiResponse({ status: 403, description: 'غير مسموح' })
  @ApiResponse({ status: 404, description: 'لم يتم العثور على الفئة' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.categoriesService.findOne(req.user.id, id);
  }

  /**
   * تحديث فئة
   */
  @Put(':id')
  @ApiOperation({ summary: 'تحديث فئة' })
  @ApiParam({ name: 'id', description: 'معرف الفئة' })
  @ApiResponse({
    status: 200,
    description: 'تم تحديث الفئة بنجاح',
    type: ProductCategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  @ApiResponse({ status: 403, description: 'غير مسموح' })
  @ApiResponse({ status: 404, description: 'لم يتم العثور على الفئة' })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateProductCategoryDto,
  ) {
    return this.categoriesService.update(req.user.id, id, updateDto);
  }

  /**
   * حذف فئة
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف فئة' })
  @ApiParam({ name: 'id', description: 'معرف الفئة' })
  @ApiResponse({ status: 200, description: 'تم حذف الفئة بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن حذف الفئة (تحتوي منتجات)' })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  @ApiResponse({ status: 403, description: 'غير مسموح' })
  @ApiResponse({ status: 404, description: 'لم يتم العثور على الفئة' })
  remove(@Request() req, @Param('id') id: string) {
    return this.categoriesService.remove(req.user.id, id);
  }

  /**
   * إعادة ترتيب الفئات
   */
  @Put('reorder/bulk')
  @ApiOperation({ summary: 'إعادة ترتيب الفئات' })
  @ApiResponse({ status: 200, description: 'تم إعادة الترتيب بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  reorder(@Request() req, @Body() reorderDto: ReorderCategoriesDto) {
    return this.categoriesService.reorder(req.user.id, reorderDto.categoryIds);
  }

  /**
   * تبديل حالة التفعيل
   */
  @Put(':id/toggle-active')
  @ApiOperation({ summary: 'تفعيل/إلغاء تفعيل فئة' })
  @ApiParam({ name: 'id', description: 'معرف الفئة' })
  @ApiResponse({
    status: 200,
    description: 'تم تغيير حالة الفئة',
    type: ProductCategoryResponseDto,
  })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  @ApiResponse({ status: 403, description: 'غير مسموح' })
  @ApiResponse({ status: 404, description: 'لم يتم العثور على الفئة' })
  toggleActive(@Request() req, @Param('id') id: string) {
    return this.categoriesService.toggleActive(req.user.id, id);
  }
}

/**
 * Controller للفئات العامة (بدون مصادقة)
 */
@ApiTags('Product Categories')
@Controller('stores/:storeId/categories')
export class PublicProductCategoriesController {
  constructor(private readonly categoriesService: ProductCategoriesService) {}

  /**
   * الحصول على فئات متجر (عام)
   */
  @Get()
  @ApiOperation({ summary: 'الحصول على فئات متجر (عام)' })
  @ApiParam({ name: 'storeId', description: 'معرف المتجر' })
  @ApiResponse({
    status: 200,
    description: 'قائمة الفئات النشطة',
  })
  getPublicCategories(@Param('storeId') storeId: string) {
    return this.categoriesService.getPublicCategories(storeId);
  }
}
