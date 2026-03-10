import { SecurityAction, SecurityStatus } from '@prisma/client';

export class SecurityLogFilterDto {
  userId?: string;
  action?: SecurityAction;
  status?: SecurityStatus;
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}
