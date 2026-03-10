import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { CreatePostDto, CreateCommentDto } from './dto';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new post
   */
  async create(userId: string, createPostDto: CreatePostDto) {
    // At least one of content or imageUrl must be provided
    if (!createPostDto.content && !createPostDto.imageUrl) {
      throw new BadRequestException('Post must have content or image');
    }

    return this.prisma.posts.create({
      data: {
        id: randomUUID(),
        userId,
        content: createPostDto.content,
        imageUrl: createPostDto.imageUrl,
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                username: true,
                bio: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });
  }

  /**
   * Get timeline posts (from followed users)
   */
  async getTimeline(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Get users that current user follows
    const following = await this.prisma.follows.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    followingIds.push(userId); // Include own posts

    const [posts, total] = await Promise.all([
      this.prisma.posts.findMany({
        where: {
          userId: { in: followingIds },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          content: true,
          imageUrl: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          users: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                  username: true,
                  bio: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            where: { userId },
            select: { id: true },
          },
        },
      }),
      this.prisma.posts.count({
        where: {
          userId: { in: followingIds },
        },
      }),
    ]);

    return {
      data: posts.map((post) => ({
        ...post,
        isLiked: post.likes.length > 0,
        likes: undefined, // Remove the likes array from response
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get posts by specific user
   */
  async getUserPosts(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.posts.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                  username: true,
                  bio: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.posts.count({
        where: { userId },
      }),
    ]);

    return {
      data: posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all posts (public feed)
   */
  async getAllPosts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.posts.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                  username: true,
                  bio: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.posts.count(),
    ]);

    return {
      data: posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Like a post
   */
  async likePost(userId: string, postId: string) {
    // Check if post exists
    const post = await this.prisma.posts.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if already liked
    const existingLike = await this.prisma.likes.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await this.prisma.likes.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      return { message: 'Post unliked', isLiked: false };
    } else {
      // Like
      await this.prisma.likes.create({
        data: {
          id: randomUUID(),
          userId,
          postId,
        },
      });

      return { message: 'Post liked', isLiked: true };
    }
  }

  /**
   * Add comment to post
   */
  async addComment(
    userId: string,
    postId: string,
    createCommentDto: CreateCommentDto,
  ) {
    // Check if post exists
    const post = await this.prisma.posts.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.comments.create({
      data: {
        id: randomUUID(),
        userId,
        postId,
        content: createCommentDto.content,
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                username: true,
                bio: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.comments.findMany({
        where: { postId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                  username: true,
                  bio: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.comments.count({
        where: { postId },
      }),
    ]);

    return {
      data: comments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete a post
   */
  async remove(userId: string, postId: string) {
    const post = await this.prisma.posts.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.posts.delete({
      where: { id: postId },
    });

    return { message: 'Post deleted successfully' };
  }
}
