import {
  IsString,
  IsUrl,
  IsInt,
  IsOptional,
  Min,
  MaxLength,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSocialLinkDto {
  @ApiProperty({
    example: 'Twitter',
    description: 'Social media platform name',
  })
  @IsString()
  @MaxLength(50)
  platform: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Username on the platform',
  })
  @IsString()
  @MaxLength(100)
  username: string;

  @ApiProperty({
    example: 'https://twitter.com/johndoe',
    description: 'Full URL to the social profile',
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  url: string;

  @ApiPropertyOptional({
    example: 'My Personal Account',
    description: 'Custom title for the link (optional)',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order (lower number = higher priority)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({
    example: null,
    description: 'Group ID to assign this link to',
  })
  @IsString()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({
    example: 'active',
    description: 'Link visibility status',
    enum: ['active', 'hidden'],
  })
  @IsString()
  @IsIn(['active', 'hidden'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: 'classic',
    description: 'Link display layout',
    enum: ['classic', 'featured'],
  })
  @IsString()
  @IsIn(['classic', 'featured'])
  @IsOptional()
  layout?: string;

  @ApiPropertyOptional({
    example: null,
    description: 'Thumbnail URL for featured layout',
  })
  @IsString()
  @IsOptional()
  thumbnail?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the link is pinned to the top',
  })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}
