import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { AuthModule } from "../auth/auth.module"; // needed for JwtAuthGuard
import { MediaFilesModule } from "../media-files/media-files.module";
import { OrderPricingModule } from "../order-pricing/order-pricing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AIModule } from "../ai/ai.module";
import { CreditModule } from "../credit/credit.module";
import { SkillsModule } from "../skills/skills.module";

@Module({
  imports: [AuthModule, MediaFilesModule, OrderPricingModule, NotificationsModule, AIModule, CreditModule, SkillsModule], // so we can use JwtAuthGuard, MediaFilesService, OrderPricingService, NotificationsService, AIService, CreditTransactionsService, and SkillsService
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
})
export class OrdersModule {}
