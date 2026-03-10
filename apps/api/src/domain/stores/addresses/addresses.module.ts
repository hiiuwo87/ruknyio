import { Module } from '@nestjs/common';
import { AddressesRepository } from './addresses.repository';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AddressesRepository],
  exports: [AddressesRepository],
})
export class AddressesModule {}
