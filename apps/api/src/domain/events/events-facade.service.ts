import { Injectable } from '@nestjs/common';
import { EventsCommandsService } from './services/events-commands.service';
import { EventsQueriesService } from './services/events-queries.service';
import { EventsRegistrationService } from './services/events-registration.service';
import { CreateEventDto, EventStatus } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RegisterEventDto } from './dto/register-event.dto';

/**
 * 🎭 Events Service Facade
 *
 * This is the main entry point for event operations.
 * It delegates to specialized services following CQRS-style separation:
 *
 * - EventsCommandsService: create, update, delete, publish, cancel
 * - EventsQueriesService: findAll, findOne, findBySlug, getMyEvents
 * - EventsRegistrationService: register, unregister, waitlist
 *
 * ~100 lines - thin facade that delegates to domain services
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly commands: EventsCommandsService,
    private readonly queries: EventsQueriesService,
    private readonly registration: EventsRegistrationService,
  ) {}

  // ============ Commands ============

  async create(userId: string, dto: CreateEventDto) {
    return this.commands.create(userId, dto);
  }

  async update(id: string, userId: string, dto: UpdateEventDto) {
    return this.commands.update(id, userId, dto);
  }

  async remove(id: string, userId: string) {
    return this.commands.remove(id, userId);
  }

  async publish(id: string, userId: string) {
    return this.commands.publish(id, userId);
  }

  async cancel(id: string, userId: string, reason?: string) {
    return this.commands.cancel(id, userId, reason);
  }

  // ============ Queries ============

  async findAll(filters?: {
    status?: EventStatus;
    categoryId?: string;
    eventType?: string;
    isFeatured?: boolean;
    isVirtual?: boolean;
    upcoming?: boolean;
    cursor?: string;
    limit?: number;
  }) {
    return this.queries.findAll(filters);
  }

  async findOne(id: string, userId?: string) {
    return this.queries.findOne(id, userId);
  }

  async findBySlug(slug: string, userId?: string) {
    return this.queries.findBySlug(slug, userId);
  }

  async getMyEvents(userId: string) {
    return this.queries.getMyEvents(userId);
  }

  async getUpcomingEvents(limit?: number) {
    return this.queries.getUpcomingEvents(limit);
  }

  async getFeaturedEvents(limit?: number) {
    return this.queries.getFeaturedEvents(limit);
  }

  async getEventStats(eventId: string) {
    return this.queries.getEventStats(eventId);
  }

  // ============ Registration ============

  async register(userId: string, dto: RegisterEventDto) {
    return this.registration.register(userId, dto);
  }

  async cancelRegistration(userId: string, eventId: string) {
    return this.registration.cancelRegistration(userId, eventId);
  }

  async getMyRegistrations(userId: string) {
    return this.registration.getMyRegistrations(userId);
  }

  async getEventRegistrations(eventId: string, userId: string) {
    return this.registration.getEventRegistrations(eventId, userId);
  }

  async confirmRegistration(
    eventId: string,
    userId: string,
    registrationId: string,
  ) {
    return this.registration.confirmRegistration(
      eventId,
      userId,
      registrationId,
    );
  }
}
