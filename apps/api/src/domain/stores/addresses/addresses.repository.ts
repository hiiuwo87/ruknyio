import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Addresses Repository - Data Access Layer
 */
@Injectable()
export class AddressesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CREATE ====================

  async create(userId: string, data: Prisma.addressesCreateInput) {
    return this.prisma.addresses.create({
      data: {
        id: uuidv4(),
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  // ==================== READ ====================

  async findById(id: string) {
    return this.prisma.addresses.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.addresses.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findDefaultByUserId(userId: string) {
    return this.prisma.addresses.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async countByUserId(userId: string) {
    return this.prisma.addresses.count({
      where: { userId },
    });
  }

  // ==================== UPDATE ====================

  async update(id: string, data: Prisma.addressesUpdateInput) {
    return this.prisma.addresses.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async setAsDefault(id: string, userId: string) {
    // Clear existing default
    await this.prisma.addresses.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    return this.prisma.addresses.update({
      where: { id },
      data: { isDefault: true, updatedAt: new Date() },
    });
  }

  async clearDefault(userId: string) {
    return this.prisma.addresses.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // ==================== DELETE ====================

  async delete(id: string) {
    return this.prisma.addresses.delete({
      where: { id },
    });
  }

  // ==================== VALIDATION ====================

  async belongsToUser(id: string, userId: string): Promise<boolean> {
    const address = await this.prisma.addresses.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    return !!address;
  }
}
