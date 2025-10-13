import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderPricingController } from './order-pricing.controller';
import { OrderPricingService } from './order-pricing.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [OrderPricingController],
  providers: [OrderPricingService, PrismaService],
  exports: [OrderPricingService], // Export for use in other modules
})
export class OrderPricingModule {}
