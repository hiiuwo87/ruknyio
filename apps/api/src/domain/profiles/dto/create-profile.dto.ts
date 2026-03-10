import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '@prisma/client';

export class CreateProfileDto {
  @ApiProperty({
    example: 'johndoe',
    description:
      'Unique username (lowercase letters, numbers, hyphens, and underscores only)',
  })
  @IsString()
  @Matches(/^[a-z0-9_-]+$/, {
    message:
      'Username can only contain lowercase letters, numbers, hyphens, and underscores',
  })
  @MaxLength(30, { message: 'Username must be less than 30 characters' })
  username: string;

  @ApiPropertyOptional({
    example: 'Full-stack developer passionate about tech and innovation',
    description: 'Short bio about yourself',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Bio must be less than 500 characters' })
  bio?: string;

  @ApiPropertyOptional({
    example: 'PUBLIC',
    enum: Visibility,
    description: 'Profile visibility (PUBLIC or PRIVATE)',
  })
  @IsEnum(Visibility, {
    message: 'Visibility must be either PUBLIC or PRIVATE',
  })
  @IsOptional()
  visibility?: Visibility;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Display name',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Name must be less than 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    example: 'بغداد، العراق',
    description: 'User location',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Location must be less than 200 characters' })
  location?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Hide email from public profile',
  })
  @IsBoolean()
  @IsOptional()
  hideEmail?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Hide phone number from public profile',
  })
  @IsBoolean()
  @IsOptional()
  hidePhone?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Hide location from public profile',
  })
  @IsBoolean()
  @IsOptional()
  hideLocation?: boolean;
}
