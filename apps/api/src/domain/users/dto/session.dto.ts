export class SessionResponseDto {
  id: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
  lastActivity: Date;
  createdAt: Date;
  isCurrent: boolean;
}
