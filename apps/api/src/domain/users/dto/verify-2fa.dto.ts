import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2FADto {
  @ApiProperty({ description: '6-digit verification code', example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
