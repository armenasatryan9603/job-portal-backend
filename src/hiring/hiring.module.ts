import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { HiringController } from "./hiring.controller";
import { HiringService } from "./hiring.service";
import { OrderPricingModule } from "../order-pricing/order-pricing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ConfigService } from "../config/config.service";
import { ChatModule } from "../chat/chat.module";

@Module({
  imports: [NotificationsModule, OrderPricingModule, ChatModule],
  controllers: [HiringController],
  providers: [HiringService, PrismaService, ConfigService],
})
export class HiringModule {}
