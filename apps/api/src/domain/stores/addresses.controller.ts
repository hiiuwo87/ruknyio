import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import {
  CreateAddressDto,
  UpdateAddressDto,
  UpdateLocationDto,
} from './dto/address.dto';

@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @ApiOperation({ summary: 'إضافة عنوان جديد' })
  @ApiResponse({ status: 201, description: 'تم إضافة العنوان بنجاح' })
  async createAddress(
    @Request() req,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.addressesService.createAddress(req.user.id, createAddressDto);
  }

  @Get()
  @ApiOperation({ summary: 'عرض جميع عناويني' })
  @ApiResponse({ status: 200, description: 'قائمة العناوين' })
  async getAddresses(@Request() req) {
    return this.addressesService.getAddresses(req.user.id);
  }

  @Get('default')
  @ApiOperation({ summary: 'الحصول على العنوان الافتراضي' })
  @ApiResponse({ status: 200, description: 'العنوان الافتراضي' })
  async getDefaultAddress(@Request() req) {
    return this.addressesService.getDefaultAddress(req.user.id);
  }

  @Get('governorates')
  @ApiOperation({ summary: 'قائمة المحافظات العراقية' })
  @ApiResponse({ status: 200, description: 'قائمة المحافظات مع الإحداثيات' })
  async getGovernorates() {
    return this.addressesService.getGovernorates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل عنوان' })
  @ApiParam({ name: 'id', description: 'معرف العنوان' })
  @ApiResponse({ status: 200, description: 'تفاصيل العنوان' })
  @ApiResponse({ status: 404, description: 'العنوان غير موجود' })
  async getAddress(@Param('id') addressId: string, @Request() req) {
    return this.addressesService.getAddress(addressId, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث عنوان' })
  @ApiParam({ name: 'id', description: 'معرف العنوان' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  async updateAddress(
    @Param('id') addressId: string,
    @Request() req,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressesService.updateAddress(
      addressId,
      req.user.id,
      updateAddressDto,
    );
  }

  @Patch(':id/location')
  @ApiOperation({ summary: 'تحديث موقع GPS للعنوان' })
  @ApiParam({ name: 'id', description: 'معرف العنوان' })
  @ApiResponse({ status: 200, description: 'تم تحديث الموقع' })
  async updateLocation(
    @Param('id') addressId: string,
    @Request() req,
    @Body() locationDto: UpdateLocationDto,
  ) {
    return this.addressesService.updateLocation(
      addressId,
      req.user.id,
      locationDto,
    );
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'تعيين كعنوان افتراضي' })
  @ApiParam({ name: 'id', description: 'معرف العنوان' })
  @ApiResponse({ status: 200, description: 'تم التعيين كافتراضي' })
  async setAsDefault(@Param('id') addressId: string, @Request() req) {
    return this.addressesService.setAsDefault(addressId, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف عنوان' })
  @ApiParam({ name: 'id', description: 'معرف العنوان' })
  @ApiResponse({ status: 200, description: 'تم الحذف بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن حذف العنوان' })
  async deleteAddress(@Param('id') addressId: string, @Request() req) {
    return this.addressesService.deleteAddress(addressId, req.user.id);
  }
}
