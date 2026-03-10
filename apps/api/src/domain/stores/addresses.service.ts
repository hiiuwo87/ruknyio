import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  CreateAddressDto,
  UpdateAddressDto,
  UpdateLocationDto,
  IRAQI_GOVERNORATES,
} from './dto/address.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(private prisma: PrismaService) {}

  // ============ 🆕 Methods for Phone-Based Address Management ============

  /**
   * 📱 جلب العناوين برقم الهاتف (للضيوف والمستخدمين)
   */
  async getAddressesByPhone(phoneNumber: string) {
    const addresses = await this.prisma.addresses.findMany({
      where: { phoneNumber },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      addresses: addresses.map((a) => this.formatAddress(a)),
      count: addresses.length,
    };
  }

  /**
   * 📱 إنشاء عنوان جديد برقم الهاتف (للضيوف)
   */
  async createAddressByPhone(
    phoneNumber: string,
    createAddressDto: CreateAddressDto,
    userId?: string,
  ) {
    const { isDefault, ...addressData } = createAddressDto;

    // التحقق من عدد العناوين الموجودة لهذا الرقم
    const addressCount = await this.prisma.addresses.count({
      where: { phoneNumber },
    });

    // إذا كان العنوان الافتراضي، نزيل الافتراضي من العناوين السابقة
    if (isDefault && addressCount > 0) {
      await this.prisma.addresses.updateMany({
        where: { phoneNumber, isDefault: true },
        data: { isDefault: false },
      });
    }

    // العنوان الأول يكون افتراضياً تلقائياً
    const shouldBeDefault = isDefault || addressCount === 0;

    // تحويل الحقول من Frontend format إلى Database format
    const addressPayload: any = {
      id: uuidv4(),
      userId: userId || null,
      phoneNumber,
      label:
        (addressData as any).title || (addressData as any).label || 'عنوان',
      fullName: addressData.fullName,
      street: addressData.street,
      country: addressData.country || 'العراق',
      isDefault: shouldBeDefault,
    };

    // معالجة governorate/city (Frontend يستخدم governorate و city)
    if ((addressData as any).governorate) {
      addressPayload.city = (addressData as any).governorate; // المحافظة في حقل city
      addressPayload.district =
        addressData.city || (addressData as any).district; // المدينة في حقل district
    } else {
      addressPayload.city = addressData.city;
      addressPayload.district = (addressData as any).district;
    }

    // حقول اختيارية أخرى
    if ((addressData as any).postalCode)
      addressPayload.postalCode = (addressData as any).postalCode;
    if (addressData.buildingNo)
      addressPayload.buildingNo = addressData.buildingNo;
    if (addressData.floor) addressPayload.floor = addressData.floor;
    if (addressData.apartmentNo)
      addressPayload.apartmentNo = addressData.apartmentNo;
    if (addressData.landmark) addressPayload.landmark = addressData.landmark;
    if (addressData.latitude) addressPayload.latitude = addressData.latitude;
    if (addressData.longitude) addressPayload.longitude = addressData.longitude;

    const address = await this.prisma.addresses.create({
      data: addressPayload,
    });

    this.logger.log(
      `Address created for phone: ${this.maskPhone(phoneNumber)}`,
    );

    return {
      message: 'تم إضافة العنوان بنجاح',
      address: this.formatAddress(address),
    };
  }

  /**
   * 📱 تحديث عنوان برقم الهاتف (للضيوف)
   */
  async updateAddressByPhone(
    addressId: string,
    phoneNumber: string,
    updateAddressDto: UpdateAddressDto,
  ) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    // التحقق من ملكية العنوان عبر رقم الهاتف
    if (address.phoneNumber !== phoneNumber) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا العنوان');
    }

    const updatedAddress = await this.prisma.addresses.update({
      where: { id: addressId },
      data: updateAddressDto,
    });

    return {
      message: 'تم تحديث العنوان بنجاح',
      address: this.formatAddress(updatedAddress),
    };
  }

  /**
   * 📱 حذف عنوان برقم الهاتف (للضيوف)
   */
  async deleteAddressByPhone(addressId: string, phoneNumber: string) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    if (address.phoneNumber !== phoneNumber) {
      throw new ForbiddenException('غير مصرح لك بحذف هذا العنوان');
    }

    // لا يمكن حذف عنوان مرتبط بطلبات
    if (address._count.orders > 0) {
      throw new BadRequestException(
        'لا يمكن حذف العنوان لأنه مرتبط بطلبات سابقة',
      );
    }

    const wasDefault = address.isDefault;

    await this.prisma.addresses.delete({
      where: { id: addressId },
    });

    // إذا كان العنوان المحذوف افتراضياً، نعين آخر
    if (wasDefault) {
      const firstAddress = await this.prisma.addresses.findFirst({
        where: { phoneNumber },
        orderBy: { createdAt: 'asc' },
      });

      if (firstAddress) {
        await this.prisma.addresses.update({
          where: { id: firstAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { message: 'تم حذف العنوان بنجاح' };
  }

  /**
   * 📱 جلب العنوان الافتراضي برقم الهاتف
   */
  async getDefaultAddressByPhone(phoneNumber: string) {
    const address = await this.prisma.addresses.findFirst({
      where: { phoneNumber, isDefault: true },
    });

    if (!address) {
      // إرجاع أول عنوان إذا لم يوجد افتراضي
      const firstAddress = await this.prisma.addresses.findFirst({
        where: { phoneNumber },
        orderBy: { createdAt: 'asc' },
      });

      return firstAddress ? this.formatAddress(firstAddress) : null;
    }

    return this.formatAddress(address);
  }

  /**
   * 📱 تعيين عنوان كافتراضي برقم الهاتف
   */
  async setDefaultByPhone(addressId: string, phoneNumber: string) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    if (address.phoneNumber !== phoneNumber) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا العنوان');
    }

    if (address.isDefault) {
      return { message: 'هذا العنوان هو الافتراضي بالفعل' };
    }

    // إزالة الافتراضي من العناوين الأخرى
    await this.prisma.addresses.updateMany({
      where: { phoneNumber, isDefault: true },
      data: { isDefault: false },
    });

    // تعيين هذا العنوان كافتراضي
    await this.prisma.addresses.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    return { message: 'تم تعيين العنوان كافتراضي' };
  }

  /**
   * 🔗 ربط العناوين بحساب مستخدم (عند الترقية من ضيف)
   */
  async linkAddressesToUser(phoneNumber: string, userId: string) {
    const result = await this.prisma.addresses.updateMany({
      where: {
        phoneNumber,
        userId: null, // فقط العناوين غير المرتبطة
      },
      data: { userId },
    });

    this.logger.log(`Linked ${result.count} addresses to user ${userId}`);

    return {
      message: `تم ربط ${result.count} عنوان بحسابك`,
      linkedCount: result.count,
    };
  }

  /**
   * 🙈 إخفاء رقم الهاتف
   */
  private maskPhone(phone: string): string {
    if (phone.length < 8) return '***';
    return `${phone.slice(0, 7)}***${phone.slice(-2)}`;
  }

  // ============ Original Methods (Updated) ============

  /**
   * Create a new address
   */
  async createAddress(userId: string, createAddressDto: CreateAddressDto) {
    const { isDefault, ...addressData } = createAddressDto;

    // If this is the first address or set as default, handle default logic
    if (isDefault) {
      await this.clearDefaultAddress(userId);
    }

    // Check if user has any addresses
    const addressCount = await this.prisma.addresses.count({
      where: { userId },
    });

    // First address is automatically default
    const shouldBeDefault = isDefault || addressCount === 0;

    const address = await this.prisma.addresses.create({
      data: {
        id: uuidv4(),
        userId,
        ...addressData,
        country: addressData.country || 'العراق',
        isDefault: shouldBeDefault,
        updatedAt: new Date(),
      },
    });

    return {
      message: 'تم إضافة العنوان بنجاح',
      address: this.formatAddress(address),
    };
  }

  /**
   * Update an address
   */
  async updateAddress(
    addressId: string,
    userId: string,
    updateAddressDto: UpdateAddressDto,
  ) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا العنوان');
    }

    const updatedAddress = await this.prisma.addresses.update({
      where: { id: addressId },
      data: {
        ...updateAddressDto,
        updatedAt: new Date(),
      },
    });

    return {
      message: 'تم تحديث العنوان بنجاح',
      address: this.formatAddress(updatedAddress),
    };
  }

  /**
   * Update address location (GPS coordinates)
   */
  async updateLocation(
    addressId: string,
    userId: string,
    locationDto: UpdateLocationDto,
  ) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا العنوان');
    }

    // Validate coordinates are within Iraq bounds (approximately)
    const { latitude, longitude } = locationDto;
    if (latitude < 29 || latitude > 38 || longitude < 38 || longitude > 49) {
      throw new BadRequestException('الإحداثيات خارج حدود العراق');
    }

    const updateData: any = {
      latitude,
      longitude,
      updatedAt: new Date(),
    };

    // If formatted address provided from geocoding
    if (locationDto.formattedAddress) {
      updateData.street = locationDto.formattedAddress;
    }

    const updatedAddress = await this.prisma.addresses.update({
      where: { id: addressId },
      data: updateData,
    });

    return {
      message: 'تم تحديث الموقع بنجاح',
      address: this.formatAddress(updatedAddress),
    };
  }

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string, userId: string) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بحذف هذا العنوان');
    }

    // Check if address is used in orders
    if (address._count.orders > 0) {
      throw new BadRequestException(
        'لا يمكن حذف العنوان لأنه مرتبط بطلبات سابقة',
      );
    }

    const wasDefault = address.isDefault;

    await this.prisma.addresses.delete({
      where: { id: addressId },
    });

    // If deleted address was default, set another as default
    if (wasDefault) {
      const firstAddress = await this.prisma.addresses.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (firstAddress) {
        await this.prisma.addresses.update({
          where: { id: firstAddress.id },
          data: { isDefault: true, updatedAt: new Date() },
        });
      }
    }

    return { message: 'تم حذف العنوان بنجاح' };
  }

  /**
   * Get all user addresses
   */
  async getAddresses(userId: string) {
    const addresses = await this.prisma.addresses.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      addresses: addresses.map((a) => this.formatAddress(a)),
      count: addresses.length,
    };
  }

  /**
   * Get single address
   */
  async getAddress(addressId: string, userId: string) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بعرض هذا العنوان');
    }

    return this.formatAddress(address);
  }

  /**
   * Get default address
   */
  async getDefaultAddress(userId: string) {
    const address = await this.prisma.addresses.findFirst({
      where: { userId, isDefault: true },
    });

    if (!address) {
      // Return first address if no default
      const firstAddress = await this.prisma.addresses.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (!firstAddress) {
        return null;
      }

      return this.formatAddress(firstAddress);
    }

    return this.formatAddress(address);
  }

  /**
   * Set address as default
   */
  async setAsDefault(addressId: string, userId: string) {
    const address = await this.prisma.addresses.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا العنوان');
    }

    if (address.isDefault) {
      return { message: 'هذا العنوان هو الافتراضي بالفعل' };
    }

    // Clear other defaults
    await this.clearDefaultAddress(userId);

    // Set this as default
    await this.prisma.addresses.update({
      where: { id: addressId },
      data: { isDefault: true, updatedAt: new Date() },
    });

    return { message: 'تم تعيين العنوان كافتراضي' };
  }

  /**
   * Get Iraqi governorates list
   */
  getGovernorates() {
    return {
      governorates: IRAQI_GOVERNORATES,
      count: IRAQI_GOVERNORATES.length,
    };
  }

  /**
   * Get nearby addresses (for delivery tracking)
   */
  async getNearbyAddresses(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
  ) {
    // Simple distance calculation using Haversine formula approximation
    // For production, consider using PostGIS or similar
    const addresses = await this.prisma.addresses.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        city: true,
        district: true,
        latitude: true,
        longitude: true,
      },
    });

    const nearby = addresses
      .map((addr) => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          addr.latitude,
          addr.longitude,
        );
        return { ...addr, distance };
      })
      .filter((addr) => addr.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return { addresses: nearby };
  }

  /**
   * Clear default address for user
   */
  private async clearDefaultAddress(userId: string) {
    await this.prisma.addresses.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false, updatedAt: new Date() },
    });
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Format address for response
   */
  private formatAddress(address: any) {
    return {
      id: address.id,
      title: address.label, // إرجاع label كـ title للـ Frontend
      label: address.label,
      fullName: address.fullName,
      phoneNumber: address.phoneNumber,
      country: address.country,
      governorate: address.city, // المحافظة محفوظة في city
      city: address.district, // المدينة محفوظة في district
      district: address.district,
      street: address.street,
      buildingNo: address.buildingNo,
      floor: address.floor,
      apartmentNo: address.apartmentNo,
      landmark: address.landmark,
      location:
        address.latitude && address.longitude
          ? {
              latitude: address.latitude,
              longitude: address.longitude,
              hasCoordinates: true,
              googleMapsUrl: `https://www.google.com/maps?q=${address.latitude},${address.longitude}`,
            }
          : {
              hasCoordinates: false,
            },
      isDefault: address.isDefault,
      fullAddress: this.buildFullAddress(address),
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  /**
   * Build full address string
   */
  private buildFullAddress(address: any): string {
    const parts = [
      address.street,
      address.buildingNo ? `مبنى ${address.buildingNo}` : null,
      address.floor ? `طابق ${address.floor}` : null,
      address.apartmentNo ? `شقة ${address.apartmentNo}` : null,
      address.district,
      address.city,
      address.country,
    ].filter(Boolean);

    return parts.join('، ');
  }
}
