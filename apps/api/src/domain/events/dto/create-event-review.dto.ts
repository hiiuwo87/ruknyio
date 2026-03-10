import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateEventReviewDto {
  @ApiProperty({ example: 'event-uuid', description: 'Event ID to review' })
  @IsString()
  eventId: string;

  @ApiProperty({
    example: 5,
    description: 'Rating from 1 to 5',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @ApiPropertyOptional({
    example: 'Amazing event! Learned a lot.',
    description: 'Review comment',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Post review anonymously',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;
}
