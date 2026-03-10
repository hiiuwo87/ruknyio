import { Controller, Post, Delete, Get, Body, UseGuards, Req, Logger, HttpCode, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { PushSubscriptionService, PushSubscriptionInput } from './push-subscription.service';

// Custom guard that accepts both JWT and Session cookies
@Injectable()
class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check if user is authenticated (either via JWT or session)
    if (request.user || request.session?.userId) {
      return true;
    }
    
    // Allow unauthenticated access for subscription endpoints
    return true;
  }
}

@Controller('push-subscriptions')
export class PushSubscriptionController {
  private readonly logger = new Logger(PushSubscriptionController.name);

  constructor(private readonly pushService: PushSubscriptionService) {}

  /**
   * Subscribe to push notifications
   * POST /push-subscriptions/subscribe
   */
  @Post('subscribe')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(200)
  async subscribe(
    @Body() subscription: PushSubscriptionInput,
    @Req() req: any
  ) {
    // Get user ID from JWT or session
    const userId = req.user?.id || req.session?.userId;
    
    if (!userId) {
      return {
        success: false,
        message: 'يجب تسجيل الدخول أولاً',
      };
    }

    const userAgent = req.get('user-agent');

    try {
      const result = await this.pushService.subscribeToPush(
        userId,
        subscription,
        userAgent
      );

      return {
        success: true,
        message: 'تم الاشتراك في إشعارات المتصفح بنجاح',
        data: {
          id: result.id,
          createdAt: result.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Subscribe error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   * POST /push-subscriptions/unsubscribe
   */
  @Post('unsubscribe')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(200)
  async unsubscribe(
    @Body() body: { endpoint: string },
    @Req() req: any
  ) {
    try {
      await this.pushService.unsubscribeFromPush(body.endpoint);

      return {
        success: true,
        message: 'تم إلغاء الاشتراك من إشعارات المتصفح',
      };
    } catch (error) {
      this.logger.error(`Unsubscribe error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all push subscriptions for current user
   * GET /push-subscriptions
   */
  @Get()
  @UseGuards(OptionalAuthGuard)
  async getSubscriptions(@Req() req: any) {
    const userId = req.user?.id || req.session?.userId;

    if (!userId) {
      return {
        success: false,
        message: 'يجب تسجيل الدخول أولاً',
        data: [],
      };
    }

    try {
      const subscriptions = await this.pushService.getUserSubscriptions(userId);

      return {
        success: true,
        data: subscriptions,
        total: subscriptions.length,
      };
    } catch (error) {
      this.logger.error(`Get subscriptions error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a specific push subscription
   * DELETE /push-subscriptions/:id
   */
  @Delete(':id')
  @UseGuards(OptionalAuthGuard)
  async deleteSubscription(
    @Body() body: { endpoint: string },
    @Req() req: any
  ) {
    try {
      await this.pushService.unsubscribeFromPush(body.endpoint);

      return {
        success: true,
        message: 'تم حذف الاشتراك بنجاح',
      };
    } catch (error) {
      this.logger.error(`Delete subscription error: ${error.message}`);
      throw error;
    }
  }
}
