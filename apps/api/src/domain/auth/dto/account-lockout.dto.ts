import { IsEmail, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 🔒 Account Lockout DTOs
 */

export class CheckLockoutDto {
  @ApiProperty({
    description: 'البريد الإلكتروني للتحقق',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'يجب إدخال بريد إلكتروني صحيح' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;
}

export class UnlockAccountDto {
  @ApiProperty({
    description: 'البريد الإلكتروني للحساب المراد فتحه',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'يجب إدخال بريد إلكتروني صحيح' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;

  @ApiProperty({
    description: 'سبب فتح القفل',
    example: 'طلب المستخدم عبر الدعم الفني',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class LockoutStatusResponseDto {
  @ApiProperty({
    description: 'هل الحساب مقفل',
    example: false,
  })
  isLocked: boolean;

  @ApiProperty({
    description: 'تاريخ انتهاء القفل',
    example: '2025-12-25T12:00:00.000Z',
    required: false,
  })
  lockoutUntil?: Date;

  @ApiProperty({
    description: 'عدد مرات القفل',
    example: 2,
  })
  lockCount: number;

  @ApiProperty({
    description: 'عدد المحاولات الأخيرة',
    example: 3,
  })
  recentAttempts: number;

  @ApiProperty({
    description: 'المحاولات المتبقية',
    example: 2,
  })
  remainingAttempts: number;

  @ApiProperty({
    description: 'آخر محاولة',
    required: false,
  })
  lastAttempt?: Date;
}

export class AttemptResultResponseDto {
  @ApiProperty({
    description: 'هل المحاولة مسموحة',
    example: true,
  })
  allowed: boolean;

  @ApiProperty({
    description: 'المحاولات المتبقية',
    example: 4,
    required: false,
  })
  remainingAttempts?: number;

  @ApiProperty({
    description: 'تاريخ انتهاء القفل',
    required: false,
  })
  lockoutUntil?: Date;

  @ApiProperty({
    description: 'مدة القفل بالدقائق',
    required: false,
  })
  lockoutMinutes?: number;

  @ApiProperty({
    description: 'رسالة للمستخدم',
    required: false,
  })
  message?: string;
}
