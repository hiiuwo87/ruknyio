import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStoreAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Google Analytics 4 Measurement ID (e.g., G-XXXXXXXXXX)',
    example: 'G-ABC123DEF4',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^(G-[A-Z0-9]+)?$/, {
    message: 'يجب أن يكون معرّف القياس بصيغة G-XXXXXXXXXX',
  })
  googleAnalyticsId?: string;
}
