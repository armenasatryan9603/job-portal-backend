import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { AuthModule } from "../auth/auth.module"; // needed for JwtAuthGuard
import { MediaFilesModule } from "../media-files/media-files.module";
import { OrderPricingModule } from "../order-pricing/order-pricing.module";

@Module({
  imports: [AuthModule, MediaFilesModule, OrderPricingModule], // so we can use JwtAuthGuard, MediaFilesService, and OrderPricingService
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
})
export class OrdersModule {}
