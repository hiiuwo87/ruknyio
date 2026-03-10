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
import { ProductVariantsService } from './product-variants.service';
import {
  CreateProductVariantDto,
  UpdateProductVariantDto,
  BulkCreateVariantsDto,
  GenerateVariantsDto,
  UpdateVariantStockDto,
  BulkUpdateStockDto,
} from './dto/product-variant.dto';

@ApiTags('Product Variants - متغيرات المنتجات')
@Controller('products/:productId/variants')
@ApiBearerAuth()
export class ProductVariantsController {
  constructor(private readonly variantsService: ProductVariantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'إنشاء متغير منتج جديد' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 201, description: 'تم إنشاء المتغير بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 403, description: 'غير مصرح' })
  @ApiResponse({ status: 404, description: 'المنتج غير موجود' })
  async create(
    @Param('productId') productId: string,
    @Body() dto: CreateProductVariantDto,
    @Request() req: any,
  ) {
    return this.variantsService.create(productId, dto, req.user.id);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'إنشاء عدة متغيرات دفعة واحدة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 201, description: 'تم إنشاء المتغيرات بنجاح' })
  async bulkCreate(
    @Param('productId') productId: string,
    @Body() dto: BulkCreateVariantsDto,
    @Request() req: any,
  ) {
    return this.variantsService.bulkCreate(productId, dto, req.user.id);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'توليد كل التركيبات الممكنة للمتغيرات' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 201, description: 'تم توليد المتغيرات بنجاح' })
  async generateVariants(
    @Param('productId') productId: string,
    @Body() dto: GenerateVariantsDto,
    @Request() req: any,
  ) {
    return this.variantsService.generateVariants(productId, dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'الحصول على جميع متغيرات منتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'قائمة المتغيرات' })
  async findByProduct(@Param('productId') productId: string) {
    return this.variantsService.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'الحصول على متغير محدد' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiParam({ name: 'id', description: 'معرف المتغير' })
  @ApiResponse({ status: 200, description: 'بيانات المتغير' })
  @ApiResponse({ status: 404, description: 'المتغير غير موجود' })
  async findOne(@Param('id') id: string) {
    return this.variantsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'تحديث متغير' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiParam({ name: 'id', description: 'معرف المتغير' })
  @ApiResponse({ status: 200, description: 'تم تحديث المتغير بنجاح' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductVariantDto,
    @Request() req: any,
  ) {
    return this.variantsService.update(id, dto, req.user.id);
  }

  @Put(':id/stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'تحديث مخزون متغير' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiParam({ name: 'id', description: 'معرف المتغير' })
  @ApiResponse({ status: 200, description: 'تم تحديث المخزون بنجاح' })
  async updateStock(
    @Param('id') id: string,
    @Body() dto: UpdateVariantStockDto,
    @Request() req: any,
  ) {
    return this.variantsService.updateStock(id, dto.stock, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف متغير' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiParam({ name: 'id', description: 'معرف المتغير' })
  @ApiResponse({ status: 200, description: 'تم حذف المتغير بنجاح' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.variantsService.remove(id, req.user.id);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف جميع متغيرات المنتج' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'تم حذف جميع المتغيرات بنجاح' })
  async removeAll(@Param('productId') productId: string, @Request() req: any) {
    return this.variantsService.removeAllByProduct(productId, req.user.id);
  }
}

@ApiTags('Product Variants - متغيرات المنتجات')
@Controller('variants')
@ApiBearerAuth()
export class VariantsBulkController {
  constructor(private readonly variantsService: ProductVariantsService) {}

  @Put('bulk-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'تحديث مخزون عدة متغيرات' })
  @ApiResponse({ status: 200, description: 'تم تحديث المخزون بنجاح' })
  async bulkUpdateStock(@Body() dto: BulkUpdateStockDto, @Request() req: any) {
    return this.variantsService.bulkUpdateStock(dto, req.user.id);
  }
}
