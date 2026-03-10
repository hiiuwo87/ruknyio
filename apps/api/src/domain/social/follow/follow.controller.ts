import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FollowService } from './follow.service';
import { JwtAuthGuard } from '../../../core/common/guards/auth/jwt-auth.guard';
import { GetUser } from '../../../core/common/decorators/auth/get-user.decorator';
import { FollowStatsDto } from './dto';

@ApiTags('Follow System')
@Controller('follow')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 201, description: 'Successfully followed user' })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Already following this user' })
  async followUser(
    @GetUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.followService.followUser(currentUserId, userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed user' })
  @ApiResponse({ status: 404, description: 'Follow relationship not found' })
  async unfollowUser(
    @GetUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.followService.unfollowUser(currentUserId, userId);
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get list of user followers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns list of followers' })
  async getFollowers(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.followService.getFollowers(userId, page, limit);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Get list of users that user is following' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns list of following users' })
  async getFollowing(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.followService.getFollowing(userId, page, limit);
  }

  @Get(':userId/stats')
  @ApiOperation({ summary: 'Get follow statistics for a user' })
  @ApiResponse({
    status: 200,
    description: 'Returns follow stats',
    type: FollowStatsDto,
  })
  async getFollowStats(
    @Param('userId') userId: string,
  ): Promise<FollowStatsDto> {
    return this.followService.getFollowStats(userId);
  }

  @Get(':userId/is-following')
  @ApiOperation({ summary: 'Check if current user is following another user' })
  @ApiResponse({ status: 200, description: 'Returns boolean' })
  async isFollowing(
    @GetUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ) {
    const isFollowing = await this.followService.isFollowing(
      currentUserId,
      userId,
    );
    return { isFollowing };
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Get follow suggestions based on mutual connections',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Returns suggested users to follow',
  })
  async getFollowSuggestions(
    @GetUser('id') currentUserId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.followService.getFollowSuggestions(currentUserId, limit);
  }
}
