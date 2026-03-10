import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { EmailService } from '../../integrations/email/email.service';
import { InviteOrganizerDto, UpdateOrganizerDto } from './dto/organizer.dto';
import { CreateSponsorDto, UpdateSponsorDto } from './dto/sponsor.dto';
import { sanitizeInput } from './utils/event.utils';

@Injectable()
export class EventOrganizersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Invite a user to be an organizer
   */
  async inviteOrganizer(
    eventId: string,
    inviterId: string,
    inviteDto: InviteOrganizerDto,
  ) {
    // Check if event exists and user is owner or has permission
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        user: true,
        organizers: {
          where: { userId: inviterId },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check permissions
    const isOwner = event.userId === inviterId;
    const isCoOrganizer = event.organizers.some(
      (org) => org.userId === inviterId && org.role === 'CO_ORGANIZER',
    );

    if (!isOwner && !isCoOrganizer) {
      throw new ForbiddenException(
        'Only event owner or co-organizers can invite organizers',
      );
    }

    // Find user by email
    const userToInvite = await this.prisma.user.findUnique({
      where: { email: inviteDto.email },
    });

    if (!userToInvite) {
      throw new NotFoundException('User with this email not found');
    }

    // Check if already an organizer
    const existingOrganizer = await this.prisma.eventOrganizer.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: userToInvite.id,
        },
      },
    });

    if (existingOrganizer) {
      throw new BadRequestException(
        'User is already an organizer for this event',
      );
    }

    // Create organizer invitation
    const organizer = await this.prisma.eventOrganizer.create({
      data: {
        eventId,
        userId: userToInvite.id,
        invitedBy: inviterId,
        role: inviteDto.role,
        permissions:
          inviteDto.permissions || this.getDefaultPermissions(inviteDto.role),
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        event: {
          select: {
            title: true,
            startDate: true,
            slug: true,
          },
        },
        inviter: {
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Send invitation email
    await this.emailService.sendOrganizerInvitation(
      organizer.user.email,
      organizer.user.profile?.name || 'Organizer',
      {
        eventTitle: organizer.event.title,
        eventSlug: organizer.event.slug,
        role: organizer.role,
        inviterName: organizer.inviter.profile?.name || 'Unknown',
        permissions: organizer.permissions,
      },
    );

    return organizer;
  }

  /**
   * Accept organizer invitation
   */
  async acceptInvitation(eventId: string, userId: string) {
    const organizer = await this.prisma.eventOrganizer.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!organizer) {
      throw new NotFoundException('Invitation not found');
    }

    if (organizer.status !== 'PENDING') {
      throw new BadRequestException('Invitation has already been processed');
    }

    return this.prisma.eventOrganizer.update({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        event: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Decline organizer invitation
   */
  async declineInvitation(eventId: string, userId: string) {
    const organizer = await this.prisma.eventOrganizer.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!organizer) {
      throw new NotFoundException('Invitation not found');
    }

    if (organizer.status !== 'PENDING') {
      throw new BadRequestException('Invitation has already been processed');
    }

    return this.prisma.eventOrganizer.update({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      data: {
        status: 'DECLINED',
      },
    });
  }

  /**
   * Get all organizers for an event
   */
  async getEventOrganizers(eventId: string) {
    return this.prisma.eventOrganizer.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Update organizer role/permissions
   */
  async updateOrganizer(
    eventId: string,
    organizerId: string,
    requesterId: string,
    updateDto: UpdateOrganizerDto,
  ) {
    // Check permissions
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.userId !== requesterId) {
      throw new ForbiddenException(
        'Only event owner can update organizer roles',
      );
    }

    return this.prisma.eventOrganizer.update({
      where: {
        eventId_userId: {
          eventId,
          userId: organizerId,
        },
      },
      data: {
        role: updateDto.role,
        permissions: updateDto.permissions,
      },
    });
  }

  /**
   * Remove organizer from event
   */
  async removeOrganizer(
    eventId: string,
    organizerId: string,
    requesterId: string,
  ) {
    // Check permissions
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const isOwner = event.userId === requesterId;
    const isSelfRemoval = organizerId === requesterId;

    if (!isOwner && !isSelfRemoval) {
      throw new ForbiddenException('You cannot remove this organizer');
    }

    await this.prisma.eventOrganizer.delete({
      where: {
        eventId_userId: {
          eventId,
          userId: organizerId,
        },
      },
    });

    return { message: 'Organizer removed successfully' };
  }

  /**
   * Get default permissions based on role
   */
  private getDefaultPermissions(role: string): string[] {
    const permissions = {
      OWNER: [
        'manage_event',
        'delete_event',
        'manage_organizers',
        'manage_sponsors',
        'manage_registrations',
        'view_analytics',
        'send_notifications',
      ],
      CO_ORGANIZER: [
        'edit_event',
        'manage_sponsors',
        'manage_registrations',
        'view_analytics',
        'send_notifications',
      ],
      MODERATOR: ['manage_registrations', 'view_analytics'],
      ASSISTANT: ['view_registrations', 'view_analytics'],
    };

    return permissions[role] || [];
  }

  /**
   * Check if user has specific permission for an event
   */
  async hasPermission(
    eventId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizers: {
          where: {
            userId,
            status: 'ACCEPTED',
          },
        },
      },
    });

    if (!event) {
      return false;
    }

    // Owner has all permissions
    if (event.userId === userId) {
      return true;
    }

    // Check organizer permissions
    const organizer = event.organizers[0];
    if (organizer && organizer.permissions.includes(permission)) {
      return true;
    }

    return false;
  }
}

