import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';

/**
 * 📊 Forms Export Service
 * Handles: exportToCsv, getFormAnalytics
 *
 * ~200 lines - follows golden rule of ≤300 lines per service
 */
@Injectable()
export class FormsExportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Export submissions to CSV
   */
  async exportSubmissions(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    const submissions = await this.prisma.form_submissions.findMany({
      where: { formId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (submissions.length === 0) {
      throw new BadRequestException('No submissions to export');
    }

    // Build CSV
    const headers = [
      '#',
      'Name',
      'Email',
      'Date',
      'Time',
      'Duration (sec)',
      ...form.fields.map((f) => f.label),
    ];

    const rows = submissions.map((sub, index) => {
      const date = sub.completedAt;
      const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const row = [
        (index + 1).toString(),
        sub.user?.profile?.name || 'Anonymous',
        sub.user?.email || '-',
        dateStr,
        timeStr,
        sub.timeToComplete?.toString() || '-',
      ];

      form.fields.forEach((field) => {
        const value = sub.data[field.label] ?? sub.data[field.id];
        row.push(this.formatCellValue(value));
      });

      return row;
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(','))
      .join('\r\n');

    return {
      content: csvContent,
      filename: `${form.slug}-submissions-${Date.now()}.csv`,
      contentType: 'text/csv',
    };
  }

  /**
   * Get form analytics
   */
  async getFormAnalytics(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: { fields: true },
    });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    const submissions = await this.prisma.form_submissions.findMany({
      where: { formId },
      orderBy: { completedAt: 'asc' },
    });

    const totalSubmissions = submissions.length;
    const completionRate =
      form.viewCount > 0
        ? Math.round((totalSubmissions / form.viewCount) * 10000) / 100
        : 0;

    const timesToComplete = submissions
      .filter((s) => s.timeToComplete)
      .map((s) => s.timeToComplete);
    const avgTimeToComplete =
      timesToComplete.length > 0
        ? Math.round(
            timesToComplete.reduce((a, b) => a + b, 0) / timesToComplete.length,
          )
        : 0;

    // Submissions over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissionsByDay = this.groupSubmissionsByDay(
      submissions.filter((s) => s.completedAt >= thirtyDaysAgo),
    );

    // Field analytics
    const fieldAnalytics = this.calculateFieldAnalytics(
      form.fields,
      submissions,
    );

    // Drop-off rate
    const dropOffRate = this.calculateDropOffRate(form.fields, submissions);

    return {
      summary: {
        totalViews: form.viewCount,
        totalSubmissions,
        completionRate,
        avgTimeToComplete,
        firstSubmission: submissions[0]?.completedAt,
        lastSubmission: submissions[submissions.length - 1]?.completedAt,
      },
      submissionsByDay,
      fieldAnalytics,
      dropOffRate,
    };
  }

  // ============ Private Helpers ============

  private formatCellValue(value: any): string {
    if (value === undefined || value === null || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private escapeCsvCell(cell: string): string {
    const str = String(cell);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private groupSubmissionsByDay(submissions: any[]) {
    const grouped: Record<string, number> = {};

    submissions.forEach((sub) => {
      const date = sub.completedAt.toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    });

    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }

  private calculateFieldAnalytics(fields: any[], submissions: any[]) {
    return fields.map((field) => {
      const responses = submissions.filter((s) => {
        const value = s.data[field.label] ?? s.data[field.id];
        return value !== undefined && value !== null && value !== '';
      });

      const values: Record<string, number> = {};
      responses.forEach((s) => {
        const value = s.data[field.label] ?? s.data[field.id];
        const key = Array.isArray(value) ? value.join(', ') : String(value);
        values[key] = (values[key] || 0) + 1;
      });

      const topValues = Object.entries(values)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));

      return {
        fieldId: field.id,
        fieldLabel: field.label,
        totalResponses: responses.length,
        skipped: submissions.length - responses.length,
        responseRate:
          submissions.length > 0
            ? Math.round((responses.length / submissions.length) * 100)
            : 0,
        topValues,
      };
    });
  }

  private calculateDropOffRate(fields: any[], submissions: any[]) {
    const dropOffs: Array<{
      fieldLabel: string;
      dropOffCount: number;
      dropOffRate: number;
    }> = [];
    let remainingUsers = submissions.length;

    fields.forEach((field) => {
      const answered = submissions.filter((s) => {
        const value = s.data[field.label] ?? s.data[field.id];
        return value !== undefined && value !== null && value !== '';
      }).length;

      const dropped = remainingUsers - answered;
      dropOffs.push({
        fieldLabel: field.label,
        dropOffCount: dropped,
        dropOffRate:
          remainingUsers > 0 ? Math.round((dropped / remainingUsers) * 100) : 0,
      });
      remainingUsers = answered;
    });

    return dropOffs;
  }
}
