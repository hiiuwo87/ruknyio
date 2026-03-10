import { IsUrl, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShortUrlDto {
  @ApiProperty({
    example: 'https://example.com/very-long-url-that-needs-shortening',
    description: 'Original URL to shorten',
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  url: string;

  @ApiPropertyOptional({
    example: '2024-12-31T23:59:59.000Z',
    description: 'Expiration date (optional)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
