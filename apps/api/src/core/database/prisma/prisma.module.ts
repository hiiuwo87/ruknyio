import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseCleanupService } from '../cleanup.service';

@Global()
@Module({
  providers: [PrismaService, DatabaseCleanupService],
  exports: [PrismaService, DatabaseCleanupService],
})
export class PrismaModule {}
