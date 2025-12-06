import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrderProposalsController } from "./order-proposals.controller";
import { OrderProposalsService } from "./order-proposals.service";
import { OrderPricingModule } from "../order-pricing/order-pricing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CreditModule } from "../credit/credit.module";
import { ConfigService } from "../config/config.service";

@Module({
  imports: [NotificationsModule, CreditModule, OrderPricingModule],
  controllers: [OrderProposalsController],
  providers: [OrderProposalsService, PrismaService, ConfigService],
  exports: [OrderProposalsService],
})
export class OrderProposalsModule {}
