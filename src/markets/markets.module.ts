import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MarketsService } from "./markets.service";
import { MarketsController } from "./markets.controller";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [AuthModule, SubscriptionsModule, NotificationsModule],
  controllers: [MarketsController],
  providers: [MarketsService, PrismaService],
  exports: [MarketsService],
})
export class MarketsModule {}
