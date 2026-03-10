import { Module } from '@nestjs/common';
import { LinkGroupsController } from './link-groups.controller';
import { LinkGroupsService } from './link-groups.service';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LinkGroupsController],
  providers: [LinkGroupsService],
  exports: [LinkGroupsService],
})
export class LinkGroupsModule {}
