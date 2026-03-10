import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({
    example: 'DELETE',
    description: 'Must type "DELETE" to confirm account deletion',
  })
  @IsString()
  confirmation: string;

  @ApiPropertyOptional({
    example: 'لم أعد أحتاج الحساب',
    description: 'Reason for deleting account',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
