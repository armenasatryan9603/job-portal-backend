import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FirebaseNotificationService } from "./firebase-notification.service";
import { EmailNotificationService } from "./email-notification.service";
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
    private emailNotificationService: EmailNotificationService,
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
    placeholders?: Record<string, string | number>
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

    // Send push notification only if user has push notifications enabled
    // Default to true if preference is not set (backward compatibility)
    const pushEnabled = preferences.pushNotificationsEnabled !== false;

    if (pushEnabled) {
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
    } else {
      console.log(
        `Push notifications disabled for user ${userId}, skipping push notification`
      );
    }

    // Send email notification only if user has email notifications enabled
    // Default to true if preference is not set (backward compatibility)
    const emailEnabled = preferences.emailNotificationsEnabled !== false;

    if (emailEnabled) {
      try {
        // Create HTML email body
        const htmlBody = this.createEmailHtmlBody(title, message, type, data);
        const textBody = message; // Plain text version

        await this.emailNotificationService.sendEmailNotification(
          userId,
          title, // Use translated title as email subject
          htmlBody,
          textBody
        );
      } catch (error) {
        console.error("Failed to send email notification:", error);
        // Don't fail the database operation if email fails
      }
    } else {
      console.log(
        `Email notifications disabled for user ${userId}, skipping email notification`
      );
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

  async updateUserFCMToken(userId: number, fcmToken: string) {
    return this.firebaseNotificationService.updateUserFCMToken(
      userId,
      fcmToken
    );
  }
}
