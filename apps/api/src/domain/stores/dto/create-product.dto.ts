import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductVariantDto } from './product-variant.dto';
import { CreateProductAttributeDto } from './product-attribute.dto';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  DISCONTINUED = 'DISCONTINUED',
}

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'iPhone 15 Pro' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Product name in Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional({
    description: 'Product slug (auto-generated if not provided)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Product description in Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionAr?: string;

  @ApiProperty({ description: 'Product price', example: 1500000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ description: 'Sale price (discounted)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice?: number;

  @ApiPropertyOptional({ description: 'Product quantity in stock', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Product SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({ description: 'Currency code', default: 'IQD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Is featured product', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Product attributes (JSON) - Legacy field',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Product image URLs', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  // ========== الحقول الجديدة للخصائص الديناميكية ==========

  @ApiPropertyOptional({
    description: 'هل المنتج له متغيرات (مقاسات، ألوان)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  @ApiPropertyOptional({
    description: 'هل يتم تتبع المخزون',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({
    description: 'متغيرات المنتج (المقاسات، الألوان)',
    type: [CreateProductVariantDto],
    example: [
      {
        sku: 'SHIRT-RED-M',
        price: 25000,
        stock: 10,
        attributes: { size: 'M', color: 'أحمر' },
      },
      {
        sku: 'SHIRT-BLUE-L',
        price: 25000,
        stock: 15,
        attributes: { size: 'L', color: 'أزرق' },
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];

  @ApiPropertyOptional({
    description: 'خصائص المنتج الديناميكية بناءً على فئة المتجر',
    type: [CreateProductAttributeDto],
    example: [
      { key: 'warranty', value: '1 year', valueAr: 'سنة واحدة' },
      { key: 'brand', value: 'Samsung', valueAr: 'سامسونج' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  productAttributes?: CreateProductAttributeDto[];
}
