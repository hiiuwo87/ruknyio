import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { CreateLinkGroupDto, UpdateLinkGroupDto } from './dto';

@Injectable()
export class LinkGroupsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createDto: CreateLinkGroupDto) {
    // Get user's profile
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Get the max order to place the new group at the end
    const maxOrder = await this.prisma.linkGroup.findFirst({
      where: { profileId: profile.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const linkGroup = await this.prisma.linkGroup.create({
      data: {
        ...createDto,
        profileId: profile.id,
        order: maxOrder ? maxOrder.order + 1 : 0,
      },
    });

    return linkGroup;
  }

  async findAll(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const groups = await this.prisma.linkGroup.findMany({
      where: { profileId: profile.id },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { links: true },
        },
      },
    });

    return groups.map((group) => ({
      ...group,
      linksCount: group._count.links,
    }));
  }

  async findOne(userId: string, id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const group = await this.prisma.linkGroup.findFirst({
      where: {
        id,
        profileId: profile.id,
      },
      include: {
        links: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Link group not found');
    }

    return group;
  }

  async update(userId: string, id: string, updateDto: UpdateLinkGroupDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const group = await this.prisma.linkGroup.findFirst({
      where: {
        id,
        profileId: profile.id,
      },
    });

    if (!group) {
      throw new NotFoundException('Link group not found');
    }

    const updatedGroup = await this.prisma.linkGroup.update({
      where: { id },
      data: updateDto,
    });

    return updatedGroup;
  }

  async remove(userId: string, id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const group = await this.prisma.linkGroup.findFirst({
      where: {
        id,
        profileId: profile.id,
      },
    });

    if (!group) {
      throw new NotFoundException('Link group not found');
    }

    // Set groupId to null for all links in this group
    await this.prisma.socialLink.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    // Delete the group
    await this.prisma.linkGroup.delete({
      where: { id },
    });

    return { message: 'Link group deleted successfully' };
  }
}
