import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { FirebaseNotificationService } from '../notifications/firebase-notification.service';
import { EmailNotificationService } from '../notifications/email-notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    private chatService: ChatService,
    private firebaseNotificationService: FirebaseNotificationService,
    private emailNotificationService: EmailNotificationService,
  ) {}

  async getUsers(page: number = 1, limit: number = 10, search?: string, role?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
          bio: true,
          creditBalance: true,
          verified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        creditBalance: true,
        verified: true,
        createdAt: true,
        experienceYears: true,
        priceMin: true,
        priceMax: true,
        location: true,
        currency: true,
        rateUnit: true,
        languages: true,
        preferences: true,
        _count: {
          select: {
            Orders: true,
            Proposals: true,
            Reviews: true,
            Notifications: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateUser(id: number, updateData: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.usersService.update(id, updateData);
  }

  async sendNotification(userId: number, dto: SendNotificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Create notification directly in database
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: dto.type || 'admin',
        title: dto.title,
        message: dto.message,
        data: {
          source: 'admin',
        },
      },
    });

    // Send push notification if user has FCM token
    if (user.fcmToken) {
      try {
        await this.firebaseNotificationService.sendPushNotification(
          userId,
          dto.title,
          dto.message,
          { type: dto.type || 'admin' },
        );
      } catch (error) {
        console.error('Failed to send push notification:', error);
        // Don't fail the request if push fails
      }
    }

    // Send email notification
    try {
      await this.emailNotificationService.sendEmailNotification(
        userId,
        dto.title,
        this.createEmailHtmlBody(dto.title, dto.message),
        dto.message,
      );
    } catch (error) {
      console.error('Failed to send email notification:', error);
      // Don't fail the request if email fails
    }

    return notification;
  }

  private createEmailHtmlBody(title: string, message: string): string {
    const appName = process.env.APP_NAME || 'Job Portal';
    const appUrl = process.env.APP_URL || 'https://example.com';

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

  async sendMessage(adminUserId: number, userId: number, dto: SendMessageDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if conversation already exists between admin and user
    // Find conversations where both admin and user are participants
    const existingConversations = await this.prisma.conversation.findMany({
      where: {
        Participants: {
          some: {
            userId: adminUserId,
            isActive: true,
          },
        },
      },
      include: {
        Participants: {
          where: {
            isActive: true,
          },
        },
      },
    });

    // Find conversation that has both admin and target user as participants
    let conversation = existingConversations.find(
      (conv) =>
        conv.Participants.some((p) => p.userId === adminUserId) &&
        conv.Participants.some((p) => p.userId === userId) &&
        conv.Participants.length === 2,
    );

    // If no conversation exists, create one
    if (!conversation) {
      conversation = await this.chatService.createConversation(adminUserId, {
        participantIds: [userId],
        title: 'Admin Message',
      });
    }

    // Send the message
    return this.chatService.sendMessage(adminUserId, {
      conversationId: conversation.id,
      content: dto.content,
      messageType: 'text',
    });
  }

  async getStats() {
    const [
      totalUsers,
      verifiedUsers,
      totalOrders,
      activeOrders,
      totalProposals,
      totalNotifications,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { verified: true } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'open' } }),
      this.prisma.orderProposal.count(),
      this.prisma.notification.count(),
    ]);

    // Get users by role
    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      _count: {
        id: true,
      },
    });

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    return {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        recent: recentUsers,
        byRole: usersByRole.reduce(
          (acc, item) => {
            acc[item.role] = item._count.id;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      orders: {
        total: totalOrders,
        active: activeOrders,
      },
      proposals: {
        total: totalProposals,
      },
      notifications: {
        total: totalNotifications,
      },
    };
  }
}
