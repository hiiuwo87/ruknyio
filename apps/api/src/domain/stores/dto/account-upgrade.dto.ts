import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  Matches,
  IsOptional,
} from 'class-validator';

/**
 * 🚀 DTOs لترقية الحساب
 */

/**
 * طلب ترقية الحساب
 */
export class UpgradeAccountDto {
  @ApiProperty({
    description: 'رقم الهاتف المرتبط بالطلبات',
    example: '+9647701234567',
  })
  @IsString()
  @Matches(/^\+964[0-9]{10}$/, {
    message: 'رقم الهاتف يجب أن يكون بالصيغة العراقية: +964XXXXXXXXXX',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'البريد الإلكتروني للحساب الجديد',
    example: 'ahmed@example.com',
  })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @ApiProperty({
    description: 'كلمة المرور (8 أحرف على الأقل)',
    example: 'SecurePass123!',
  })
  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  password: string;

  @ApiPropertyOptional({
    description: 'الاسم الكامل',
    example: 'أحمد محمد',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

/**
 * ملخص بيانات الضيف
 */
export class GuestDataSummaryDto {
  @ApiProperty({ example: 5, description: 'عدد الطلبات' })
  ordersCount: number;

  @ApiProperty({ example: 3, description: 'عدد العناوين المحفوظة' })
  addressesCount: number;

  @ApiProperty({ example: 1250000, description: 'إجمالي المشتريات بالدينار' })
  totalSpent: number;

  @ApiProperty({ example: true, description: 'هل يمكن الترقية؟' })
  canUpgrade: boolean;
}

/**
 * البيانات المرتبطة بالترقية
 */
export class LinkedDataDto {
  @ApiProperty({ example: 5, description: 'عدد الطلبات المرتبطة' })
  ordersCount: number;

  @ApiProperty({ example: 3, description: 'عدد العناوين المرتبطة' })
  addressesCount: number;
}

/**
 * نتيجة الترقية
 */
export class UpgradeResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'تم ترقية حسابك بنجاح!' })
  message: string;

  @ApiProperty({ description: 'معرف المستخدم' })
  userId: string;

  @ApiProperty({ description: 'JWT Token' })
  accessToken: string;

  @ApiProperty({ description: 'البيانات المرتبطة', type: LinkedDataDto })
  linkedData: LinkedDataDto;
}
