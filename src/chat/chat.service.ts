import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { FirebaseNotificationService } from '../notifications/firebase-notification.service';

export interface GetMessagesDto {
  conversationId: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private firebaseNotificationService: FirebaseNotificationService,
  ) {}

  /**
   * Create a new conversation
   */
  async createConversation(userId: number, dto: CreateConversationDto) {
    const { orderId, title, participantIds } = dto;

    // Ensure the current user is included in participants
    const allParticipants = [...new Set([userId, ...participantIds])];

    return this.prisma.$transaction(async (tx) => {
      // Check if conversation already exists for this order
      if (orderId) {
        const existingConversation = await tx.conversation.findFirst({
          where: { orderId },
        });

        if (existingConversation) {
          // Check if current user is already a participant
          const existingParticipant =
            await tx.conversationParticipant.findFirst({
              where: {
                conversationId: existingConversation.id,
                userId: userId,
              },
            });

          if (!existingParticipant) {
            await tx.conversationParticipant.create({
              data: {
                conversationId: existingConversation.id,
                userId: userId,
              },
            });
          }

          return this.getConversationById(existingConversation.id);
        }
      }

      // Create conversation
      const conversation = await tx.conversation.create({
        data: {
          orderId,
          title,
        },
      });

      // Add participants
      await tx.conversationParticipant.createMany({
        data: allParticipants.map((participantId) => ({
          conversationId: conversation.id,
          userId: participantId,
        })),
      });

      // Return conversation with participants
      return this.getConversationById(conversation.id);
    });
  }

  /**
   * Get conversation by ID with participants and last message
   */
  async getConversationById(conversationId: number) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orderId: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        Participants: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        Order: {
          select: {
            id: true,
            title: true,
            status: true,
            clientId: true,
          },
        },
      },
    });
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const conversations = await this.prisma.conversation.findMany({
      where: {
        Participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        orderId: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        Participants: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        Messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            Sender: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        Order: {
          select: {
            id: true,
            title: true,
            status: true,
            clientId: true,
          },
        },
        _count: {
          select: {
            Messages: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.conversation.count({
      where: {
        Participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
    });

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: number,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: {
        Sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.message.count({
      where: { conversationId },
    });

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Send a message
   */
  async sendMessage(userId: number, dto: SendMessageDto) {
    const { conversationId, content, messageType = 'text', metadata } = dto;

    // Verify user is participant in conversation
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
    });

    if (!participant) {
      throw new Error('User is not a participant in this conversation');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        messageType,
        metadata,
      },
      include: {
        Sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update conversation's updatedAt timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Send push notifications to other participants
    await this.sendMessageNotifications(conversationId, message, userId);

    return message;
  }

  /**
   * Send push notifications to conversation participants
   */
  private async sendMessageNotifications(
    conversationId: number,
    message: any,
    senderId: number,
  ) {
    try {
      // Get all participants except the sender
      const participants = await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { not: senderId },
          isActive: true,
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              fcmToken: true,
            },
          },
        },
      });

      // Send push notification to each participant
      for (const participant of participants) {
        if (participant.User.fcmToken) {
          await this.firebaseNotificationService.sendPushNotification(
            participant.User.id,
            `New message from ${message.Sender.name}`,
            message.content.length > 100
              ? `${message.content.substring(0, 100)}...`
              : message.content,
            {
              type: 'chat_message',
              conversationId: conversationId.toString(),
              messageId: message.id.toString(),
              senderId: senderId.toString(),
            },
          );
        }
      }
    } catch (error) {
      console.error('Error sending message notifications:', error);
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(userId: number, conversationId: number) {
    return this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
      data: {
        lastReadAt: new Date(),
      },
    });
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId: number) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        Participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
      include: {
        Participants: {
          where: { userId, isActive: true },
        },
        Messages: {
          where: {
            senderId: { not: userId },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let unreadCount = 0;

    for (const conversation of conversations) {
      const participant = conversation.Participants[0];
      const lastMessage = conversation.Messages[0];

      if (lastMessage && participant.lastReadAt) {
        if (lastMessage.createdAt > participant.lastReadAt) {
          unreadCount++;
        }
      } else if (lastMessage && !participant.lastReadAt) {
        unreadCount++;
      }
    }

    return unreadCount;
  }

  /**
   * Create conversation for order (between client and specialist)
   */
  async createOrderConversation(orderId: number, specialistId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { Client: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if conversation already exists
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        orderId,
        Participants: {
          some: { userId: specialistId, isActive: true },
        },
      },
    });

    if (existingConversation) {
      return this.getConversationById(existingConversation.id);
    }

    // Create new conversation
    return this.createConversation(specialistId, {
      orderId,
      title: `Order: ${order.title || 'Untitled'}`,
      participantIds: [order.clientId],
    });
  }

  /**
   * Get conversation participants (excluding current user)
   */
  async getConversationParticipants(
    conversationId: number,
    currentUserId: number,
  ) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        isActive: true,
        userId: { not: currentUserId },
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    return participants.map((p) => p.User);
  }

  /**
   * Leave a conversation (soft delete participant)
   */
  async leaveConversation(conversationId: number, userId: number) {
    return this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Reject application and refund credit
   */
  async rejectApplication(orderId: number, clientId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Verify the client owns this order
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          clientId: clientId,
        },
        include: {
          Proposals: {
            where: {
              status: 'pending',
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found or you are not the owner');
      }

      // Get all pending proposals for this order
      const pendingProposals = order.Proposals;

      // Refund credits to all applicants
      for (const proposal of pendingProposals) {
        await tx.user.update({
          where: { id: proposal.userId },
          data: {
            creditBalance: {
              increment: 1, // Refund 1 credit
            },
          },
        });

        // Update proposal status to rejected
        await tx.orderProposal.update({
          where: { id: proposal.id },
          data: { status: 'rejected' },
        });
      }

      // Update order status to closed
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'closed' },
      });

      // Close all conversations related to this order
      await tx.conversation.updateMany({
        where: { orderId: orderId },
        data: {
          status: 'closed',
          updatedAt: new Date(),
        },
      });

      return {
        message: 'Application rejected and credits refunded',
        refundedCredits: pendingProposals.length,
      };
    });
  }

  /**
   * Choose application
   */
  async chooseApplication(orderId: number, clientId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Verify the client owns this order
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          clientId: clientId,
        },
        include: {
          Proposals: {
            where: {
              status: 'pending',
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found or you are not the owner');
      }

      if (order.Proposals.length === 0) {
        throw new Error('No pending proposals found');
      }

      // For now, we'll choose the first proposal
      // TODO: Allow client to specify which proposal to choose
      const chosenProposal = order.Proposals[0];

      // Update the chosen proposal to accepted
      await tx.orderProposal.update({
        where: { id: chosenProposal.id },
        data: { status: 'accepted' },
      });

      // Reject all other proposals and refund their credits
      const otherProposals = order.Proposals.filter(
        (p) => p.id !== chosenProposal.id,
      );

      for (const proposal of otherProposals) {
        await tx.user.update({
          where: { id: proposal.userId },
          data: {
            creditBalance: {
              increment: 1, // Refund 1 credit
            },
          },
        });

        await tx.orderProposal.update({
          where: { id: proposal.id },
          data: { status: 'rejected' },
        });
      }

      // Update order status to completed
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'completed' },
      });

      // Close all conversations related to this order
      await tx.conversation.updateMany({
        where: { orderId: orderId },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        },
      });

      return {
        message: 'Application chosen successfully and order completed',
        chosenProposalId: chosenProposal.id,
        refundedCredits: otherProposals.length,
      };
    });
  }

  /**
   * Cancel chosen application and reopen order
   */
  async cancelApplication(orderId: number, clientId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Verify the client owns this order
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          clientId: clientId,
        },
        include: {
          Proposals: {
            where: {
              status: 'accepted',
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found or you are not the owner');
      }

      if (order.Proposals.length === 0) {
        throw new Error('No accepted proposal found');
      }

      // Mark the accepted proposal as canceled
      await tx.orderProposal.updateMany({
        where: {
          orderId: orderId,
          status: 'accepted',
        },
        data: { status: 'canceled' },
      });

      // Update order status back to open
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'open' },
      });

      // Close all conversations related to this order
      await tx.conversation.updateMany({
        where: { orderId: orderId },
        data: {
          status: 'closed',
          updatedAt: new Date(),
        },
      });

      return {
        message:
          'Application canceled, order reopened, and conversation closed',
      };
    });
  }

  /**
   * Complete order and close conversation
   */
  async completeOrder(orderId: number, clientId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Verify the client owns this order
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          clientId: clientId,
        },
      });

      if (!order) {
        throw new Error('Order not found or you are not the owner');
      }

      // Update order status to completed
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'completed' },
      });

      // Close all conversations related to this order
      await tx.conversation.updateMany({
        where: { orderId: orderId },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        },
      });

      return {
        message: 'Order completed successfully',
      };
    });
  }
}
