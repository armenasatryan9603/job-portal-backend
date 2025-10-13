import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HiringController } from './hiring.controller';
import { HiringService } from './hiring.service';
import { OrderPricingService } from '../order-pricing/order-pricing.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [HiringController],
  providers: [HiringService,  OrderPricingService, PrismaService],
})
export class HiringModule {}
