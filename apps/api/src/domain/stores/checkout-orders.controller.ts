import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CheckoutSessionGuard } from '../../core/common/guards/auth/checkout-session.guard';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';

/**
 * Item في السلة
 */
class OrderItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  price: number;
}

/**
 * DTO لإنشاء طلب من checkout
 */
class CreateCheckoutOrderDto {
  @ApiProperty()
  @IsString()
  storeId: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty()
  @IsString()
  @Transform(({ value }) => String(value))
  shippingAddressId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  shippingCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  total?: number;
}

/**
 * 🛒 Checkout Orders Controller
 *
 * إنشاء طلبات للمستخدمين الضيوف باستخدام جلسة checkout
 */
@ApiTags('Checkout Orders')
@ApiBearerAuth()
@UseGuards(CheckoutSessionGuard)
@Controller('checkout/orders')
export class CheckoutOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 📦 إنشاء طلب جديد (للضيوف)
   */
  @Post()
  @ApiOperation({ summary: 'إنشاء طلب جديد للضيف' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الطلب بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صحيحة' })
  @ApiResponse({ status: 401, description: 'جلسة غير صالحة' })
  async createGuestOrder(
    @Body() createOrderDto: CreateCheckoutOrderDto,
    @Req() req: any,
  ) {
    console.log(
      '📦 Checkout Order Data:',
      JSON.stringify(createOrderDto, null, 2),
    );
    console.log('🔐 Session Info:', {
      userId: req.checkoutSession?.userId,
      phone: req.checkoutSession?.phoneNumber,
      email: req.checkoutSession?.email,
    });

    let userId = req.checkoutSession?.userId;
    const sessionPhone = req.checkoutSession?.phoneNumber;
    const sessionEmail = req.checkoutSession?.email;

    // إذا لم يكن هناك userId، نبحث عن المستخدم أو ننشئ واحد مؤقت
    if (!userId) {
      console.log('⚠️ No userId in session, searching for existing user...');

      // البحث عن مستخدم موجود
      let user = sessionPhone
        ? await this.prisma.user.findFirst({
            where: { phoneNumber: sessionPhone },
          })
        : await this.prisma.user.findFirst({ where: { email: sessionEmail } });

      // إنشاء مستخدم مؤقت إذا لم يكن موجوداً
      if (!user) {
        console.log('✨ Creating temporary user...');
        user = await this.prisma.user.create({
          data: {
            phoneNumber: sessionPhone,
            email: sessionEmail,
            role: 'GUEST',
            emailVerified: false,
          },
        });
        console.log('✅ Temporary user created:', user.id);
      }

      userId = user.id;
    }

    console.log('👤 Final userId:', userId);

    // إنشاء طلب لكل منتج في السلة
    const orders = [];

    try {
      for (const item of createOrderDto.items) {
        console.log(`📦 Creating order for product: ${item.productId}`);

        const orderData = {
          productId: item.productId,
          quantity: item.quantity,
          addressId: createOrderDto.shippingAddressId,
          customerNote: createOrderDto.notes,
        };

        const order = await this.ordersService.createDirect(userId, orderData);
        orders.push(order);

        console.log(`✅ Order created: ${order.id}`);
      }
    } catch (error) {
      console.error('❌ Error creating orders:', error);
      throw error;
    }

    console.log(`🎉 All orders created successfully: ${orders.length} orders`);

    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      orders,
    };
  }
}
