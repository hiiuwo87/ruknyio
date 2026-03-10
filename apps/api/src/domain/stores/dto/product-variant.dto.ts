import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  Min,
  MaxLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO لإنشاء متغير منتج جديد
 * مثال: منتج قميص بمقاس XL ولون أحمر
 */
export class CreateProductVariantDto {
  @ApiPropertyOptional({
    description: 'رمز المخزون للمتغير',
    example: 'SHIRT-RED-XL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiProperty({ description: 'سعر المتغير', example: 25000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ description: 'السعر قبل الخصم', example: 30000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  compareAtPrice?: number;

  @ApiProperty({ description: 'الكمية المتوفرة', example: 50, default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @ApiProperty({
    description: 'خصائص المتغير (المقاس، اللون، إلخ)',
    example: { size: 'XL', color: 'أحمر' },
  })
  @IsObject()
  attributes: Record<string, string>;

  @ApiPropertyOptional({ description: 'رابط صورة المتغير' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'هل المتغير فعال', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO لتحديث متغير منتج
 */
export class UpdateProductVariantDto extends PartialType(
  CreateProductVariantDto,
) {}

/**
 * DTO لإنشاء عدة متغيرات دفعة واحدة
 */
export class BulkCreateVariantsDto {
  @ApiProperty({
    description: 'قائمة المتغيرات المراد إنشاؤها',
    type: [CreateProductVariantDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants: CreateProductVariantDto[];
}

/**
 * DTO لتوليد متغيرات تلقائياً من مجموعة خيارات
 * مثال: توليد كل التركيبات الممكنة للمقاسات والألوان
 */
export class GenerateVariantsDto {
  @ApiProperty({
    description: 'خيارات المتغيرات لتوليد كل التركيبات',
    example: {
      size: ['S', 'M', 'L', 'XL'],
      color: ['أسود', 'أبيض', 'أزرق'],
    },
  })
  @IsObject()
  options: Record<string, string[]>;

  @ApiProperty({ description: 'السعر الأساسي لجميع المتغيرات', example: 25000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basePrice: number;

  @ApiProperty({ description: 'الكمية الافتراضية لكل متغير', example: 10 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  defaultStock: number;
}

/**
 * DTO لتحديث مخزون متغير
 */
export class UpdateVariantStockDto {
  @ApiProperty({ description: 'الكمية الجديدة', example: 100 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;
}

/**
 * DTO لتحديث مخزون عدة متغيرات
 */
export class BulkUpdateStockDto {
  @ApiProperty({
    description: 'قائمة تحديثات المخزون',
    example: [
      { variantId: 'var_123', stock: 50 },
      { variantId: 'var_456', stock: 30 },
    ],
  })
  @IsArray()
  updates: { variantId: string; stock: number }[];
}
