import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';

interface FieldAnalytics {
  fieldId: string;
  fieldLabel: string;
  totalResponses: number;
  skipped: number;
  responseRate: number;
  valueDistribution: Record<string, number>;
  topValues: Array<{ value: string; count: number }>;
}

interface DeviceAnalytics {
  deviceType: string;
  views: number;
  submissions: number;
  conversionRate: number;
}

interface GeographicAnalytics {
  country: string;
  city?: string;
  views: number;
  submissions: number;
  conversionRate: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get comprehensive analytics for a form
   */
  async getFormAnalytics(formId: string, startDate?: Date, endDate?: Date) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!form) {
      return null;
    }

    // Get all submissions
    const submissions = await this.prisma.form_submissions.findMany({
      where: {
        formId,
        ...(startDate && { completedAt: { gte: startDate } }),
        ...(endDate && { completedAt: { lte: endDate } }),
      },
    });

    // Calculate basic metrics
    const totalSubmissions = submissions.length;
    const completionRate =
      form.viewCount > 0 ? (totalSubmissions / form.viewCount) * 100 : 0;

    const avgTimeToComplete =
      submissions
        .filter((s) => s.timeToComplete)
        .reduce((acc, s) => acc + (s.timeToComplete || 0), 0) /
      (submissions.filter((s) => s.timeToComplete).length || 1);

    // Field-level analytics
    const fieldAnalytics = await this.getFieldAnalytics(
      form.fields,
      submissions,
    );

    // Drop-off analysis (which fields users skip)
    const dropOffRate = this.calculateDropOffRate(form.fields, submissions);

    return {
      summary: {
        totalViews: form.viewCount,
        totalSubmissions,
        completionRate: Math.round(completionRate * 100) / 100,
        avgTimeToComplete: Math.round(avgTimeToComplete),
        startDate: submissions[0]?.completedAt,
        lastSubmission: submissions[submissions.length - 1]?.completedAt,
      },
      fieldAnalytics,
      dropOffRate,
    };
  }

  /**
   * Analyze field-level responses
   */
  private async getFieldAnalytics(
    fields: any[],
    submissions: any[],
  ): Promise<FieldAnalytics[]> {
    return fields.map((field) => {
      const responses = submissions
        .map((s) => s.data[field.id])
        .filter((val) => val !== undefined && val !== null && val !== '');

      const totalResponses = responses.length;
      const skipped = submissions.length - totalResponses;
      const responseRate =
        submissions.length > 0
          ? (totalResponses / submissions.length) * 100
          : 0;

      // Calculate value distribution
      const valueDistribution: Record<string, number> = {};
      responses.forEach((response) => {
        const value = Array.isArray(response)
          ? response.join(', ')
          : String(response);
        valueDistribution[value] = (valueDistribution[value] || 0) + 1;
      });

      // Get top values
      const topValues = Object.entries(valueDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }));

      return {
        fieldId: field.id,
        fieldLabel: field.label,
        totalResponses,
        skipped,
        responseRate: Math.round(responseRate * 100) / 100,
        valueDistribution,
        topValues,
      };
    });
  }

  /**
   * Calculate drop-off rate per field
   */
  private calculateDropOffRate(fields: any[], submissions: any[]): any[] {
    return fields.map((field, index) => {
      const answered = submissions.filter((s) => {
        const value = s.data[field.id];
        return value !== undefined && value !== null && value !== '';
      }).length;

      const dropOff = submissions.length - answered;
      const dropOffRate =
        submissions.length > 0 ? (dropOff / submissions.length) * 100 : 0;

      return {
        fieldId: field.id,
        fieldLabel: field.label,
        fieldOrder: index + 1,
        answered,
        dropOff,
        dropOffRate: Math.round(dropOffRate * 100) / 100,
      };
    });
  }

  /**
   * Get device analytics
   */
  async getDeviceAnalytics(
    formId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DeviceAnalytics[]> {
    // This would require storing device info in submissions
    // For now, return mock data structure
    // In production, parse userAgent field

    const submissions = await this.prisma.form_submissions.findMany({
      where: {
        formId,
        ...(startDate && { completedAt: { gte: startDate } }),
        ...(endDate && { completedAt: { lte: endDate } }),
      },
      select: {
        userAgent: true,
      },
    });

    // Parse user agents to detect device types
    const deviceStats: Record<string, { views: number; submissions: number }> =
      {
        mobile: { views: 0, submissions: 0 },
        tablet: { views: 0, submissions: 0 },
        desktop: { views: 0, submissions: 0 },
      };

    submissions.forEach((sub) => {
      const ua = sub.userAgent?.toLowerCase() || '';
      if (
        ua.includes('mobile') ||
        ua.includes('android') ||
        ua.includes('iphone')
      ) {
        deviceStats.mobile.submissions++;
      } else if (ua.includes('tablet') || ua.includes('ipad')) {
        deviceStats.tablet.submissions++;
      } else {
        deviceStats.desktop.submissions++;
      }
    });

    return Object.entries(deviceStats).map(([deviceType, stats]) => ({
      deviceType,
      views: stats.views,
      submissions: stats.submissions,
      conversionRate:
        stats.views > 0 ? (stats.submissions / stats.views) * 100 : 0,
    }));
  }

  /**
   * Get time-based trends
   */
  async getTimeTrends(
    formId: string,
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<any[]> {
    const submissions = await this.prisma.form_submissions.findMany({
      where: {
        formId,
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    // Group by interval
    const grouped: Record<string, number> = {};

    submissions.forEach((sub) => {
      let key: string;
      const date = new Date(sub.completedAt);

      switch (interval) {
        case 'hour':
          key = date.toISOString().slice(0, 13);
          break;
        case 'day':
          key = date.toISOString().slice(0, 10);
          break;
        case 'week':
          const weekNum = this.getWeekNumber(date);
          key = `${date.getFullYear()}-W${weekNum}`;
          break;
        case 'month':
          key = date.toISOString().slice(0, 7);
          break;
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped).map(([date, count]) => ({
      date,
      submissions: count,
    }));
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
