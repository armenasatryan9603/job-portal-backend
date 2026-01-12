import { Module } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionRenewalService } from "./subscription-renewal.service";
import { PrismaService } from "../prisma.service";
import { CreditModule } from "../credit/credit.module";
import { ExchangeRateModule } from "../exchange-rate/exchange-rate.module";

@Module({
  imports: [CreditModule, ExchangeRateModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionRenewalService, PrismaService],
  exports: [SubscriptionsService, SubscriptionRenewalService],
})
export class SubscriptionsModule {}
