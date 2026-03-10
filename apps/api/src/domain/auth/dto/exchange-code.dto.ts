import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeCodeDto {
  @ApiProperty({
    description: 'One-time OAuth code (64 hex chars from Redis)',
    minLength: 64,
    maxLength: 128,
  })
  @IsString()
  @Length(64, 128)
  code: string;
}
