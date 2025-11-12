import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma.service';

/**
 * FirebaseNotificationService - Firebase Cloud Messaging (FCM) Only
 * 
 * This service uses ONLY Firebase Admin SDK for sending push notifications via FCM.
 * Other Firebase services (Storage, Database, Analytics) are NOT used to reduce costs.
 * 
 * The service initializes Firebase Admin SDK with minimal configuration,
 * using only the messaging service for push notifications.
 */
@Injectable()
export class FirebaseNotificationService {
  private readonly logger = new Logger(FirebaseNotificationService.name);

  constructor(private prisma: PrismaService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        // Try to use service account key file first
        try {
          const serviceAccount = require('../../service-account-key.json');
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.logger.log(
            '✅ Firebase Admin SDK initialized with service account',
          );
        } catch (serviceAccountError) {
          // Fallback to application default credentials
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
          });
          this.logger.log(
            '✅ Firebase Admin SDK initialized with default credentials',
          );
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
      this.logger.warn(
        '⚠️  Push notifications will not work without proper Firebase setup',
      );
    }
  }

  async sendPushNotification(
    userId: number,
    title: string,
    body: string,
    data?: any,
  ): Promise<boolean> {
    try {
      // Get user's FCM token from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true, name: true },
      });

      if (!user?.fcmToken) {
        this.logger.warn(`No FCM token found for user ${userId}`);
        return false;
      }

      const message = {
        token: user.fcmToken,
        notification: {
          title,
          body,
        },
        data: {
          type: data?.type || 'general',
          ...data,
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF231F7C',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(
        `✅ Push notification sent to user ${userId}: ${response}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send push notification to user ${userId}:`,
        error,
      );
      return false;
    }
  }

  async sendBulkPushNotifications(
    userIds: number[],
    title: string,
    body: string,
    data?: any,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const userId of userIds) {
      const result = await this.sendPushNotification(userId, title, body, data);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Bulk notification results: ${success} success, ${failed} failed`,
    );
    return { success, failed };
  }

  async updateUserFCMToken(userId: number, fcmToken: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcmToken },
      });
      this.logger.log(`✅ FCM token updated for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to update FCM token for user ${userId}:`,
        error,
      );
      throw error;
    }
  }
}
