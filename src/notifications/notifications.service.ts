import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FirebaseNotificationService } from "./firebase-notification.service";
import { EmailNotificationService } from "./email-notification.service";
import { TranslationsService } from "../translations/translations.service";
import { PusherService } from "../pusher/pusher.service";
import {
  UserPreferences,
  DEFAULT_PREFERENCES,
} from "../types/user-preferences";

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private firebaseNotificationService: FirebaseNotificationService,
    private emailNotificationService: EmailNotificationService,
    private translationsService: TranslationsService,
    private pusherService: PusherService
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
    try {
      const result = await this.prisma.notification.deleteMany({
        where: { userId },
      });
      return {
        success: true,
        deletedCount: result.count,
      };
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      throw error;
    }
  }

  /**
   * Get user's preferences from preferences JSON field
   */
  private async getUserPreferences(userId: number): Promise<UserPreferences> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true } as any, // Type assertion - Prisma types will update after TypeScript server restart
      });

      if (user?.preferences) {
        const prefs = user.preferences as UserPreferences;
        return {
          ...DEFAULT_PREFERENCES,
          ...prefs, // User preferences override defaults
        };
      }

      return DEFAULT_PREFERENCES;
    } catch (error) {
      console.error(
        `Error getting user preferences for user ${userId}:`,
        error
      );
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Get user's preferred language from preferences JSON field, defaulting to 'en'
   */
  private async getUserLanguage(userId: number): Promise<string> {
    const prefs = await this.getUserPreferences(userId);
    return prefs.language || DEFAULT_PREFERENCES.language || "en";
  }

  async createNotificationWithPush(
    userId: number,
    type: string,
    titleKey: string,
    messageKey: string,
    data?: any,
    placeholders?: Record<string, string | number>,
    skipPusherEvent: boolean = false // Skip Pusher for chat messages (they have their own flow)
  ) {
    // Get user's preferences
    const preferences = await this.getUserPreferences(userId);
    const language =
      preferences.language || DEFAULT_PREFERENCES.language || "en";

    // Translate title and message
    const title = await this.translationsService.translate(
      language,
      titleKey,
      placeholders
    );
    let message = await this.translationsService.translate(
      language,
      messageKey,
      placeholders
    );

    // If translation failed (returns key) and we have messageContent in data, use it
    if (message === messageKey && data?.messageContent) {
      message = data.messageContent;
    }

    // Chat messages: Only send FCM push, don't store in database
    if (type === "chat_message") {
      console.log(
        "💬 Chat message notification - FCM only, no database storage"
      );

      const pushEnabled = preferences.pushNotificationsEnabled !== false;

      if (pushEnabled) {
        try {
          // Prepare notification data (no notificationId for chat messages)
          const pushData = {
            type,
            ...data,
          };

          await this.firebaseNotificationService.sendPushNotification(
            userId,
            title,
            message,
            pushData
          );
        } catch (error) {
          console.error(
            "Failed to send chat message push notification:",
            error
          );
        }
      }

      // Return null for chat messages (no database record created)
      return null;
    }

    // For all other notifications: Create database record
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

    // Send notifications in parallel (Pusher, FCM, Email) - non-blocking
    const notificationPromises: Promise<any>[] = [];

    // Emit real-time event via Pusher (skip for chat messages - they use conversation-updated)
    if (!skipPusherEvent) {
      notificationPromises.push(
        this.pusherService
          .trigger(`user-${userId}`, "notification-created", {
            notificationId: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            createdAt: notification.createdAt,
          })
          .catch((error) =>
            console.error("Error emitting Pusher notification event:", error)
          )
      );
    }

    // Send push notification if enabled
    const pushEnabled = preferences.pushNotificationsEnabled !== false;
    if (pushEnabled) {
      const pushData = {
        type,
        ...data,
        notificationId: notification.id.toString(),
      };

      notificationPromises.push(
        this.firebaseNotificationService
          .sendPushNotification(userId, title, message, pushData)
          .catch((error) =>
            console.error("Failed to send push notification:", error)
          )
      );
    }

    // Send email notification if enabled
    const emailEnabled = preferences.emailNotificationsEnabled !== false;
    if (emailEnabled) {
      const htmlBody = this.createEmailHtmlBody(title, message, type, data);
      const textBody = message;

      notificationPromises.push(
        this.emailNotificationService
          .sendEmailNotification(userId, title, htmlBody, textBody)
          .catch((error) =>
            console.error("Failed to send email notification:", error)
          )
      );
    }

    // Execute all notifications in parallel (non-blocking)
    if (notificationPromises.length > 0) {
      Promise.allSettled(notificationPromises).catch(() => {
        // Errors already logged individually
      });
    }

    return notification;
  }

  /**
   * Create HTML email body from notification data
   */
  private createEmailHtmlBody(
    title: string,
    message: string,
    type: string,
    data?: any
  ): string {
    // Simple HTML email template
    const appName = process.env.APP_NAME || "Job Portal";
    const appUrl = process.env.APP_URL || "https://example.com";

    let actionButton = "";
    let actionUrl = appUrl;

    // Generate action button based on notification type
    if (type === "order" && data?.orderId) {
      actionUrl = `${appUrl}/orders/${data.orderId}`;
      actionButton = `<a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #231F7C; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px;">View Order</a>`;
    } else if (type === "chat_message" && data?.conversationId) {
      actionUrl = `${appUrl}/chat/${data.conversationId}`;
      actionButton = `<a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #231F7C; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px;">View Conversation</a>`;
    } else if (type === "proposal_accepted" && data?.orderId) {
      actionUrl = `${appUrl}/orders/${data.orderId}`;
      actionButton = `<a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #231F7C; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px;">View Order</a>`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #231F7C; margin-top: 0; font-size: 24px; font-weight: 700;">${title}</h1>
    <p style="font-size: 16px; color: #666666; margin: 20px 0;">${message}</p>
    ${actionButton}
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
    <p style="font-size: 14px; color: #999999; margin: 0;">
      This is an automated notification from ${appName}. 
      <a href="${appUrl}/settings" style="color: #231F7C;">Manage your notification preferences</a>.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  async updateUserFCMToken(
    userId: number,
    fcmToken: string
  ): Promise<{ success: boolean }> {
    return this.firebaseNotificationService.updateUserFCMToken(
      userId,
      fcmToken
    );
  }
}
