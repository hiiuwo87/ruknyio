import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheManager,
  ) {}

  async getStats() {
    return this.cache.wrap('admin:users-stats', 120, async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS today,
          COUNT(*) FILTER (WHERE "createdAt" >= $2)::int AS this_week,
          COUNT(*) FILTER (WHERE "createdAt" >= $3)::int AS this_month,
          COUNT(*) FILTER (WHERE role = 'ADMIN')::int AS admin_count,
          COUNT(*) FILTER (WHERE role = 'PREMIUM')::int AS premium_count,
          COUNT(*) FILTER (WHERE role = 'BASIC')::int AS basic_count,
          COUNT(*) FILTER (WHERE role = 'GUEST')::int AS guest_count,
          COUNT(*) FILTER (WHERE "emailVerified" = true)::int AS verified,
          COUNT(*) FILTER (WHERE "profileCompleted" = true)::int AS profile_completed,
          COUNT(*) FILTER (WHERE "twoFactorEnabled" = true)::int AS two_factor_enabled,
          COUNT(*) FILTER (WHERE "lastLoginAt" >= $1)::int AS active_today
        FROM users
      `, todayStart, weekStart, monthStart);

      const r = rows[0];
      const total = r.total;
      const verified = r.verified;

      return {
        total,
        today: r.today,
        thisWeek: r.this_week,
        thisMonth: r.this_month,
        byRole: {
          admin: r.admin_count,
          premium: r.premium_count,
          basic: r.basic_count,
          guest: r.guest_count,
        },
        verified,
        profileCompleted: r.profile_completed,
        twoFactorEnabled: r.two_factor_enabled,
        activeToday: r.active_today,
        verificationRate: total > 0 ? Math.round((verified / total) * 100) : 0,
      };
    });
  }

  async getUsers(query: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    emailVerified?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, search, role, emailVerified, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { name: { contains: search, mode: 'insensitive' } } },
        { profile: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (role) where.role = role;
    if (emailVerified !== undefined) where.emailVerified = emailVerified === 'true';
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          profileCompleted: true,
          twoFactorEnabled: true,
          phoneNumber: true,
          lastLoginAt: true,
          createdAt: true,
          accountType: true,
          googleId: true,
          profile: { select: { name: true, username: true, avatar: true } },
          _count: {
            select: {
              events: true,
              forms: true,
              orders: true,
              sessions: true,
              posts: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified,
        profileCompleted: u.profileCompleted,
        twoFactorEnabled: u.twoFactorEnabled,
        phoneNumber: u.phoneNumber,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        accountType: u.accountType,
        hasGoogle: !!u.googleId,
        name: u.profile?.name ?? null,
        username: u.profile?.username ?? null,
        avatar: u.profile?.avatar ?? null,
        eventsCount: u._count.events,
        formsCount: u._count.forms,
        ordersCount: u._count.orders,
        sessionsCount: u._count.sessions,
        postsCount: u._count.posts,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        profile: { include: { socialLinks: true } },
        sessions: {
          where: { isRevoked: false },
          orderBy: { lastActivity: 'desc' },
          take: 10,
        },
        stores: { select: { id: true, name: true, slug: true, status: true } },
        _count: {
          select: {
            events: true,
            forms: true,
            orders: true,
            sessions: true,
            posts: true,
            stores: true,
          },
        },
      },
    });
    return user;
  }

  async updateUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as any },
    });
  }

  async deleteUserSessions(id: string) {
    return this.prisma.session.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revokedReason: 'Admin revoked all sessions' },
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async exportUsers(query: {
    role?: string;
    emailVerified?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.emailVerified !== undefined) where.emailVerified = query.emailVerified === 'true';
    if (query.startDate) where.createdAt = { ...where.createdAt, gte: new Date(query.startDate) };
    if (query.endDate) where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        profileCompleted: true,
        createdAt: true,
        lastLoginAt: true,
        accountType: true,
        profile: { select: { name: true, username: true } },
      },
    });

    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.profile?.name ?? '',
        username: u.profile?.username ?? '',
        role: u.role,
        emailVerified: u.emailVerified,
        profileCompleted: u.profileCompleted,
        accountType: u.accountType,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? '',
      })),
      total: users.length,
    };
  }
}
