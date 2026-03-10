import { Module, OnModuleInit } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSheetsController } from './google-sheets.controller';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [GoogleSheetsController],
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule implements OnModuleInit {
  constructor(
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    // Inject email service into google sheets service
    this.googleSheetsService.setEmailService(this.emailService);
  }
}
