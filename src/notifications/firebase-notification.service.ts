import { Injectable, Logger } from "@nestjs/common";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma.service";

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
    if (admin.apps.length) {
      return;
    }

    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(process.cwd(), "service-account-key.json");
    const projectIdFromEnv =
      process.env.GCP_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GOOGLE_PROJECT_ID;

    try {
      this.initializeWithServiceAccount(serviceAccountPath, projectIdFromEnv);
    } catch (error) {
      this.logger.error("❌ Failed to initialize Firebase Admin SDK:", error);
      this.logger.warn(
        "⚠️  Push notifications will not work without proper Firebase setup"
      );
    }
  }

  private initializeWithServiceAccount(
    serviceAccountPath: string,
    projectIdFallback?: string
  ) {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccountJson = JSON.parse(
        fs.readFileSync(serviceAccountPath, "utf8")
      );
      const credential = admin.credential.cert(
        serviceAccountJson as admin.ServiceAccount
      );
      const projectId =
        serviceAccountJson.project_id ||
        serviceAccountJson.projectId ||
        projectIdFallback;
      admin.initializeApp({
        credential,
        projectId,
      });
      this.logger.log(
        `✅ Firebase Admin SDK initialized with service account: ${serviceAccountPath}`
      );
      return;
    }

    const applicationDefault = admin.credential.applicationDefault();
    admin.initializeApp({
      credential: applicationDefault,
      projectId: projectIdFallback,
    });
    this.logger.log(
      "✅ Firebase Admin SDK initialized with application default credentials"
    );
  }

  async sendPushNotification(
    userId: number,
    title: string,
    body: string,
    data?: any
  ): Promise<boolean> {
    try {
      this.logger.log(
        `📤 [FCM] Attempting to send notification to user ${userId}`
      );
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
        this.logger.warn(
          `⚠️ [FCM] No FCM token found for user ${userId} (${user.name})`
        );
        this.logger.warn(
          `   User needs to log in and grant notification permissions`
        );
        return false;
      }

      this.logger.log(
        `✅ [FCM] Found FCM token for user ${userId}: ${user.fcmToken.substring(0, 30)}...`
      );

      // Firebase data field only accepts string values
      // Convert all data values to strings
      const dataStringified: Record<string, string> = {
        type: (data?.type || "general").toString(),
      };

      // Convert all other data fields to strings
      if (data) {
        Object.keys(data).forEach((key) => {
          if (data[key] !== undefined && data[key] !== null) {
            dataStringified[key] = String(data[key]);
          }
        });
      }

      const message = {
        token: user.fcmToken,
        notification: {
          title,
          body,
        },
        data: dataStringified,
        android: {
          notification: {
            icon: "ic_notification",
            color: "#231F7C",
            sound: "default",
            channelId: "default",
          },
          priority: "high" as const,
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              contentAvailable: true,
            },
          },
          headers: {
            "apns-priority": "10",
          },
        },
      };

      this.logger.log(
        `📤 [FCM] Sending notification via Firebase Admin SDK...`
      );
      const response = await admin.messaging().send(message);
      this.logger.log(
        `✅ [FCM] Push notification sent successfully to user ${userId}`
      );
      this.logger.log(`   Response: ${response}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `❌ [FCM] Failed to send push notification to user ${userId}:`
      );

      // More detailed error logging
      if (error.code) {
        this.logger.error(`   Error code: ${error.code}`);
      }
      if (error.message) {
        this.logger.error(`   Error message: ${error.message}`);
      }

      // Handle specific Firebase errors
      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        this.logger.error(
          `   ⚠️ FCM token is invalid or expired. User needs to log in again.`
        );
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
    data?: any
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
      `Bulk notification results: ${success} success, ${failed} failed`
    );
    return { success, failed };
  }

  async updateUserFCMToken(
    userId: number,
    fcmToken: string
  ): Promise<{ success: boolean }> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcmToken },
      });
      this.logger.log(`✅ FCM token updated for user ${userId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `❌ Failed to update FCM token for user ${userId}:`,
        error
      );
      throw error;
    }
  }
}
