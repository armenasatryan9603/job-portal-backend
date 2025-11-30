import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { FirebaseNotificationService } from "./firebase-notification.service";
import { EmailNotificationService } from "./email-notification.service";
import { TranslationsModule } from "../translations/translations.module";

@Module({
  imports: [TranslationsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FirebaseNotificationService,
    EmailNotificationService,
    PrismaService,
  ],
  exports: [
    NotificationsService,
    FirebaseNotificationService,
    EmailNotificationService,
  ],
})
export class NotificationsModule {}
