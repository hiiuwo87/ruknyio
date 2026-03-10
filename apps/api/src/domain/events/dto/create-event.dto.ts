import {
  IsString,
  IsOptional,
  IsDate,
  IsNumber,
  IsInt,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum EventType {
  CONFERENCE = 'CONFERENCE',
  WORKSHOP = 'WORKSHOP',
  SEMINAR = 'SEMINAR',
  WEBINAR = 'WEBINAR',
  MEETUP = 'MEETUP',
  TRAINING = 'TRAINING',
  EXHIBITION = 'EXHIBITION',
  NETWORKING = 'NETWORKING',
  HACKATHON = 'HACKATHON',
  COMPETITION = 'COMPETITION',
  FESTIVAL = 'FESTIVAL',
  CONCERT = 'CONCERT',
  SPORTS = 'SPORTS',
  CHARITY = 'CHARITY',
  LECTURE = 'LECTURE',
  PANEL_DISCUSSION = 'PANEL_DISCUSSION',
  PRODUCT_LAUNCH = 'PRODUCT_LAUNCH',
  CORPORATE = 'CORPORATE',
  OTHER = 'OTHER',
}

export enum EventStatus {
  SCHEDULED = 'SCHEDULED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateEventDto {
  @ApiProperty({ example: 'Tech Conference 2025', description: 'Event title' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'abc123',
    description:
      'URL-friendly slug (auto-generated if not provided, 6 characters)',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9]+$/, {
    message: 'Slug must contain only lowercase letters and numbers',
  })
  @MaxLength(10)
  slug?: string;

  @ApiPropertyOptional({
    example: 'Annual technology conference featuring latest trends',
    description: 'Event description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({
    example: '2025-12-15T09:00:00Z',
    description: 'Event start date and time',
  })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({
    example: '2025-12-15T17:00:00Z',
    description: 'Event end date and time',
  })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiPropertyOptional({
    example: 'Tech Hub Downtown',
    description: 'Venue name',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  venue?: string;

  @ApiPropertyOptional({
    example: '123 Tech Street, San Francisco, CA',
    description: 'Full address',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Maximum number of attendees',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxAttendees?: number;

  @ApiPropertyOptional({
    example: 49.99,
    description: 'Event price (0 for free events)',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this is a featured event',
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this is a virtual event',
  })
  @IsBoolean()
  @IsOptional()
  isVirtual?: boolean;

  @ApiPropertyOptional({
    example: 'https://meet.google.com/abc-defg-hij',
    description: 'Virtual meeting URL',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  meetingUrl?: string;

  @ApiPropertyOptional({
    example: 'password123',
    description: 'Meeting password if required',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  meetingPassword?: string;

  @ApiPropertyOptional({
    enum: EventType,
    example: EventType.CONFERENCE,
    description: 'Type of event',
  })
  @IsEnum(EventType)
  @IsOptional()
  eventType?: EventType;

  @ApiPropertyOptional({
    example: 'category-uuid',
    description: 'Event category ID',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/image.jpg or /uploads/events/image.jpg',
    description: 'Event image URL (absolute or relative)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;
}
