import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsIn,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestQuickSignDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'البريد الإلكتروني للمستخدم',
  })
  @IsEmail({}, { message: 'يجب إدخال بريد إلكتروني صحيح' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;
}

export class ResendQuickSignDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'البريد الإلكتروني لإعادة إرسال الرابط',
  })
  @IsEmail({}, { message: 'يجب إدخال بريد إلكتروني صحيح' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;
}

export class VerifyIPCodeDto {
  @ApiProperty({
    example: '123456',
    description: 'رمز التحقق المكون من 6 أرقام',
  })
  @IsString({ message: 'رمز التحقق يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @Matches(/^\d{6}$/, { message: 'رمز التحقق يجب أن يكون مكوناً من 6 أرقام' })
  code: string;

  @ApiProperty({
    example: 'abc123-token-xyz',
    description: 'Token من QuickSign',
    required: false,
  })
  @IsString()
  @IsOptional()
  quickSignToken?: string;
}

export class ResendIPCodeDto {
  @ApiProperty({
    example: 'abc123-token-xyz',
    description: 'QuickSign token لإعادة إرسال رمز التحقق',
    required: false,
  })
  @IsString()
  @IsOptional()
  quickSignToken?: string;
}

export class CompleteProfileDto {
  @ApiProperty({
    example: 'أحمد محمد',
    description: 'الاسم الكامل',
  })
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'الاسم الكامل مطلوب' })
  @MinLength(2, { message: 'الاسم يجب أن يكون على الأقل حرفين' })
  @MaxLength(100, { message: 'الاسم يجب أن لا يتجاوز 100 حرف' })
  name: string;

  @ApiProperty({
    example: 'ahmad_mohamed',
    description: 'اسم المستخدم (فريد)',
  })
  @IsString({ message: 'اسم المستخدم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم المستخدم مطلوب' })
  @MinLength(3, { message: 'اسم المستخدم يجب أن يكون على الأقل 3 أحرف' })
  @MaxLength(30, { message: 'اسم المستخدم يجب أن لا يتجاوز 30 حرف' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط',
  })
  username: string;

  @ApiProperty({
    example: 'abc123-quicksign-token-xyz',
    description: 'QuickSign token للربط',
  })
  @IsString({ message: 'QuickSign token مطلوب' })
  @IsNotEmpty({ message: 'QuickSign token مطلوب' })
  quickSignToken: string;

  @ApiProperty({
    example: '1990-01-15',
    description: 'تاريخ الميلاد (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiProperty({
    example: 'SA',
    description: 'رمز الدولة (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiProperty({
    example: 'ar',
    description: 'اللغة المفضلة (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'], { message: 'اللغة يجب أن تكون ar أو en' })
  language?: string;

  @ApiProperty({
    example: true,
    description: 'هل المستخدم يريد بيع منتجات؟',
    required: false,
  })
  @IsOptional()
  isVendor?: boolean;

  @ApiProperty({
    example: 'fashion',
    description: 'تصنيف المتجر (إذا كان بائع)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(
    [
      'fashion',
      'electronics',
      'food',
      'beauty',
      'home',
      'sports',
      'books',
      'jewelry',
      'health',
      'photography',
      'automotive',
      'travel',
      'gifts',
      'pets',
      'kids',
      'services',
      'handmade',
      'organic',
      'cafe',
      'other',
    ],
    {
      message: 'التصنيف غير صحيح',
    },
  )
  storeCategory?: string;

  @ApiProperty({
    example: 'متجر متخصص في الأزياء العصرية',
    description: 'وصف المتجر (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'وصف المتجر يجب أن لا يتجاوز 500 حرف' })
  storeDescription?: string;

  @ApiProperty({
    example: '2-5',
    description: 'عدد الموظفين (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['solo', '2-5', '6-10', '11-50', '50+'], {
    message: 'عدد الموظفين غير صحيح',
  })
  employeesCount?: string;

  // Store Location Fields
  @ApiProperty({
    example: 'العراق',
    description: 'دولة المتجر (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  storeCountry?: string;

  @ApiProperty({
    example: 'بغداد',
    description: 'مدينة المتجر (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  storeCity?: string;

  @ApiProperty({
    example: 'شارع الرشيد، بغداد',
    description: 'عنوان المتجر (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storeAddress?: string;

  @ApiProperty({
    example: 33.3152,
    description: 'خط العرض (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  storeLatitude?: number;

  @ApiProperty({
    example: 44.3661,
    description: 'خط الطول (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  storeLongitude?: number;
}

export class CheckUsernameDto {
  @ApiProperty({
    example: 'ahmad_mohamed',
    description: 'اسم المستخدم للتحقق من توفره',
  })
  @IsString({ message: 'اسم المستخدم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم المستخدم مطلوب' })
  @MinLength(3, { message: 'اسم المستخدم يجب أن يكون على الأقل 3 أحرف' })
  @MaxLength(30, { message: 'اسم المستخدم يجب أن لا يتجاوز 30 حرف' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط',
  })
  username: string;
}

/**
 * 🔐 Update OAuth User Profile DTO
 * Used by OAuth users to complete their profile (name + username)
 * After they sign up via Google/LinkedIn
 */
export class UpdateOAuthProfileDto {
  @ApiProperty({
    example: 'أحمد محمد',
    description: 'الاسم الكامل',
  })
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @MinLength(2, { message: 'الاسم يجب أن يكون حرفين على الأقل' })
  @MaxLength(50, { message: 'الاسم طويل جداً' })
  name: string;

  @ApiProperty({
    example: 'ahmad_store',
    description: 'اسم المستخدم الفريد',
  })
  @IsString({ message: 'اسم المستخدم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم المستخدم مطلوب' })
  @MinLength(3, { message: 'اسم المستخدم يجب أن يكون على الأقل 3 أحرف' })
  @MaxLength(30, { message: 'اسم المستخدم يجب أن لا يتجاوز 30 حرف' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط',
  })
  username: string;

  @ApiProperty({
    example: '+964 770 123 4567',
    description: 'رقم الهاتف (اختياري)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
