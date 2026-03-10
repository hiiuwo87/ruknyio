import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { ProductAttributesService } from './product-attributes.service';
import {
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
  BulkCreateAttributesDto,
} from './dto/product-attribute.dto';

@ApiTags('Product Attributes - خصائص المنتجات')
@Controller('products/:productId/attributes')
@ApiBearerAuth()
export class ProductAttributesController {
  constructor(private readonly attributesService: ProductAttributesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'إنشاء أو تحديث خاصية منتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 201, description: 'تم إنشاء/تحديث الخاصية بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 403, description: 'غير مصرح' })
  @ApiResponse({ status: 404, description: 'المنتج غير موجود' })
  async create(
    @Param('productId') productId: string,
    @Body() dto: CreateProductAttributeDto,
    @Request() req: any,
  ) {
    return this.attributesService.create(productId, dto, req.user.id);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'إنشاء أو تحديث عدة خصائص دفعة واحدة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 201, description: 'تم إنشاء/تحديث الخصائص بنجاح' })
  async bulkCreate(
    @Param('productId') productId: string,
    @Body() dto: BulkCreateAttributesDto,
    @Request() req: any,
  ) {
    return this.attributesService.bulkCreate(productId, dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'الحصول على جميع خصائص منتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'قائمة الخصائص' })
  async findByProduct(@Param('productId') productId: string) {
    return this.attributesService.findByProduct(productId);
  }

  @Get('with-template')
  @ApiOperation({ summary: 'الحصول على خصائص المنتج مع قالب الفئة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'الخصائص مع القالب' })
  async findByProductWithTemplate(@Param('productId') productId: string) {
    return this.attributesService.findByProductWithTemplate(productId);
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'التحقق من اكتمال الخصائص المطلوبة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق' })
  async validateRequired(
    @Param('productId') productId: string,
    @Request() req: any,
  ) {
    // الحصول على فئة المتجر من المنتج
    const product = await this.attributesService['prisma'].products.findUnique({
      where: { id: productId },
      include: { stores: true },
    });

    if (!product?.stores.categoryId) {
      return { valid: true, missing: [] };
    }

    return this.attributesService.validateRequiredAttributes(
      productId,
      product.stores.categoryId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'الحصول على خاصية محددة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiParam({ name: 'id', description: 'معرف الخاصية' })
  @ApiResponse({ status: 200, description: 'بيانات الخاصية' })
  @ApiResponse({ status: 404, description: 'الخاصية غير موجودة' })
  async findOne(@Param('id') id: string) {
    return this.attributesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'تحديث خاصية' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiParam({ name: 'id', description: 'معرف الخاصية' })
  @ApiResponse({ status: 200, description: 'تم تحديث الخاصية بنجاح' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductAttributeDto,
    @Request() req: any,
  ) {
    return this.attributesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف خاصية' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiParam({ name: 'id', description: 'معرف الخاصية' })
  @ApiResponse({ status: 200, description: 'تم حذف الخاصية بنجاح' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.attributesService.remove(id, req.user.id);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف جميع خصائص المنتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'تم حذف جميع الخصائص بنجاح' })
  async removeAll(@Param('productId') productId: string, @Request() req: any) {
    return this.attributesService.removeAllByProduct(productId, req.user.id);
  }
}

@ApiTags('Store Categories - فئات المتاجر')
@Controller('store-categories')
export class StoreCategoriesTemplateController {
  constructor(private readonly attributesService: ProductAttributesService) {}

  @Get(':id/template')
  @ApiOperation({ summary: 'الحصول على قالب خصائص فئة متجر' })
  @ApiParam({ name: 'id', description: 'معرف فئة المتجر' })
  @ApiResponse({ status: 200, description: 'قالب الخصائص' })
  async getCategoryTemplate(@Param('id') id: string) {
    return this.attributesService.getCategoryTemplate(id);
  }
}

@ApiTags('Stores - المتاجر')
@Controller('stores/:storeId/template')
export class StoreTemplateController {
  constructor(private readonly attributesService: ProductAttributesService) {}

  @Get()
  @ApiOperation({ summary: 'الحصول على قالب خصائص المتجر' })
  @ApiParam({ name: 'storeId', description: 'معرف المتجر' })
  @ApiResponse({ status: 200, description: 'قالب الخصائص' })
  async getStoreTemplate(@Param('storeId') storeId: string) {
    return this.attributesService.getTemplateByStoreId(storeId);
  }
}
