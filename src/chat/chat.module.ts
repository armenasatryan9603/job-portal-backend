import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { FirebaseNotificationService } from "../notifications/firebase-notification.service";
import { OrderPricingModule } from "../order-pricing/order-pricing.module";

@Module({
  imports: [OrderPricingModule],
  controllers: [ChatController],
  providers: [ChatService, PrismaService, FirebaseNotificationService],
  exports: [ChatService],
})
export class ChatModule {}