@Injectable()
export class EventSponsorsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add sponsor to event
   */
  async addSponsor(
    eventId: string,
    userId: string,
    createDto: CreateSponsorDto,
  ) {
    // Check if user has permission
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizers: {
          where: {
            userId,
            status: 'ACCEPTED',
            permissions: { has: 'manage_sponsors' },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const hasPermission =
      event.userId === userId || event.organizers.length > 0;
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to add sponsors',
      );
    }

    // Sanitize inputs
    const sanitizedData = {
      eventId,
      name: sanitizeInput(createDto.name),
      nameAr: createDto.nameAr ? sanitizeInput(createDto.nameAr) : null,
      logo: createDto.logo || null,
      website: createDto.website || null,
      description: createDto.description
        ? sanitizeInput(createDto.description)
        : null,
      tier: createDto.tier,
      displayOrder: createDto.displayOrder || 0,
      isActive: createDto.isActive ?? true,
    };

    return this.prisma.eventSponsor.create({
      data: sanitizedData,
    });
  }

  /**
   * Get all sponsors for an event
   */
  async getEventSponsors(eventId: string, includeInactive: boolean = false) {
    const where: any = { eventId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.eventSponsor.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { tier: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Update sponsor
   */
  async updateSponsor(
    eventId: string,
    sponsorId: string,
    userId: string,
    updateDto: UpdateSponsorDto,
  ) {
    // Check permissions
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizers: {
          where: {
            userId,
            status: 'ACCEPTED',
            permissions: { has: 'manage_sponsors' },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const hasPermission =
      event.userId === userId || event.organizers.length > 0;
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to update sponsors',
      );
    }

    // Sanitize inputs
    const sanitizedData: any = {};
    if (updateDto.name) sanitizedData.name = sanitizeInput(updateDto.name);
    if (updateDto.nameAr !== undefined) {
      sanitizedData.nameAr = updateDto.nameAr
        ? sanitizeInput(updateDto.nameAr)
        : null;
    }
    if (updateDto.logo !== undefined) sanitizedData.logo = updateDto.logo;
    if (updateDto.website !== undefined)
      sanitizedData.website = updateDto.website;
    if (updateDto.description !== undefined) {
      sanitizedData.description = updateDto.description
        ? sanitizeInput(updateDto.description)
        : null;
    }
    if (updateDto.tier) sanitizedData.tier = updateDto.tier;
    if (updateDto.displayOrder !== undefined)
      sanitizedData.displayOrder = updateDto.displayOrder;
    if (updateDto.isActive !== undefined)
      sanitizedData.isActive = updateDto.isActive;

    return this.prisma.eventSponsor.update({
      where: { id: sponsorId },
      data: sanitizedData,
    });
  }

  /**
   * Remove sponsor
   */
  async removeSponsor(eventId: string, sponsorId: string, userId: string) {
    // Check permissions
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizers: {
          where: {
            userId,
            status: 'ACCEPTED',
            permissions: { has: 'manage_sponsors' },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const hasPermission =
      event.userId === userId || event.organizers.length > 0;
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to remove sponsors',
      );
    }

    await this.prisma.eventSponsor.delete({
      where: { id: sponsorId },
    });

    return { message: 'Sponsor removed successfully' };
  }
}
