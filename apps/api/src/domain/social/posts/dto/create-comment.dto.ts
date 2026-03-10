import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  content: string;
}
