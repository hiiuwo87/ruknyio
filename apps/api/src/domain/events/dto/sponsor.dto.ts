import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsUrl,
  IsBoolean,
  IsInt,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

// Define SponsorTier enum locally (should match Prisma schema)
export enum SponsorTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  BRONZE = 'BRONZE',
  PARTNER = 'PARTNER',
}

export class CreateSponsorDto {
  @ApiProperty({
    description: 'Sponsor name in English',
    example: 'Tech Corp',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Sponsor name in Arabic',
    example: 'تك كورب',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({
    description: 'Sponsor logo URL',
    example: 'https://example.com/logo.png',
  })
  @IsUrl()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Sponsor website',
    example: 'https://techcorp.com',
  })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Sponsor description',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Sponsorship tier',
    enum: SponsorTier,
    example: 'GOLD',
  })
  @IsEnum(SponsorTier)
  tier: SponsorTier;

  @ApiPropertyOptional({
    description: 'Display order (for sorting)',
    example: 1,
    default: 0,
  })
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Is sponsor active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSponsorDto {
  @ApiPropertyOptional({
    description: 'Sponsor name in English',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Sponsor name in Arabic',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({
    description: 'Sponsor logo URL',
  })
  @IsUrl()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Sponsor website',
  })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Sponsor description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Sponsorship tier',
    enum: SponsorTier,
  })
  @IsEnum(SponsorTier)
  @IsOptional()
  tier?: SponsorTier;

  @ApiPropertyOptional({
    description: 'Display order',
  })
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Is sponsor active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
