import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { WishlistsService } from './wishlists.service';
import { WishlistFiltersDto } from './dto/wishlist.dto';

@ApiTags('Wishlists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlists')
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Get()
  @ApiOperation({ summary: 'عرض قائمة الرغبات' })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'ترتيب: newest, oldest, price_low, price_high',
  })
  @ApiQuery({ name: 'page', required: false, description: 'رقم الصفحة' })
  @ApiQuery({ name: 'limit', required: false, description: 'عدد العناصر' })
  @ApiResponse({ status: 200, description: 'قائمة الرغبات' })
  async getWishlist(@Request() req, @Query() filters: WishlistFiltersDto) {
    return this.wishlistsService.getWishlist(req.user.id, filters);
  }

  @Get('count')
  @ApiOperation({ summary: 'عدد عناصر قائمة الرغبات' })
  @ApiResponse({ status: 200, description: 'عدد العناصر' })
  async getWishlistCount(@Request() req) {
    return this.wishlistsService.getWishlistCount(req.user.id);
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'التحقق من وجود منتج في المفضلة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق' })
  async isInWishlist(@Param('productId') productId: string, @Request() req) {
    return this.wishlistsService.isInWishlist(req.user.id, productId);
  }

  @Post('check-multiple')
  @ApiOperation({ summary: 'التحقق من عدة منتجات في المفضلة' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'نتائج التحقق' })
  async checkMultiple(
    @Body('productIds') productIds: string[],
    @Request() req,
  ) {
    return this.wishlistsService.checkMultiple(req.user.id, productIds);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'إضافة منتج للمفضلة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 201, description: 'تمت الإضافة بنجاح' })
  @ApiResponse({ status: 404, description: 'المنتج غير موجود' })
  @ApiResponse({ status: 409, description: 'المنتج موجود مسبقاً' })
  async addToWishlist(@Param('productId') productId: string, @Request() req) {
    return this.wishlistsService.addToWishlist(req.user.id, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'إزالة منتج من المفضلة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'تمت الإزالة بنجاح' })
  @ApiResponse({ status: 404, description: 'المنتج غير موجود في المفضلة' })
  async removeFromWishlist(
    @Param('productId') productId: string,
    @Request() req,
  ) {
    return this.wishlistsService.removeFromWishlist(req.user.id, productId);
  }

  @Post(':productId/move-to-cart')
  @ApiOperation({ summary: 'نقل منتج من المفضلة إلى السلة' })
  @ApiParam({ name: 'productId', description: 'معرف المنتج' })
  @ApiResponse({ status: 200, description: 'تم النقل بنجاح' })
  @ApiResponse({ status: 404, description: 'المنتج غير موجود في المفضلة' })
  @ApiResponse({ status: 400, description: 'المنتج غير متاح' })
  async moveToCart(@Param('productId') productId: string, @Request() req) {
    return this.wishlistsService.moveToCart(req.user.id, productId);
  }

  @Delete()
  @ApiOperation({ summary: 'مسح قائمة الرغبات بالكامل' })
  @ApiResponse({ status: 200, description: 'تم المسح بنجاح' })
  async clearWishlist(@Request() req) {
    return this.wishlistsService.clearWishlist(req.user.id);
  }
}
