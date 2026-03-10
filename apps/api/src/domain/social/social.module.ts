import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma/prisma.module';

// Posts
import { PostsController } from './posts/posts.controller';
import { PostsService } from './posts/posts.service';

// Follow
import { FollowController } from './follow/follow.controller';
import { FollowService } from './follow/follow.service';

// Share
import { ShareController } from './share/share.controller';
import { ShareService } from './share/share.service';

@Module({
  imports: [PrismaModule],
  controllers: [PostsController, FollowController, ShareController],
  providers: [PostsService, FollowService, ShareService],
  exports: [PostsService, FollowService, ShareService],
})
export class SocialModule {}
