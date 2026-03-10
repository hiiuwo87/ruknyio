import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({
    enum: EventStatus,
    example: EventStatus.SCHEDULED,
    description: 'Event status',
  })
  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;
}
