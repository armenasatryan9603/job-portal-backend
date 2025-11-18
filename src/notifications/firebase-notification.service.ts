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
      this.logger.log(`📤 [FCM] Attempting to send notification to user ${userId}`);
      this.logger.log(`   Title: ${title}`);
      this.logger.log(`   Body: ${body.substring(0, 50)}...`);

      // Get user's FCM token from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true, name: true },
      });

      if (!user) {
        this.logger.error(`❌ [FCM] User ${userId} not found in database`);
        return false;
      }

      if (!user.fcmToken) {
        this.logger.warn(`⚠️ [FCM] No FCM token found for user ${userId} (${user.name})`);
        this.logger.warn(`   User needs to log in and grant notification permissions`);
        return false;
      }

      this.logger.log(`✅ [FCM] Found FCM token for user ${userId}: ${user.fcmToken.substring(0, 30)}...`);

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
            channelId: 'default',
          },
          priority: 'high' as const,
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
          headers: {
            'apns-priority': '10',
          },
        },
      };

      this.logger.log(`📤 [FCM] Sending notification via Firebase Admin SDK...`);
      const response = await admin.messaging().send(message);
      this.logger.log(
        `✅ [FCM] Push notification sent successfully to user ${userId}`,
      );
      this.logger.log(`   Response: ${response}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `❌ [FCM] Failed to send push notification to user ${userId}:`,
      );
      
      // More detailed error logging
      if (error.code) {
        this.logger.error(`   Error code: ${error.code}`);
      }
      if (error.message) {
        this.logger.error(`   Error message: ${error.message}`);
      }
      
      // Handle specific Firebase errors
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        this.logger.error(`   ⚠️ FCM token is invalid or expired. User needs to log in again.`);
        // Optionally: Clear the invalid token from database
        try {
          await this.prisma.user.update({
            where: { id: userId },
            data: { fcmToken: null },
          });
          this.logger.log(`   🗑️ Cleared invalid FCM token from database`);
        } catch (updateError) {
          this.logger.error(`   Failed to clear invalid token: ${updateError}`);
        }
      }
      
      if (error.stack) {
        this.logger.error(`   Stack trace: ${error.stack}`);
      }
      
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
