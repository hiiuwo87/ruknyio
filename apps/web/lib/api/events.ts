/**
 * 📅 Events API - Event management endpoints
 */

import { z } from 'zod';
import api from './client';

// ============ Schemas ============

export const EventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  image: z.string().nullable(),
  isPublic: z.boolean(),
  maxAttendees: z.number().nullable(),
  registrationCount: z.number(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Event = z.infer<typeof EventSchema>;

export const CreateEventInputSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  isPublic: z.boolean().default(true),
  maxAttendees: z.number().optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

// ============ API Functions ============

/**
 * Get user's events
 */
export async function getMyEvents(): Promise<Event[]> {
  const { data } = await api.get<Event[]>('/events/my');
  // Runtime validation with Zod schema
  return z.array(EventSchema).parse(data);
}

/**
 * Get event by slug
 */
export async function getEventBySlug(slug: string): Promise<Event> {
  const { data } = await api.get<Event>(`/events/${slug}`);
  // Runtime validation with Zod schema
  return EventSchema.parse(data);
}

/**
 * Get public events
 */
export async function getPublicEvents(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ events: Event[]; total: number }> {
  const { data } = await api.get<{ events: Event[]; total: number }>('/events', params);
  // Runtime validation with Zod schema
  return z.object({
    events: z.array(EventSchema),
    total: z.number(),
  }).parse(data);
}

/**
 * Create a new event
 */
export async function createEvent(input: CreateEventInput): Promise<Event> {
  const validated = CreateEventInputSchema.parse(input);
  const { data } = await api.post<Event>('/events', validated);
  // Runtime validation with Zod schema
  return EventSchema.parse(data);
}

/**
 * Register for an event
 */
export async function registerForEvent(eventId: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/events/${eventId}/register`);
  // Runtime validation
  return z.object({ success: z.boolean() }).parse(data);
}
