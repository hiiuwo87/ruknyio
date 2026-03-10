import {
  Controller,
  Get,
  Query,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../core/database/prisma/prisma.service';

@Controller('dev')
export class DevController {
  constructor(private prisma: PrismaService) {}

  @Get('verification-code')
  async getVerificationCode(
    @Query('email') email?: string,
    @Query('userId') userId?: string,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not allowed in production');
    }

    if (!email && !userId) {
      throw new BadRequestException(
        'Please provide `email` or `userId` query param',
      );
    }

    let user;
    if (email) {
      user = await this.prisma.user.findUnique({ where: { email } });
    } else {
      user = await this.prisma.user.findUnique({ where: { id: userId } });
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verification = await this.prisma.verification_codes.findFirst({
      where: {
        userId: user.id,
        type: 'IP_CHANGE',
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      userId: user.id,
      email: user.email,
      code: verification ? verification.code : null,
      expiresAt: verification ? verification.expiresAt : null,
    };
  }
}
