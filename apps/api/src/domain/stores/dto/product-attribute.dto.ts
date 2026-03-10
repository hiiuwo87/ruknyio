import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  ValidateNested,
  IsArray,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO لإنشاء خاصية منتج جديدة
 * الخصائص هي للحقول الفردية مثل: المؤلف، طريقة التوصيل، الضمان
 */
export class CreateProductAttributeDto {
  @ApiProperty({
    description: 'مفتاح الخاصية (بالإنجليزية)',
    example: 'warranty',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: 'المفتاح يجب أن يبدأ بحرف ويحتوي فقط على أحرف وأرقام وشرطة سفلية',
  })
  key: string;

  @ApiProperty({
    description: 'قيمة الخاصية بالإنجليزية',
    example: '1 year',
  })
  @IsString()
  @MaxLength(500)
  value: string;

  @ApiPropertyOptional({
    description: 'قيمة الخاصية بالعربية',
    example: 'سنة واحدة',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  valueAr?: string;
}

/**
 * DTO لتحديث خاصية منتج
 */
export class UpdateProductAttributeDto extends PartialType(
  CreateProductAttributeDto,
) {}

/**
 * DTO لإنشاء عدة خصائص دفعة واحدة
 */
export class BulkCreateAttributesDto {
  @ApiProperty({
    description: 'قائمة الخصائص المراد إنشاؤها',
    type: [CreateProductAttributeDto],
    example: [
      { key: 'author', value: 'John Doe', valueAr: 'جون دو' },
      { key: 'deliveryMethod', value: 'shipping', valueAr: 'شحن' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  attributes: CreateProductAttributeDto[];
}

/**
 * DTO للتحقق من صحة الخصائص بناءً على قالب الفئة
 */
export class ValidateAttributesDto {
  @ApiProperty({
    description: 'معرف فئة المتجر',
    example: 'cat_electronics',
  })
  @IsString()
  categoryId: string;

  @ApiProperty({
    description: 'الخصائص المراد التحقق منها',
    type: [CreateProductAttributeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  attributes: CreateProductAttributeDto[];
}

/**
 * واجهة حقل القالب (للاستخدام الداخلي)
 */
export interface TemplateField {
  key: string;
  label: string;
  labelAr: string;
  type:
    | 'text'
    | 'number'
    | 'select'
    | 'multiselect'
    | 'date'
    | 'boolean'
    | 'textarea';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

/**
 * واجهة خصائص المتغيرات (للاستخدام الداخلي)
 */
export interface VariantAttribute {
  key: string;
  label: string;
  labelAr: string;
  options: string[];
}

/**
 * واجهة قالب الفئة الكامل
 */
export interface CategoryTemplateFields {
  hasVariants: boolean;
  variantAttributes?: VariantAttribute[];
  productAttributes: TemplateField[];
}
