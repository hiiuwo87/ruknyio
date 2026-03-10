import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'Rukny Dev' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, example: 'user@rukny.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, example: '+9641234567890' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false, example: '/uploads/avatars/image.jpg' })
  @IsString()
  @IsOptional()
  avatar?: string;
}
