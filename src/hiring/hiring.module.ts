import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { HiringController } from "./hiring.controller";
import { HiringService } from "./hiring.service";
import { OrderPricingModule } from "../order-pricing/order-pricing.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule, OrderPricingModule],
  controllers: [HiringController],
  providers: [HiringService, PrismaService],
})
export class HiringModule {}
