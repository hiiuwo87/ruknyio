import { Module } from '@nestjs/common';
import { PushSubscriptionService } from './push-subscription.service';
import { PushSubscriptionController } from './push-subscription.controller';

@Module({
  providers: [PushSubscriptionService],
  controllers: [PushSubscriptionController],
  exports: [PushSubscriptionService], // Export for use in other modules
})
export class PushNotificationsModule {}
