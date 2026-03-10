import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RegistrationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

class UpdateRegistrationStatusDto {
  @ApiProperty({
    enum: RegistrationStatus,
    description: 'New registration status',
    example: RegistrationStatus.CONFIRMED,
  })
  @IsEnum(RegistrationStatus)
  status: RegistrationStatus;
}

@ApiTags('Event Registrations')
@Controller('events/registrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch(':registrationId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update registration status (Event owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Registration status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not event owner' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async updateRegistrationStatus(
    @Param('registrationId') registrationId: string,
    @Request() req,
    @Body() updateDto: UpdateRegistrationStatusDto,
  ) {
    // Get the registration with event details
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      include: { event: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Check if user is the event owner
    if (registration.event.userId !== req.user.id) {
      throw new ForbiddenException(
        'You are not authorized to update this registration',
      );
    }

    // Update the registration status
    const updatedRegistration = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        status: updateDto.status,
        ...(updateDto.status === RegistrationStatus.CONFIRMED && {
          confirmedAt: new Date(),
        }),
        ...(updateDto.status === RegistrationStatus.CANCELLED && {
          cancelledAt: new Date(),
        }),
      },
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

    return {
      message: 'Registration status updated successfully',
      registration: updatedRegistration,
    };
  }
}
