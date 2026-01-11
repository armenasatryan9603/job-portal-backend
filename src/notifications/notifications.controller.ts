import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const userId = req.user.userId;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.notificationsService.getUserNotifications(
      userId,
      pageNum,
      limitNum
    );
  }

  @Get("unread-count")
  async getUnreadCount(@Request() req) {
    const userId = req.user.userId;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  @Post(":id/read")
  async markAsRead(@Request() req, @Param("id") id: string) {
    const userId = req.user.userId;
    const notificationId = parseInt(id, 10);
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Post("mark-all-read")
  async markAllAsRead(@Request() req) {
    const userId = req.user.userId;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete("clear-all")
  async clearAllNotifications(@Request() req) {
    try {
      const userId = req.user.userId;
      if (!userId) {
        throw new Error("User ID not found in request");
      }
      const result =
        await this.notificationsService.clearAllNotifications(userId);
      return result;
    } catch (error) {
      console.error("Error in clearAllNotifications controller:", error);
      throw error;
    }
  }

  @Delete(":id")
  async deleteNotification(@Request() req, @Param("id") id: string) {
    const userId = req.user.userId;
    const notificationId = parseInt(id, 10);
    return this.notificationsService.deleteNotification(userId, notificationId);
  }

  @Post("fcm-token")
  async updateFCMToken(@Request() req, @Body() body: { fcmToken: string }) {
    const userId = req.user.userId;
    return this.notificationsService.updateUserFCMToken(userId, body.fcmToken);
  }
}
