import { Module } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionRenewalService } from "./subscription-renewal.service";
import { PrismaService } from "../prisma.service";
import { CreditModule } from "../credit/credit.module";

@Module({
  imports: [CreditModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionRenewalService, PrismaService],
  exports: [SubscriptionsService, SubscriptionRenewalService],
})
export class SubscriptionsModule {}
