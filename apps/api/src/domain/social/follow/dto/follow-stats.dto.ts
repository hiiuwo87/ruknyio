import { ApiProperty } from '@nestjs/swagger';

export class FollowStatsDto {
  @ApiProperty({ description: 'Number of followers' })
  followersCount: number;

  @ApiProperty({ description: 'Number of users being followed' })
  followingCount: number;
}
