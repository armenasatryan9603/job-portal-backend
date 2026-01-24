import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { UserCleanupService } from '../users/user-cleanup.service';
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
    private userCleanupService: UserCleanupService,
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
          deletedAt: true,
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
        deletedAt: true,
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

    // Use createNotificationWithPush to ensure notificationId is included in push data
    // This will create the notification in the database AND send push/email notifications
    // with the correct notificationId for deep linking
    const notification = await this.notificationsService.createNotificationWithPush(
      userId,
      dto.type || 'admin',
      dto.title, // Use title as-is (not a translation key)
      dto.message, // Use message as-is (not a translation key)
      {
        source: 'admin',
      },
      {}, // No placeholders needed since we're using raw title/message
    );

    return notification;
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

  async hardDeleteUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.deletedAt) {
      throw new BadRequestException(
        `User with ID ${id} is not soft-deleted. Please soft-delete the user first before permanently deleting.`,
      );
    }

    return this.userCleanupService.hardDeleteUser(id);
  }
}
