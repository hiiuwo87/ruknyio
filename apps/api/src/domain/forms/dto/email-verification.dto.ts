import { IsString, IsEmail, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendVerificationCodeDto {
  @ApiProperty({
    example: 'field-id-1',
    description: 'The email field ID',
  })
  @IsUUID()
  fieldId: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address to verify',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;
}

export class VerifyEmailCodeDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address to verify',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'The verification code sent to email',
  })
  @IsString()
  code: string;
}
