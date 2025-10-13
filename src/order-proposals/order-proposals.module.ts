import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderProposalsController } from './order-proposals.controller';
import { OrderProposalsService } from './order-proposals.service';
import { OrderPricingService } from '../order-pricing/order-pricing.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [OrderProposalsController],
  providers: [OrderProposalsService,  OrderPricingService, PrismaService],
  exports: [OrderProposalsService],
})
export class OrderProposalsModule {}
