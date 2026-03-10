import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard quick stats for current user' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard stats retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'object',
          properties: {
            active: { type: 'number' },
            total: { type: 'number' },
          },
        },
        products: {
          type: 'object',
          properties: {
            active: { type: 'number' },
            total: { type: 'number' },
          },
        },
        forms: {
          type: 'object',
          properties: {
            active: { type: 'number' },
            total: { type: 'number' },
          },
        },
        views: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            thisMonth: { type: 'number' },
          },
        },
      },
    },
  })
  async getQuickStats(@Request() req) {
    return this.dashboardService.getQuickStats(req.user.id);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity for current user' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of activities to return (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activities retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['event_registration', 'store_order', 'form_submission'],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          avatar: { type: 'string', nullable: true },
          href: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getRecentActivity(@Request() req, @Query('limit') limit?: number) {
    return this.dashboardService.getRecentActivity(
      req.user.id,
      limit ? Number(limit) : 10,
    );
  }

  @Get('chart')
  @ApiOperation({ summary: 'Get chart data for dashboard' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to include (default: 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'Chart data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        current: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'string' },
              date: { type: 'string' },
              orders: { type: 'number' },
              revenue: { type: 'number' },
              products: { type: 'number' },
            },
          },
        },
        previous: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'string' },
              date: { type: 'string' },
              orders: { type: 'number' },
              revenue: { type: 'number' },
              products: { type: 'number' },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            currentTotal: { type: 'number' },
            previousTotal: { type: 'number' },
            currentOrders: { type: 'number' },
            previousOrders: { type: 'number' },
          },
        },
      },
    },
  })
  async getChartData(@Request() req, @Query('days') days?: number) {
    return this.dashboardService.getChartData(req.user.id, days ? Number(days) : 7);
  }

  @Get('traffic')
  @ApiOperation({ summary: 'Get traffic sources for dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Traffic sources retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
          percentage: { type: 'number' },
        },
      },
    },
  })
  async getTrafficSources(@Request() req) {
    return this.dashboardService.getTrafficSources(req.user.id);
  }
}
