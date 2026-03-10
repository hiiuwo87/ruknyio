import { Module, forwardRef } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { FormsUploadController } from './forms-upload.controller';
import { FormsService } from './forms.service';
import { FormsFacadeService } from './forms-facade.service';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { EmailModule } from '../../integrations/email/email.module';
import { ValidationService } from '../../core/common/validation.service';
import { ConditionalLogicService } from './services/conditional-logic.service';
import { WebhookService } from './services/webhook.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { GoogleSheetsModule } from '../../integrations/google-sheets/google-sheets.module';
import { GoogleDriveModule } from '../../integrations/google-drive/google-drive.module';
import { S3Service } from '../../services/s3.service';
import { RedisModule } from '../../core/cache/redis.module';
import { RecaptchaEnterpriseService } from '../../infrastructure/security/recaptcha-enterprise.service';

// New split services
import {
  FormsCommandsService,
  FormsQueriesService,
  FormsSubmissionService,
  FormsExportService,
  FormsStepsService,
} from './services';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    NotificationsModule,
    RedisModule,
    forwardRef(() => GoogleSheetsModule),
    forwardRef(() => GoogleDriveModule),
  ],
  controllers: [FormsController, FormsUploadController],
  providers: [
    // Legacy service (for backward compatibility)
    FormsService,

    // New CQRS-style services
    FormsFacadeService,
    FormsCommandsService,
    FormsQueriesService,
    FormsSubmissionService,
    FormsExportService,
    FormsStepsService,

    // Shared services
    ValidationService,
    ConditionalLogicService,
    WebhookService,
    S3Service,
    RecaptchaEnterpriseService,
  ],
  exports: [FormsService, FormsFacadeService],
})
export class FormsModule {}
