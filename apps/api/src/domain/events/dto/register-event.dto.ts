import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RegisterEventDto {
  @ApiProperty({
    example: 'event-uuid',
    description: 'Event ID to register for',
  })
  @IsString()
  eventId: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Number of attendees',
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  attendeeCount?: number;

  @ApiPropertyOptional({
    example: 'Special dietary requirements',
    description: 'Additional notes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
