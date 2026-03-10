import { SecurityAction, SecurityStatus } from '@prisma/client';

export class CreateSecurityLogDto {
  userId: string;
  action: SecurityAction;
  status?: SecurityStatus;
  description?: string;
  ipAddress?: string;
  location?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  userAgent?: string;
  metadata?: any;
}
