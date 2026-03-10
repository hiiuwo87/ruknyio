import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO لإنشاء فئة منتج جديدة
 */
export class CreateProductCategoryDto {
  @ApiPropertyOptional({
    description: 'اسم الفئة بالإنجليزية',
    example: 'Electronics',
  })
  @ValidateIf((o) => !o.nameAr || o.name)
  @IsString()
  @MinLength(2, { message: 'اسم الفئة يجب أن يكون حرفين على الأقل' })
  @MaxLength(100, { message: 'اسم الفئة يجب ألا يتجاوز 100 حرف' })
  name?: string;

  @ApiPropertyOptional({
    description: 'اسم الفئة بالعربية',
    example: 'إلكترونيات',
  })
  @ValidateIf((o) => !o.name || o.nameAr)
  @IsString()
  @MinLength(2, { message: 'اسم الفئة بالعربية يجب أن يكون حرفين على الأقل' })
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({
    description: 'الرابط المختصر (يتم توليده تلقائياً إذا لم يُحدد)',
    example: 'electronics',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'الرابط يجب أن يحتوي على حروف صغيرة وأرقام وشرطات فقط',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'وصف الفئة',
    example: 'جميع المنتجات الإلكترونية',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'أيقونة الفئة (Lucide icon name)',
    example: 'Smartphone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'لون الفئة (HEX)',
    example: '#6366f1',
    default: '#6366f1',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'اللون يجب أن يكون بصيغة HEX صحيحة',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'ترتيب العرض',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  order?: number;

  @ApiPropertyOptional({
    description: 'هل الفئة نشطة؟',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO لتحديث فئة منتج
 */
export class UpdateProductCategoryDto extends PartialType(
  CreateProductCategoryDto,
) {}

/**
 * DTO لإعادة ترتيب الفئات
 */
export class ReorderCategoriesDto {
  @ApiProperty({
    description: 'مصفوفة معرفات الفئات بالترتيب الجديد',
    example: ['cat_1', 'cat_2', 'cat_3'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];
}

/**
 * Response DTO للفئة
 */
export class ProductCategoryResponseDto {
  @ApiProperty({ description: 'معرف الفئة' })
  id: string;

  @ApiProperty({ description: 'معرف المتجر' })
  storeId: string;

  @ApiProperty({ description: 'اسم الفئة' })
  name: string;

  @ApiPropertyOptional({ description: 'اسم الفئة بالعربية' })
  nameAr?: string;

  @ApiProperty({ description: 'الرابط المختصر' })
  slug: string;

  @ApiPropertyOptional({ description: 'وصف الفئة' })
  description?: string;

  @ApiPropertyOptional({ description: 'أيقونة الفئة' })
  icon?: string;

  @ApiProperty({ description: 'لون الفئة' })
  color: string;

  @ApiProperty({ description: 'ترتيب العرض' })
  order: number;

  @ApiProperty({ description: 'هل الفئة نشطة؟' })
  isActive: boolean;

  @ApiProperty({ description: 'عدد المنتجات في الفئة' })
  productsCount: number;

  @ApiProperty({ description: 'تاريخ الإنشاء' })
  createdAt: Date;

  @ApiProperty({ description: 'تاريخ آخر تحديث' })
  updatedAt: Date;
}
