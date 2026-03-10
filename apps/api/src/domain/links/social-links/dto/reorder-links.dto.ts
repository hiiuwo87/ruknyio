import { IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderLinksDto {
  @ApiProperty({
    example: ['uuid1', 'uuid2', 'uuid3'],
    description: 'Array of social link IDs in the desired order',
  })
  @IsArray()
  @ArrayNotEmpty()
  linkIds: string[];
}
