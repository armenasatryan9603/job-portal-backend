import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FirebaseNotificationService } from "./firebase-notification.service";
import { TranslationsService } from "../translations/translations.service";
import {
  UserPreferences,
  DEFAULT_PREFERENCES,
} from "../types/user-preferences";

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private firebaseNotificationService: FirebaseNotificationService,
    private translationsService: TranslationsService
  ) {}

  async getUserNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId },
      }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: number) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async clearAllNotifications(userId: number) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }

  /**
   * Get user's preferred language from preferences JSON field, defaulting to 'en'
   */
  private async getUserLanguage(userId: number): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true } as any, // Type assertion - Prisma types will update after TypeScript server restart
      });

      if (user?.preferences) {
        const prefs = user.preferences as UserPreferences;
        return prefs.language || DEFAULT_PREFERENCES.language || "en";
      }

      return DEFAULT_PREFERENCES.language || "en";
    } catch (error) {
      console.error(`Error getting user language for user ${userId}:`, error);
      return DEFAULT_PREFERENCES.language || "en";
    }
  }

  async createNotificationWithPush(
    userId: number,
    type: string,
    titleKey: string,
    messageKey: string,
    data?: any,
    placeholders?: Record<string, string | number>
  ) {
    // Get user's language preference
    const language = await this.getUserLanguage(userId);

    // Translate title and message
    const title = await this.translationsService.translate(
      language,
      titleKey,
      placeholders
    );
    const message = await this.translationsService.translate(
      language,
      messageKey,
      placeholders
    );

    // Create database notification (store original keys for future reference)
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: {
          ...data,
          titleKey,
          messageKey,
          language,
        },
      },
    });

    // Send push notification
    try {
      await this.firebaseNotificationService.sendPushNotification(
        userId,
        title,
        message,
        { type, ...data }
      );
    } catch (error) {
      console.error("Failed to send push notification:", error);
      // Don't fail the database operation if push fails
    }

    return notification;
  }

  async updateUserFCMToken(userId: number, fcmToken: string) {
    return this.firebaseNotificationService.updateUserFCMToken(
      userId,
      fcmToken
    );
  }
}
