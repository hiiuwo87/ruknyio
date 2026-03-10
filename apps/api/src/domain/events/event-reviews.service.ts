import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CreateEventReviewDto } from './dto/create-event-review.dto';

@Injectable()
export class EventReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createEventReviewDto: CreateEventReviewDto) {
    const { eventId, rating, comment, isAnonymous } = createEventReviewDto;

    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if user attended the event
    const registration = await this.prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!registration || registration.status !== 'ATTENDED') {
      throw new BadRequestException('You can only review events you attended');
    }

    // Check if user already reviewed
    const existingReview = await this.prisma.eventReview.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this event');
    }

    // Create review
    const review = await this.prisma.eventReview.create({
      data: {
        eventId,
        userId,
        rating,
        comment,
        isAnonymous: isAnonymous || false,
      },
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Hide user info if anonymous
    if (review.isAnonymous) {
      return {
        ...review,
        user: {
          id: review.user.id,
          profile: {
            name: 'Anonymous',
            avatar: null,
          },
        },
      };
    }

    return review;
  }

  async findAllForEvent(eventId: string) {
    const reviews = await this.prisma.eventReview.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Hide user info for anonymous reviews
    return reviews.map((review) => {
      if (review.isAnonymous) {
        return {
          ...review,
          user: {
            id: review.user.id,
            profile: {
              name: 'Anonymous',
              avatar: null,
            },
          },
        };
      }
      return review;
    });
  }

  async getEventAverageRating(eventId: string) {
    const result = await this.prisma.eventReview.aggregate({
      where: { eventId },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return {
      averageRating: result._avg.rating || 0,
      totalReviews: result._count.rating,
    };
  }

  async getEventRatingsDistribution(eventId: string) {
    const reviews = await this.prisma.eventReview.findMany({
      where: { eventId },
      select: { rating: true },
    });

    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    reviews.forEach((review) => {
      distribution[review.rating]++;
    });

    return distribution;
  }

  async update(id: string, userId: string, rating: number, comment?: string) {
    const review = await this.prisma.eventReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    const updatedReview = await this.prisma.eventReview.update({
      where: { id },
      data: {
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return updatedReview;
  }

  async remove(id: string, userId: string) {
    const review = await this.prisma.eventReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.eventReview.delete({
      where: { id },
    });

    return { message: 'Review deleted successfully' };
  }
}
