import { Injectable, OnModuleInit } from "@nestjs/common";
import Pusher from "pusher";

@Injectable()
export class PusherService implements OnModuleInit {
  private pusher: Pusher;

  constructor() {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER || "us2";

    if (appId && key && secret) {
      this.pusher = new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
      });
    }
  }

  onModuleInit() {
    if (!this.pusher) {
      console.warn(
        "⚠️  Pusher not configured. Real-time features will be disabled."
      );
    } else {
      console.log("✅ Pusher initialized successfully");
    }
  }

  /**
   * Trigger an event to a specific channel
   */
  trigger(channel: string, event: string, data: any) {
    if (!this.pusher) {
      console.warn("Pusher not initialized, skipping trigger");
      return Promise.resolve();
    }

    return this.pusher.trigger(channel, event, data).catch((error) => {
      console.error("Error triggering Pusher event:", error);
    });
  }

  /**
   * Get Pusher instance (for advanced usage)
   */
  getPusher() {
    return this.pusher;
  }

  /**
   * Authenticate private channel subscription
   */
  authenticate(socketId: string, channel: string, userId: number) {
    if (!this.pusher) {
      throw new Error("Pusher not initialized");
    }

    // For private channels, you can add user info
    const presenceData = {
      user_id: userId.toString(),
      user_info: {
        id: userId,
      },
    };

    return this.pusher.authorizeChannel(socketId, channel, presenceData);
  }
}
