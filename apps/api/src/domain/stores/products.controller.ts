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
  UseInterceptors,
  UploadedFiles,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { ProductsUploadService } from './products-upload.service';
import { CreateProductDto, ProductStatus } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsUploadService: ProductsUploadService,
  ) {}

  /**
   * Get top products for store owner's dashboard
   * Sorted by order count, limited to specified amount
   */
  @Get('store/top')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get top products for store dashboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of products to return' })
  @ApiResponse({ status: 200, description: 'Top products retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTopProducts(
    @Request() req,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.getTopProducts(req.user.id, limit || 5);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Request() req, @Body() createProductDto: CreateProductDto) {
    return this.productsService.create(req.user.id, createProductDto);
  }

  @Get('my-products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my products' })
  @ApiQuery({ name: 'status', enum: ProductStatus, required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isFeatured', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyProducts(
    @Request() req,
    @Query('status') status?: ProductStatus,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isFeatured') isFeatured?: boolean,
  ) {
    return this.productsService.getMyProducts(req.user.id, {
      status,
      categoryId,
      search,
      isFeatured,
    });
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProductStats(@Request() req) {
    return this.productsService.getProductStats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id;
    return this.productsService.findOne(id, userId);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get product by slug' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, req.user.id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 204, description: 'Product deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string, @Request() req) {
    return this.productsService.remove(id, req.user.id);
  }

  // ==================== صور المنتجات - Product Images ====================

  /**
   * رفع صور للمنتج (Server Upload)
   */
  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('files', 5, { storage: memoryStorage() }))
  @ApiOperation({ summary: 'رفع صور للمنتج' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'تم رفع الصور بنجاح' })
  @ApiResponse({ status: 400, description: 'خطأ في الطلب' })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  @ApiResponse({ status: 403, description: 'ممنوع' })
  uploadImages(
    @Param('id') productId: string,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsUploadService.uploadProductImages(
      req.user.id,
      productId,
      files,
    );
  }

  /**
   * الحصول على Presigned URLs للرفع المباشر
   */
  @Post(':id/images/presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'الحصول على روابط مؤقتة لرفع الصور مباشرة إلى S3' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              size: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'تم إنشاء الروابط بنجاح' })
  getPresignedUrls(
    @Param('id') productId: string,
    @Request() req,
    @Body() body: { files: { name: string; type: string; size: number }[] },
  ) {
    return this.productsUploadService.generatePresignedUrls(
      req.user.id,
      productId,
      body.files,
    );
  }

  /**
   * تأكيد رفع الصور بعد استخدام Presigned URLs
   */
  @Post(':id/images/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تأكيد رفع الصور بعد الرفع المباشر' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keys: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'تم التأكيد بنجاح' })
  confirmUpload(
    @Param('id') productId: string,
    @Request() req,
    @Body() body: { keys: string[] },
  ) {
    return this.productsUploadService.confirmUpload(
      req.user.id,
      productId,
      body.keys,
    );
  }

  /**
   * الحصول على صور المنتج
   */
  @Get(':id/images')
  @ApiOperation({ summary: 'الحصول على صور المنتج' })
  @ApiResponse({ status: 200, description: 'تم الحصول على الصور بنجاح' })
  getProductImages(@Param('id') productId: string) {
    return this.productsUploadService.getProductImageUrls(productId);
  }

  /**
   * حذف صورة من المنتج
   */
  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حذف صورة من المنتج' })
  @ApiResponse({ status: 200, description: 'تم حذف الصورة بنجاح' })
  @ApiResponse({ status: 404, description: 'الصورة غير موجودة' })
  deleteImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
    @Request() req,
  ) {
    return this.productsUploadService.deleteProductImage(
      req.user.id,
      productId,
      imageId,
    );
  }

  /**
   * تعيين صورة كصورة رئيسية
   */
  @Patch(':id/images/:imageId/primary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تعيين صورة كصورة رئيسية' })
  @ApiResponse({ status: 200, description: 'تم التعيين بنجاح' })
  setPrimaryImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
    @Request() req,
  ) {
    return this.productsUploadService.setPrimaryImage(
      req.user.id,
      productId,
      imageId,
    );
  }

  /**
   * إعادة ترتيب الصور
   */
  @Patch(':id/images/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إعادة ترتيب صور المنتج' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imageIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'تم إعادة الترتيب بنجاح' })
  reorderImages(
    @Param('id') productId: string,
    @Request() req,
    @Body() body: { imageIds: string[] },
  ) {
    return this.productsUploadService.reorderImages(
      req.user.id,
      productId,
      body.imageIds,
    );
  }
}
