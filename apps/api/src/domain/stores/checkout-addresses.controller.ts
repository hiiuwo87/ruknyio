import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CheckoutSessionGuard } from '../../core/common/guards/auth/checkout-session.guard';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

/**
 * 📍 Checkout Addresses Controller
 *
 * إدارة العناوين للمستخدمين الضيوف باستخدام رقم الهاتف
 */
@ApiTags('Checkout Addresses')
@ApiBearerAuth()
@UseGuards(CheckoutSessionGuard)
@Controller('checkout/addresses')
export class CheckoutAddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  /**
   * 📋 عرض عناوين رقم الهاتف
   */
  @Get()
  @ApiOperation({ summary: 'عرض عناوين رقم الهاتف' })
  @ApiQuery({ name: 'phoneNumber', required: true })
  @ApiResponse({ status: 200, description: 'قائمة العناوين' })
  async getAddresses(@Query('phoneNumber') phoneNumber: string) {
    return this.addressesService.getAddressesByPhone(phoneNumber);
  }

  /**
   * ➕ إضافة عنوان جديد
   */
  @Post()
  @ApiOperation({ summary: 'إضافة عنوان جديد' })
  @ApiResponse({ status: 201, description: 'تم إضافة العنوان بنجاح' })
  async createAddress(
    @Body() createAddressDto: CreateAddressDto & { phoneNumber: string },
  ) {
    return this.addressesService.createAddressByPhone(
      createAddressDto.phoneNumber,
      createAddressDto,
    );
  }

  /**
   * ✏️ تحديث عنوان
   */
  @Patch(':id')
  @ApiOperation({ summary: 'تحديث عنوان' })
  @ApiParam({ name: 'id', description: 'معرف العنوان' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  async updateAddress(
    @Param('id') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto & { phoneNumber: string },
  ) {
    return this.addressesService.updateAddressByPhone(
      addressId,
      updateAddressDto.phoneNumber,
      updateAddressDto,
    );
  }

  /**
   * 🗑️ حذف عنوان
   */
  @Delete(':id')
  @ApiOperation({ summary: 'حذف عنوان' })
  @ApiParam({ name: 'id', description: 'معرف العنوان' })
  @ApiQuery({ name: 'phoneNumber', required: true })
  @ApiResponse({ status: 200, description: 'تم الحذف بنجاح' })
  async deleteAddress(
    @Param('id') addressId: string,
    @Query('phoneNumber') phoneNumber: string,
  ) {
    return this.addressesService.deleteAddressByPhone(addressId, phoneNumber);
  }
}
