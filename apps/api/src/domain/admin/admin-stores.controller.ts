import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/common/guards/roles.guard';
import { Roles } from '../../core/common/decorators/auth/roles.decorator';
import { Role } from '@prisma/client';
import { AdminStoresService } from './admin-stores.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminStoresController {
  constructor(private readonly storesService: AdminStoresService) {}

  // Stores
  @Get('stores/stats')
  getStoreStats() {
    return this.storesService.getStats();
  }

  @Get('stores')
  getStores(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('city') city?: string,
  ) {
    return this.storesService.getStores({
      page,
      limit: Math.min(limit, 100),
      search,
      status,
      categoryId,
      city,
    });
  }

  @Get('stores/:id')
  getStoreById(@Param('id') id: string) {
    return this.storesService.getStoreById(id);
  }

  @Patch('stores/:id/status')
  updateStoreStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.storesService.updateStoreStatus(id, status);
  }

  @Delete('stores/:id')
  deleteStore(@Param('id') id: string) {
    return this.storesService.deleteStore(id);
  }

  // Store Categories
  @Get('store-categories')
  getStoreCategories() {
    return this.storesService.getStoreCategories();
  }

  @Post('store-categories')
  createStoreCategory(@Body() data: any) {
    return this.storesService.createStoreCategory(data);
  }

  @Put('store-categories/:id')
  updateStoreCategory(@Param('id') id: string, @Body() data: any) {
    return this.storesService.updateStoreCategory(id, data);
  }

  @Delete('store-categories/:id')
  deleteStoreCategory(@Param('id') id: string) {
    return this.storesService.deleteStoreCategory(id);
  }
}
