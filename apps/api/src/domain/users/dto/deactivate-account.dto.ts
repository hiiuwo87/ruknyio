import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeactivateAccountDto {
  @ApiPropertyOptional({
    example: 'أحتاج استراحة',
    description: 'Reason for deactivating account',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
