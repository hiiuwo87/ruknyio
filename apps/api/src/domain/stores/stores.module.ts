import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsUploadService } from './products-upload.service';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { WishlistsService } from './wishlists.service';
import { WishlistsController } from './wishlists.controller';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
// نظام الخصائص الديناميكية للمنتجات
import { ProductVariantsService } from './product-variants.service';
import {
  ProductVariantsController,
  VariantsBulkController,
} from './product-variants.controller';
import { ProductAttributesService } from './product-attributes.service';
import {
  ProductAttributesController,
  StoreCategoriesTemplateController,
  StoreTemplateController,
} from './product-attributes.controller';
// نظام فئات المنتجات
import { ProductCategoriesService } from './product-categories.service';
import {
  ProductCategoriesController,
  PublicProductCategoriesController,
} from './product-categories.controller';
// 📱 نظام التحقق عبر واتساب للشراء كضيف
import { CheckoutAuthService } from './checkout-auth.service';
import { CheckoutAuthController } from './checkout-auth.controller';
// 📦 نظام تتبع الطلبات
import { OrderTrackingService } from './order-tracking.service';
import { OrderTrackingController } from './order-tracking.controller';
// 🚀 نظام ترقية الحساب
import { AccountUpgradeService } from './account-upgrade.service';
import { AccountUpgradeController } from './account-upgrade.controller';
// 📍 عناوين Checkout
import { CheckoutAddressesController } from './checkout-addresses.controller';
// 🛒 طلبات Checkout
import { CheckoutOrdersController } from './checkout-orders.controller';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { RedisModule } from '../../core/cache/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import S3Service from '../../services/s3.service';
// Integrations
import { WhatsappModule } from '../../integrations/whatsapp';
import { EmailModule } from '../../integrations/email/email.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    WhatsappModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    StoresController,
    ProductsController,
    CartController,
    OrdersController,
    ReviewsController,
    WishlistsController,
    CouponsController,
    AddressesController,
    // Controllers جديدة للخصائص الديناميكية
    ProductVariantsController,
    VariantsBulkController,
    ProductAttributesController,
    StoreCategoriesTemplateController,
    StoreTemplateController,
    // Controllers فئات المنتجات
    ProductCategoriesController,
    PublicProductCategoriesController,
    // 📱 Controller التحقق عبر واتساب
    CheckoutAuthController,
    // 📦 Controller تتبع الطلبات
    OrderTrackingController,
    // 🚀 Controller ترقية الحساب
    AccountUpgradeController,
    // 📍 Controller عناوين Checkout
    CheckoutAddressesController,
    // 🛒 Controller طلبات Checkout
    CheckoutOrdersController,
  ],
  providers: [
    StoresService,
    ProductsService,
    ProductsUploadService,
    S3Service,
    CartService,
    OrdersService,
    ReviewsService,
    WishlistsService,
    CouponsService,
    AddressesService,
    // Services جديدة للخصائص الديناميكية
    ProductVariantsService,
    ProductAttributesService,
    // Service فئات المنتجات
    ProductCategoriesService,
    // 📱 Service التحقق عبر واتساب
    CheckoutAuthService,
    // 📦 Service تتبع الطلبات
    OrderTrackingService,
    // 🚀 Service ترقية الحساب
    AccountUpgradeService,
  ],
  exports: [
    StoresService,
    ProductsService,
    ProductsUploadService,
    CartService,
    OrdersService,
    ReviewsService,
    WishlistsService,
    CouponsService,
    AddressesService,
    ProductVariantsService,
    ProductAttributesService,
    CheckoutAuthService,
    OrderTrackingService,
    AccountUpgradeService,
  ],
})
export class StoresModule {}
