import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({ description: 'معرف المنتج' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'التقييم من 1 إلى 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1, { message: 'التقييم يجب أن يكون 1 على الأقل' })
  @Max(5, { message: 'التقييم يجب أن يكون 5 كحد أقصى' })
  @Type(() => Number)
  rating: number;

  @ApiPropertyOptional({ description: 'تعليق المراجعة' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'التقييم من 1 إلى 5',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'التقييم يجب أن يكون 1 على الأقل' })
  @Max(5, { message: 'التقييم يجب أن يكون 5 كحد أقصى' })
  @Type(() => Number)
  rating?: number;

  @ApiPropertyOptional({ description: 'تعليق المراجعة' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export enum ReviewSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
}

export class ReviewFiltersDto {
  @ApiPropertyOptional({ description: 'معرف المنتج' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'معرف المتجر' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({
    description: 'تصفية حسب التقييم',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating?: number;

  @ApiPropertyOptional({ enum: ReviewSortBy, description: 'ترتيب النتائج' })
  @IsOptional()
  @IsEnum(ReviewSortBy)
  sortBy?: ReviewSortBy;

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

export class ReviewStatsDto {
  @ApiProperty({ description: 'متوسط التقييم' })
  averageRating: number;

  @ApiProperty({ description: 'إجمالي التقييمات' })
  totalReviews: number;

  @ApiProperty({ description: 'توزيع التقييمات' })
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
