import {
  Event,
  EventRegistration,
  EventWaitlist,
  EventReview,
  RegistrationStatus,
} from '@prisma/client';
import {
  CreateEventDto,
  EventStatus,
} from '../../../domain/events/dto/create-event.dto';
import { UpdateEventDto } from '../../../domain/events/dto/update-event.dto';

/**
 * 📋 Event Entity with relations
 */
export interface EventWithRelations extends Event {
  user?: {
    id: string;
    email?: string;
    profile?: {
      name: string | null;
      avatar: string | null;
    } | null;
  };
  category?: {
    id: string;
    name: string;
    nameAr: string;
    slug: string;
  } | null;
  registrations?: EventRegistration[];
  reviews?: EventReview[];
  _count?: {
    registrations?: number;
    reviews?: number;
    waitlist?: number;
  };
}

/**
 * 📋 Event Filters
 */
export interface EventFilters {
  status?: EventStatus;
  categoryId?: string;
  eventType?: string;
  isFeatured?: boolean;
  isVirtual?: boolean;
  upcoming?: boolean;
  userId?: string;
}

/**
 * 📋 Pagination Options
 */
export interface PaginationOptions {
  cursor?: string;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

/**
 * 📋 Paginated Result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

/**
 * 🔌 Events Repository Interface
 *
 * Defines the contract for event data access.
 * Implementations can use Prisma, TypeORM, or any other data source.
 *
 * Benefits:
 * - Easy to mock for testing
 * - Decouples domain from infrastructure
 * - Makes it easier to switch data sources
 */
export interface IEventsRepository {
  // ============ CRUD Operations ============

  /**
   * Create a new event
   */
  create(
    userId: string,
    data: CreateEventDto & { slug: string },
  ): Promise<EventWithRelations>;

  /**
   * Find event by ID
   */
  findById(id: string): Promise<EventWithRelations | null>;

  /**
   * Find event by slug
   */
  findBySlug(slug: string): Promise<EventWithRelations | null>;

  /**
   * Update an event
   */
  update(
    id: string,
    data: Partial<UpdateEventDto>,
  ): Promise<EventWithRelations>;

  /**
   * Delete an event
   */
  delete(id: string): Promise<void>;

  // ============ Query Operations ============

  /**
   * Find all events with filters and pagination
   */
  findAll(
    filters?: EventFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<EventWithRelations>>;

  /**
   * Find events by user ID
   */
  findByUserId(userId: string): Promise<EventWithRelations[]>;

  /**
   * Check if slug exists
   */
  slugExists(slug: string): Promise<boolean>;

  // ============ Registration Operations ============

  /**
   * Get registration count for an event
   */
  getRegistrationCount(
    eventId: string,
    statuses?: RegistrationStatus[],
  ): Promise<number>;

  /**
   * Check if user is registered
   */
  isUserRegistered(eventId: string, userId: string): Promise<boolean>;

  // ============ Statistics ============

  /**
   * Get event statistics
   */
  getStats(eventId: string): Promise<{
    totalRegistrations: number;
    confirmedAttendees: number;
    waitlistCount: number;
    checkInsCount: number;
    avgRating?: number;
    totalReviews: number;
  }>;
}

/**
 * Repository injection token
 */
export const EVENTS_REPOSITORY = 'EVENTS_REPOSITORY';
