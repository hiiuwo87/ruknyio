import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsInt,
  IsDateString,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING',
}

export class CreateCouponDto {
  @ApiProperty({
    description: 'كود الخصم (حروف وأرقام فقط)',
    example: 'SAVE20',
  })
  @IsString()
  @MinLength(3, { message: 'كود الخصم يجب أن يكون 3 أحرف على الأقل' })
  @MaxLength(20, { message: 'كود الخصم يجب أن لا يتجاوز 20 حرف' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'كود الخصم يجب أن يحتوي على حروف كبيرة وأرقام فقط',
  })
  @Transform(({ value }) => value?.toUpperCase())
  code: string;

  @ApiPropertyOptional({ description: 'وصف الكوبون بالإنجليزية' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'وصف الكوبون بالعربية' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiProperty({ enum: DiscountType, description: 'نوع الخصم' })
  @IsEnum(DiscountType, { message: 'نوع الخصم غير صالح' })
  discountType: DiscountType;

  @ApiProperty({ description: 'قيمة الخصم (نسبة مئوية أو مبلغ ثابت)' })
  @IsNumber()
  @Min(0, { message: 'قيمة الخصم يجب أن تكون موجبة' })
  @Type(() => Number)
  discountValue: number;

  @ApiPropertyOptional({ description: 'الحد الأدنى للطلب لتطبيق الكوبون' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'الحد الأقصى للخصم (للنسبة المئوية)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxDiscount?: number;

  @ApiPropertyOptional({ description: 'الحد الأقصى لعدد الاستخدامات الكلي' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;

  @ApiPropertyOptional({
    description: 'الحد الأقصى للاستخدام لكل مستخدم',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  perUserLimit?: number = 1;

  @ApiPropertyOptional({ description: 'تاريخ بداية الصلاحية' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'تاريخ انتهاء الصلاحية' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'حالة التفعيل', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ description: 'وصف الكوبون بالإنجليزية' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'وصف الكوبون بالعربية' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ enum: DiscountType, description: 'نوع الخصم' })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional({ description: 'قيمة الخصم' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue?: number;

  @ApiPropertyOptional({ description: 'الحد الأدنى للطلب' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'الحد الأقصى للخصم' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxDiscount?: number;

  @ApiPropertyOptional({ description: 'الحد الأقصى للاستخدامات الكلي' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'الحد الأقصى للاستخدام لكل مستخدم' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  perUserLimit?: number;

  @ApiPropertyOptional({ description: 'تاريخ بداية الصلاحية' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'تاريخ انتهاء الصلاحية' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'حالة التفعيل' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidateCouponDto {
  @ApiProperty({ description: 'كود الخصم' })
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  code: string;

  @ApiPropertyOptional({ description: 'معرف المتجر (اختياري)' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'قيمة الطلب للتحقق من الحد الأدنى' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  orderAmount?: number;
}

export class CouponFiltersDto {
  @ApiPropertyOptional({ description: 'بحث بالكود' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'تصفية حسب الحالة' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'تصفية الكوبونات الصالحة فقط' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  validOnly?: boolean;

  @ApiPropertyOptional({ description: 'رقم الصفحة', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر في الصفحة', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}
