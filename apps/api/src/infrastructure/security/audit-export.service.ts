import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import PDFDocument from 'pdfkit';

// Use require for exceljs to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');

export interface AuditExportOptions {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resource?: string;
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  limit?: number;
}

/**
 * 📋 Audit Trail Export Service
 *
 * تصدير سجلات الأمان بصيغ مختلفة
 */
@Injectable()
export class AuditExportService {
  private readonly logger = new Logger(AuditExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * تصدير سجلات الأمان
   */
  async exportAuditLogs(options: AuditExportOptions): Promise<Buffer | string> {
    const logs = await this.fetchAuditLogs(options);

    switch (options.format) {
      case 'json':
        return this.exportAsJson(logs);
      case 'csv':
        return this.exportAsCsv(logs);
      case 'xlsx':
        return this.exportAsExcel(logs);
      case 'pdf':
        return this.exportAsPdf(logs);
      default:
        return this.exportAsJson(logs);
    }
  }

  /**
   * جلب سجلات الأمان
   */
  private async fetchAuditLogs(options: AuditExportOptions): Promise<any[]> {
    const where: any = {};

    if (options.startDate) {
      where.createdAt = { gte: options.startDate };
    }
    if (options.endDate) {
      where.createdAt = { ...where.createdAt, lte: options.endDate };
    }
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.action) {
      where.action = options.action;
    }

    return this.prisma.securityLog.findMany({
      where,
      take: options.limit || 10000,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        status: true,
        description: true,
        ipAddress: true,
        location: true,
        deviceType: true,
        browser: true,
        os: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * تصدير كـ JSON
   */
  private exportAsJson(logs: any[]): string {
    return JSON.stringify(logs, null, 2);
  }

  /**
   * تصدير كـ CSV
   */
  private exportAsCsv(logs: any[]): string {
    if (logs.length === 0) return '';

    const headers = [
      'ID',
      'Action',
      'Status',
      'Description',
      'User ID',
      'User Email',
      'IP Address',
      'Location',
      'Device',
      'Browser',
      'Created At',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.action,
      log.status || '',
      log.description || '',
      log.user?.id || '',
      log.user?.email || '',
      log.ipAddress || '',
      log.location || '',
      log.deviceType || '',
      log.browser || '',
      log.createdAt?.toISOString() || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    return csvContent;
  }

  /**
   * تصدير كـ Excel
   */
  private async exportAsExcel(logs: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rukny Security Audit';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Audit Logs');

    // إعداد الأعمدة
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Action', key: 'action', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'User ID', key: 'userId', width: 36 },
      { header: 'User Email', key: 'userEmail', width: 30 },
      { header: 'IP Address', key: 'ipAddress', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Device', key: 'deviceType', width: 15 },
      { header: 'Browser', key: 'browser', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 25 },
    ];

    // تنسيق الهيدر
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // إضافة البيانات
    logs.forEach((log) => {
      worksheet.addRow({
        id: log.id,
        action: log.action,
        status: log.status || '',
        description: log.description || '',
        userId: log.user?.id || '',
        userEmail: log.user?.email || '',
        ipAddress: log.ipAddress || '',
        location: log.location || '',
        deviceType: log.deviceType || '',
        browser: log.browser || '',
        createdAt: log.createdAt?.toISOString() || '',
      });
    });

    // تلوين الصفوف حسب الحالة
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const status = row.getCell('status').value;
        if (status === 'FAILURE') {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF6B6B' },
          };
        } else if (status === 'WARNING') {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFD93D' },
          };
        }
      }
    });

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  /**
   * تصدير كـ PDF
   */
  private async exportAsPdf(logs: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // العنوان
        doc.fontSize(20).text('Security Audit Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, {
          align: 'center',
        });
        doc.moveDown(2);

        // ملخص
        doc.fontSize(14).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Total Records: ${logs.length}`);

        const statusCounts = logs.reduce((acc, log) => {
          acc[log.status || 'UNKNOWN'] = (acc[log.status || 'UNKNOWN'] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        Object.entries(statusCounts).forEach(([status, count]) => {
          doc.text(`${status}: ${count}`);
        });

        doc.moveDown(2);

        // السجلات
        doc.fontSize(14).text('Audit Logs', { underline: true });
        doc.moveDown(0.5);

        logs.slice(0, 100).forEach((log, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(8);
          doc.text(`${index + 1}. [${log.status || 'INFO'}] ${log.action}`, {
            continued: false,
          });
          doc.text(`   Description: ${log.description || 'N/A'}`);
          doc.text(`   User: ${log.user?.email || 'N/A'}`);
          doc.text(`   IP: ${log.ipAddress || 'N/A'} - Location: ${log.location || 'N/A'}`);
          doc.text(`   Time: ${log.createdAt?.toISOString() || 'N/A'}`);
          doc.moveDown(0.5);
        });

        if (logs.length > 100) {
          doc.moveDown();
          doc.fontSize(10).text(`... and ${logs.length - 100} more records`);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * الحصول على ملخص السجلات
   */
  async getAuditSummary(days: number = 30): Promise<{
    totalLogs: number;
    byStatus: Record<string, number>;
    byAction: Record<string, number>;
    topUsers: { userId: string; count: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.prisma.securityLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        action: true,
        status: true,
        userId: true,
      },
    });

    const byStatus: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    logs.forEach((log) => {
      byStatus[log.status || 'UNKNOWN'] =
        (byStatus[log.status || 'UNKNOWN'] || 0) + 1;
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      if (log.userId) {
        userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
      }
    });

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLogs: logs.length,
      byStatus,
      byAction,
      topUsers,
    };
  }
}
