/**
 * WebSocket Event DTOs for Real-time Event Updates
 */

export interface NewRegistrationEvent {
  attendeeName: string;
  attendeeAvatar?: string;
  totalRegistrations: number;
  maxAttendees?: number;
  timestamp: Date;
}

export interface RegistrationCancelledEvent {
  attendeeName: string;
  totalRegistrations: number;
  maxAttendees?: number;
  timestamp: Date;
}

export interface AttendeesCountUpdateEvent {
  totalRegistrations: number;
  maxAttendees?: number;
  availableSeats?: number;
  isFull: boolean;
}

export interface WaitlistPromotionEvent {
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  position: number;
  expiresAt: Date;
}

export interface WaitlistPositionUpdateEvent {
  eventId: string;
  position: number;
  totalWaiting: number;
}

export interface EventStatusChangedEvent {
  status: string;
  message?: string;
  timestamp: Date;
}

export interface EventDetailsUpdatedEvent {
  updatedFields: string[];
  changes: Record<string, any>;
  message?: string;
  timestamp: Date;
}

export interface OrganizerAnnouncementEvent {
  message: string;
  organizerName: string;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high';
}

export interface EventStatsUpdateEvent {
  totalRegistrations: number;
  confirmedAttendees: number;
  waitlistCount: number;
  checkInsCount: number;
  avgRating?: number;
  totalReviews: number;
}

export interface NewReviewEvent {
  reviewerName: string;
  rating: number;
  comment?: string;
  isAnonymous: boolean;
  avgRating: number;
  totalReviews: number;
  timestamp: Date;
}

export interface AvailabilityChangedEvent {
  isAvailable: boolean;
  availableSeats: number;
  message: string;
}

export interface OrganizerAddedEvent {
  organizerName: string;
  role: string;
  invitedBy: string;
  timestamp: Date;
}

export interface OrganizerInvitationEvent {
  eventId: string;
  organizerName: string;
  role: string;
  invitedBy: string;
  timestamp: Date;
}

export interface SponsorAddedEvent {
  sponsorName: string;
  tier: string;
  timestamp: Date;
}

export interface EventStartingSoonEvent {
  eventTitle: string;
  startDate: Date;
  minutesUntilStart: number;
  meetingUrl?: string;
}

export interface LiveStatsEvent {
  onlineAttendeesCount: number;
  activeNow: string[];
  recentActivity: any[];
}

// Client -> Server messages
export interface JoinEventMessage {
  eventId: string;
  role?: 'organizer' | 'attendee';
}

export interface LeaveEventMessage {
  eventId: string;
}
