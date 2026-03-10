import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum SharePlatform {
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
  EMAIL = 'email',
  COPY_LINK = 'copy_link',
  QR_CODE = 'qr_code',
  OTHER = 'other',
}

export class TrackShareDto {
  @ApiProperty({
    description: 'Profile ID being shared',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({
    description: 'Platform used for sharing',
    enum: SharePlatform,
    example: SharePlatform.WHATSAPP,
  })
  @IsEnum(SharePlatform)
  platform: SharePlatform;

  @ApiProperty({
    description: 'Social link ID if sharing specific link',
    required: false,
  })
  @IsString()
  @IsOptional()
  socialLinkId?: string;
}
