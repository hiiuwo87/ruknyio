import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, IsOptional } from 'class-validator';
import { OrganizerRole } from '@prisma/client';

export class InviteOrganizerDto {
  @ApiProperty({
    description: 'User email to invite as organizer',
    example: 'organizer@example.com',
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Role of the organizer',
    enum: OrganizerRole,
    example: 'MODERATOR',
  })
  @IsEnum(OrganizerRole)
  role: OrganizerRole;

  @ApiPropertyOptional({
    description: 'Array of specific permissions',
    example: ['manage_registrations', 'edit_event', 'view_analytics'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  permissions?: string[];
}

export class UpdateOrganizerDto {
  @ApiPropertyOptional({
    description: 'Role of the organizer',
    enum: OrganizerRole,
  })
  @IsEnum(OrganizerRole)
  @IsOptional()
  role?: OrganizerRole;

  @ApiPropertyOptional({
    description: 'Array of specific permissions',
    type: [String],
  })
  @IsArray()
  @IsOptional()
  permissions?: string[];
}
