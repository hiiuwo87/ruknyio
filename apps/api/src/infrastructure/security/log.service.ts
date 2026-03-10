import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CreateSecurityLogDto, SecurityLogFilterDto } from './dto';
import { SecurityLog } from '@prisma/client';
import { SecurityGateway } from './security.gateway';
import PDFDocument = require('pdfkit');

@Injectable()
export class SecurityLogService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => SecurityGateway))
    private securityGateway: SecurityGateway,
  ) {}

  async createLog(data: CreateSecurityLogDto): Promise<SecurityLog> {
    try {
      // التحقق من وجود المستخدم قبل إنشاء السجل (إذا لم يكن مجهول)
      if (data.userId && data.userId !== 'unknown') {
        const userExists = await this.prisma.user.findUnique({
          where: { id: data.userId },
          select: { id: true },
        });

        if (!userExists) {
          console.warn(
            `User with ID ${data.userId} not found, skipping security log`,
          );
          return null;
        }
      }

      const log = await this.prisma.securityLog.create({
        data: {
          userId: data.userId === 'unknown' ? null : data.userId,
          action: data.action,
          status: data.status || 'SUCCESS',
          description: data.description,
          ipAddress: data.ipAddress,
          location: data.location,
          deviceType: data.deviceType,
          browser: data.browser,
          os: data.os,
          userAgent: data.userAgent,
          metadata: data.metadata,
        },
      });

      // إرسال السجل الجديد عبر WebSocket فوراً (فقط للمستخدمين المُسجلين)
      if (data.userId && data.userId !== 'unknown') {
        this.securityGateway.emitSecurityLog(data.userId, log);
      }

      return log;
    } catch (error) {
      console.error('Error creating security log:', error);
      // Don't throw error - security logging should be non-blocking
      return null;
    }
  }

  async getUserLogs(filter: SecurityLogFilterDto): Promise<{
    logs: SecurityLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.action) {
      where.action = filter.action;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLogById(id: string): Promise<SecurityLog | null> {
    return this.prisma.securityLog.findUnique({
      where: { id },
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
    });
  }

  async deleteOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.securityLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async getLogStats(userId: string): Promise<{
    totalLogs: number;
    successfulLogins: number;
    failedLogins: number;
    recentActivity: number;
  }> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const [totalLogs, successfulLogins, failedLogins, recentActivity] =
      await Promise.all([
        this.prisma.securityLog.count({ where: { userId } }),
        this.prisma.securityLog.count({
          where: { userId, action: 'LOGIN_SUCCESS' },
        }),
        this.prisma.securityLog.count({
          where: { userId, action: 'LOGIN_FAILED' },
        }),
        this.prisma.securityLog.count({
          where: { userId, createdAt: { gte: last24Hours } },
        }),
      ]);

    return {
      totalLogs,
      successfulLogins,
      failedLogins,
      recentActivity,
    };
  }

  // حذف سجل واحد
  async deleteLog(logId: string, userId: string): Promise<void> {
    await this.prisma.securityLog.deleteMany({
      where: { id: logId, userId },
    });
  }

  // حذف متعدد
  async deleteMultipleLogs(logIds: string[], userId: string): Promise<number> {
    const result = await this.prisma.securityLog.deleteMany({
      where: {
        id: { in: logIds },
        userId,
      },
    });
    return result.count;
  }

  // تصدير السجلات
  async exportLogs(params: {
    userId: string;
    action?: any;
    status?: any;
    startDate?: Date;
    endDate?: Date;
    format: 'csv' | 'json' | 'pdf';
  }): Promise<string | Buffer> {
    const where: any = { userId: params.userId };

    if (params.action) where.action = params.action;
    if (params.status) where.status = params.status;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const logs = await this.prisma.securityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (params.format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    if (params.format === 'csv') {
      const headers = [
        'ID',
        'Action',
        'Status',
        'Description',
        'IP Address',
        'Location',
        'Device Type',
        'Browser',
        'OS',
        'Created At',
      ];

      const rows = logs.map((log) => [
        log.id,
        log.action,
        log.status,
        log.description || '',
        log.ipAddress || '',
        log.location || '',
        log.deviceType || '',
        log.browser || '',
        log.os || '',
        log.createdAt.toISOString(),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n');

      return csv;
    }

    if (params.format === 'pdf') {
      return new Promise<Buffer>((resolve, reject) => {
        try {
          const doc = new PDFDocument({ margin: 50 });
          const chunks: Buffer[] = [];

          doc.on('data', (chunk) => chunks.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);

          // Header
          doc
            .fontSize(20)
            .font('Helvetica-Bold')
            .text('Security Logs Report', { align: 'center' })
            .moveDown(0.5);

          doc
            .fontSize(10)
            .font('Helvetica')
            .text(`Generated: ${new Date().toLocaleString()}`, {
              align: 'center',
            })
            .moveDown(2);

          // Table
          logs.forEach((log, index) => {
            if (index > 0) doc.moveDown(1);

            doc
              .fontSize(12)
              .font('Helvetica-Bold')
              .text(`${index + 1}. ${log.action}`, { continued: false });

            doc
              .fontSize(10)
              .font('Helvetica')
              .text(`Status: ${log.status}`, { indent: 20 })
              .text(`Time: ${log.createdAt.toLocaleString()}`, { indent: 20 });

            if (log.description) {
              doc.text(`Description: ${log.description}`, { indent: 20 });
            }
            if (log.ipAddress) {
              doc.text(`IP: ${log.ipAddress}`, { indent: 20 });
            }
            if (log.deviceType) {
              doc.text(
                `Device: ${log.deviceType} - ${log.browser || 'Unknown'} - ${log.os || 'Unknown'}`,
                { indent: 20 },
              );
            }

            // Add separator line
            if (index < logs.length - 1) {
              doc
                .moveDown(0.5)
                .strokeColor('#cccccc')
                .lineWidth(0.5)
                .moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke();
            }
          });

          doc.end();
        } catch (error) {
          reject(error);
        }
      });
    }

    return '';
  }

  // إدارة IP Blocklist
  async getBlockedIPs(userId: string) {
    return this.prisma.ip_blocklist.findMany({
      where: { userId, isActive: true },
      orderBy: { blockedAt: 'desc' },
    });
  }

  async blockIP(data: {
    userId: string;
    ipAddress: string;
    reason?: string;
    expiresAt?: Date;
  }) {
    return this.prisma.ip_blocklist.create({
      data: {
        id: randomUUID(),
        userId: data.userId,
        ipAddress: data.ipAddress,
        reason: data.reason,
        expiresAt: data.expiresAt,
        blockType: 'MANUAL',
        updatedAt: new Date(),
      },
    });
  }

  async unblockIP(ipId: string, userId: string) {
    await this.prisma.ip_blocklist.updateMany({
      where: { id: ipId, userId },
      data: { isActive: false },
    });
  }

  async checkIPBlocked(ipAddress: string, userId: string): Promise<boolean> {
    const blocked = await this.prisma.ip_blocklist.findFirst({
      where: {
        userId,
        ipAddress,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return !!blocked;
  }

  async autoBlockIPAfterFailedAttempts(
    ipAddress: string,
    userId: string,
  ): Promise<void> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const failedAttempts = await this.prisma.securityLog.count({
      where: {
        userId,
        ipAddress,
        action: 'LOGIN_FAILED',
        createdAt: { gte: last24Hours },
      },
    });

    // حظر تلقائي بعد 5 محاولات فاشلة
    if (failedAttempts >= 5) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // حظر لمدة 24 ساعة

      await this.prisma.ip_blocklist.upsert({
        where: {
          userId_ipAddress: { userId, ipAddress },
        },
        create: {
          id: randomUUID(),
          userId,
          ipAddress,
          reason: `Automatic block after ${failedAttempts} failed login attempts`,
          blockType: 'AUTO_FAILED_LOGIN',
          failedAttempts,
          expiresAt,
          updatedAt: new Date(),
        },
        update: {
          failedAttempts,
          isActive: true,
          expiresAt,
        },
      });
    }
  }
}
