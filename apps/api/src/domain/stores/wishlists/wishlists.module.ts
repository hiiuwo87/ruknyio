import { Module } from '@nestjs/common';
import { WishlistsRepository } from './wishlists.repository';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WishlistsRepository],
  exports: [WishlistsRepository],
})
export class WishlistsModule {}
