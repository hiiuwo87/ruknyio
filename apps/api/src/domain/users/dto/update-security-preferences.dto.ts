import { IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateSecurityPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailOnNewDevice?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnPasswordChange?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnFailedLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnEmailChange?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOn2FAChange?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnSuspiciousActivity?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  failedLoginThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  failedLoginTimeWindow?: number;

  @IsOptional()
  @IsBoolean()
  autoBlockSuspiciousIp?: boolean;
}
