import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminStoresController } from './admin-stores.controller';
import { AdminStoresService } from './admin-stores.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminVerificationController } from './admin-verification.controller';

@Module({
  controllers: [
    AdminController,
    AdminUsersController,
    AdminStoresController,
    AdminProductsController,
    AdminOrdersController,
    AdminVerificationController,
  ],
  providers: [
    AdminService,
    AdminUsersService,
    AdminStoresService,
    AdminProductsService,
    AdminOrdersService,
  ],
})
export class AdminModule {}
