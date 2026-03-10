import { IsArray, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkUpdateStatusDto {
  @ApiProperty({ description: 'Array of link IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  linkIds: string[];

  @ApiProperty({ description: 'New status', enum: ['active', 'hidden'] })
  @IsIn(['active', 'hidden'])
  status: string;
}

export class BulkMoveToGroupDto {
  @ApiProperty({ description: 'Array of link IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  linkIds: string[];

  @ApiPropertyOptional({ description: 'Group ID (null to remove from group)' })
  @IsString()
  @IsOptional()
  groupId?: string | null;
}

export class BulkDeleteDto {
  @ApiProperty({ description: 'Array of link IDs to delete', type: [String] })
  @IsArray()
  @IsString({ each: true })
  linkIds: string[];
}
