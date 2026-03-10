/**
 * Event Types
 * 
 * Shared event-related types for frontend and backend.
 */

import type { UserBase } from './user';

/**
 * Event status enum
 */
export type EventStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

/**
 * Event visibility enum
 */
export type EventVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';

/**
 * Event type enum
 */
export type EventType = 'IN_PERSON' | 'ONLINE' | 'HYBRID';

/**
 * Base event type
 */
export interface EventBase {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  coverImage?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  timezone?: string;
  status: EventStatus;
  visibility: EventVisibility;
  eventType: EventType;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Full event with relations
 */
export interface Event extends EventBase {
  location?: EventLocation | null;
  category?: EventCategory | null;
  organizer: UserBase;
  organizerId: string;
  maxAttendees?: number | null;
  currentAttendees: number;
  price?: number | null;
  currency?: string;
  isFree: boolean;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * Event with registration info (for attendees)
 */
export interface EventWithRegistration extends Event {
  isRegistered: boolean;
  registrationStatus?: RegistrationStatus;
  registrationId?: string;
}

/**
 * Event location
 */
export interface EventLocation {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  virtualUrl?: string;
  instructions?: string;
}

/**
 * Event category
 */
export interface EventCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

/**
 * Event organizer details
 */
export interface EventOrganizer {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  isPrimary: boolean;
}

/**
 * Event sponsor
 */
export interface EventSponsor {
  id: string;
  name: string;
  logo?: string;
  website?: string;
  tier: SponsorTier;
  description?: string;
}

/**
 * Sponsor tier
 */
export type SponsorTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PARTNER';

/**
 * Event registration
 */
export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  ticketType?: string;
  ticketCode?: string;
  checkedInAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Registration status
 */
export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED' | 'CHECKED_IN';

/**
 * Create event payload
 */
export interface CreateEventPayload {
  title: string;
  description?: string;
  shortDescription?: string;
  coverImage?: string;
  startDate: Date | string;
  endDate?: Date | string;
  timezone?: string;
  eventType: EventType;
  visibility?: EventVisibility;
  location?: Partial<EventLocation>;
  categoryId?: string;
  maxAttendees?: number;
  price?: number;
  currency?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * Update event payload
 */
export interface UpdateEventPayload extends Partial<CreateEventPayload> {
  status?: EventStatus;
}

/**
 * Event filters
 */
export interface EventFilters {
  status?: EventStatus;
  visibility?: EventVisibility;
  eventType?: EventType;
  categoryId?: string;
  organizerId?: string;
  startDateFrom?: Date | string;
  startDateTo?: Date | string;
  city?: string;
  country?: string;
  isFree?: boolean;
  tags?: string[];
  search?: string;
}

/**
 * Event statistics
 */
export interface EventStatistics {
  totalRegistrations: number;
  confirmedAttendees: number;
  cancelledRegistrations: number;
  waitlistCount: number;
  checkedInCount: number;
  attendanceRate: number;
  revenue?: number;
  viewCount?: number;
}
