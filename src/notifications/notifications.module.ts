import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseNotificationService } from './firebase-notification.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseNotificationService, PrismaService],
  exports: [NotificationsService, FirebaseNotificationService],
})
export class NotificationsModule {}
