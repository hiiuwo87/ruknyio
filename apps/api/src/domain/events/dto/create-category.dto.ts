import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name in English',
    example: 'Education',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: 'Category name in Arabic',
    example: 'تعليمي',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  nameAr?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Educational events, workshops, and courses',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Icon or emoji for the category',
    example: '📚',
    maxLength: 10,
  })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Color hex code for UI display',
    example: '#3B82F6',
    pattern: '^#[0-9A-Fa-f]{6}$',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex code (e.g., #3B82F6)',
  })
  color?: string;
}
