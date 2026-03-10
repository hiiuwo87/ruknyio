import { IsObject, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitFormDto {
  @ApiProperty({
    example: {
      'field-id-1': 'John Doe',
      'field-id-2': 'john@example.com',
      'field-id-3': 5,
    },
    description: 'Form field answers keyed by field ID',
  })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({
    example: 120,
    description: 'Time to complete in seconds',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  timeToComplete?: number;
}
