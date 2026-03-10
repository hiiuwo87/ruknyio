import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { FilesController } from './files.controller';
import { StorageService } from './storage.service';
import { StorageCleanupService } from './storage-cleanup.service';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { SharedModule } from '../../shared/modules/shared.module';

@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [StorageController, FilesController],
  providers: [StorageService, StorageCleanupService],
  exports: [StorageService],
})
export class StorageModule {}
