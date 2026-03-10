import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: 'Post content text',
    maxLength: 5000,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  content?: string;

  @ApiProperty({
    description: 'Post image URL',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;
}
