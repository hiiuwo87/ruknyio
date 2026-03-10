import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ResendService } from './resend.service';

@Module({
  providers: [EmailService, ResendService],
  exports: [EmailService, ResendService],
})
export class EmailModule {}
