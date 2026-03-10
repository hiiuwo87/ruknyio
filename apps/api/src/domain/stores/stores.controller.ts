import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateStoreAnalyticsDto } from './dto/update-store-analytics.dto';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';

@ApiTags('Stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new store' })
  @ApiResponse({ status: 201, description: 'Store created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Request() req, @Body() createStoreDto: CreateStoreDto) {
    return this.storesService.create(req.user.id, createStoreDto);
  }

  @Get('my-store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my store' })
  @ApiResponse({ status: 200, description: 'Store retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyStore(@Request() req) {
    return this.storesService.getMyStore(req.user.id);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get store statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStoreStats(@Request() req) {
    return this.storesService.getStoreStats(req.user.id);
  }

  @Get('check-slug/:slug')
  @ApiOperation({ summary: 'Check if store slug is available' })
  @ApiResponse({ status: 200, description: 'Slug is taken' })
  @ApiResponse({ status: 404, description: 'Slug is available' })
  async checkSlugAvailability(@Param('slug') slug: string) {
    return this.storesService.checkSlugAvailability(slug);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get store categories' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  getStoreCategories() {
    return this.storesService.getStoreCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get store by ID' })
  @ApiResponse({ status: 200, description: 'Store retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get store by slug' })
  @ApiResponse({ status: 200, description: 'Store retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.storesService.findBySlug(slug);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a store' })
  @ApiResponse({ status: 200, description: 'Store updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateStoreDto: UpdateStoreDto,
  ) {
    return this.storesService.update(id, req.user.id, updateStoreDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a store' })
  @ApiResponse({ status: 204, description: 'Store deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  remove(@Param('id') id: string, @Request() req) {
    return this.storesService.remove(id, req.user.id);
  }

  /**
   * 📊 Get Google Analytics settings for my store
   */
  @Get('my-store/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get store analytics settings' })
  @ApiResponse({ status: 200, description: 'Analytics settings retrieved' })
  getAnalyticsSettings(@Request() req) {
    return this.storesService.getAnalyticsSettings(req.user.id);
  }

  /**
   * 📊 Update Google Analytics settings for my store
   */
  @Patch('my-store/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update store analytics settings' })
  @ApiResponse({ status: 200, description: 'Analytics settings updated' })
  @ApiResponse({ status: 400, description: 'Invalid measurement ID' })
  updateAnalyticsSettings(
    @Request() req,
    @Body() dto: UpdateStoreAnalyticsDto,
  ) {
    return this.storesService.updateAnalyticsSettings(
      req.user.id,
      dto.googleAnalyticsId,
    );
  }

  /**
   * 🛍️ الحصول على منتجات المستخدم حسب username
   * Public endpoint - لا يحتاج تسجيل دخول
   */
  @Get(':username/products')
  @ApiOperation({ summary: 'Get products by username' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  getProductsByUsername(
    @Param('username') username: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.storesService.getProductsByUsername(username, {
      limit: limit ? Number(limit) : 12,
      page: page ? Number(page) : 1,
      categoryId,
      search,
    });
  }

  /**
   * 📂 الحصول على فئات منتجات المستخدم
   */
  @Get(':username/categories')
  @ApiOperation({ summary: 'Get product categories by username' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  getCategoriesByUsername(@Param('username') username: string) {
    return this.storesService.getCategoriesByUsername(username);
  }
}
