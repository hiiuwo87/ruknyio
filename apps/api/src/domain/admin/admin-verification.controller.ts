import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/common/guards/roles.guard';
import { Roles } from '../../core/common/decorators/auth/roles.decorator';
import { Role } from '@prisma/client';

/**
 * Stub controller for verification endpoints.
 * No verification_requests Prisma model exists yet — returns empty data
 * so the admin dashboard pages don't 404.
 */
@Controller('admin/verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminVerificationController {
  @Get('stats')
  getStats() {
    return {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byStatus: { pending: 0, underReview: 0, approved: 0, rejected: 0 },
      approvalRate: 0,
    };
  }

  @Get('export')
  exportVerification() {
    return { data: [], total: 0 };
  }

  @Get()
  getVerifications(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  @Get(':id')
  getVerificationById(@Param('id') id: string) {
    return { id, message: 'Verification system not yet implemented' };
  }

  @Patch(':id')
  updateVerification(@Param('id') id: string, @Body() body: any) {
    return { id, message: 'Verification system not yet implemented' };
  }
}
