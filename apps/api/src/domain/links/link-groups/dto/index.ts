import {
  IsString,
  IsOptional,
  IsHexColor,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLinkGroupDto {
  @ApiProperty({ description: 'Group name (English)' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Group name (Arabic)' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiProperty({ description: 'Group color (hex)', default: '#6366f1' })
  @IsHexColor()
  color: string;

  @ApiPropertyOptional({ description: 'Icon name (Lucide icon)' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({
    description: 'Is group expanded by default',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isExpanded?: boolean;
}

export class UpdateLinkGroupDto {
  @ApiPropertyOptional({ description: 'Group name (English)' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Group name (Arabic)' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Group color (hex)' })
  @IsHexColor()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon name (Lucide icon)' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: 'Is group expanded' })
  @IsBoolean()
  @IsOptional()
  isExpanded?: boolean;
}
