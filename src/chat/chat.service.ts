import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { FirebaseNotificationService } from "../notifications/firebase-notification.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderPricingService } from "../order-pricing/order-pricing.service";
import { PusherService } from "./pusher.service";
import { CreditTransactionsService } from "../credit/credit-transactions.service";

export interface GetMessagesDto {
  conversationId: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private firebaseNotificationService: FirebaseNotificationService,
    private notificationsService: NotificationsService,
    private orderPricingService: OrderPricingService,
    private pusherService: PusherService,
    private creditTransactionsService: CreditTransactionsService
  ) {}

  /**
   * Helper method to log order changes
   */
  private async logOrderChange(
    orderId: number,
    fieldChanged: string,
    oldValue: string | null,
    newValue: string | null,
    changedBy: number,
    reason?: string,
    tx?: any
  ) {
    try {
      const prismaClient = tx || this.prisma;
      await prismaClient.orderChangeHistory.create({
        data: {
          orderId,
          fieldChanged,
          oldValue: oldValue || null,
          newValue: newValue || null,
          changedBy,
          reason: reason || null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log order change for order ${orderId}:`,
        error
      );
      // Don't throw error - change logging is non-critical
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(userId: number, dto: CreateConversationDto) {
    const { orderId, title, participantIds } = dto;

    // Ensure the current user is included in participants
    const allParticipants = [...new Set([userId, ...participantIds])];

    console.log("Creating conversation with participants:", {
      userId,
      participantIds,
      allParticipants,
      orderId,
      title,
    });

    // For order conversations, ensure we have at least 2 participants (client and specialist)
    // Group applications (with peers/team members) can have more than 2 participants
    if (orderId && allParticipants.length < 2) {
      throw new Error(
        "Order conversations must have at least 2 participants: client and specialist"
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check if conversation already exists for this order AND these specific participants
        if (orderId) {
          // Find conversations for this order that have the exact same participants
          const existingConversations = await tx.conversation.findMany({
            where: { orderId },
            include: {
              Participants: {
                where: { isActive: true },
              },
            },
          });

          // Check if any existing conversation has exactly the same participants
          for (const existingConversation of existingConversations) {
            const existingParticipantIds =
              existingConversation.Participants.map((p) => p.userId).sort();
            const expectedParticipantIds = [...allParticipants].sort();

            // Check if participants match exactly
            if (
              existingParticipantIds.length === expectedParticipantIds.length &&
              existingParticipantIds.every(
                (id, index) => id === expectedParticipantIds[index]
              )
            ) {
              console.log(
                `Found existing conversation ${existingConversation.id} for orderId ${orderId} with matching participants`
              );
              return this.getConversationById(existingConversation.id, tx);
            }
          }

          // If we found conversations but none match, log a warning
          if (existingConversations.length > 0) {
            console.log(
              `Found ${existingConversations.length} conversation(s) for orderId ${orderId}, but none match the expected participants. Creating new conversation.`
            );
          }
        }

        // Create conversation
        console.log("Creating new conversation...");
        const conversation = await tx.conversation.create({
          data: {
            orderId,
            title,
            status: "active",
          },
        });
        console.log(`✅ Created conversation ${conversation.id}`);

        // Add participants one by one to get better error messages
        console.log(
          `Adding ${allParticipants.length} participants to conversation ${conversation.id}`
        );
        for (const participantId of allParticipants) {
          try {
            await tx.conversationParticipant.create({
              data: {
                conversationId: conversation.id,
                userId: participantId,
                isActive: true,
              },
            });
            console.log(
              `✅ Added participant ${participantId} to conversation ${conversation.id}`
            );
          } catch (error: any) {
            // If it's a unique constraint error, participant already exists (shouldn't happen for new conversation)
            if (error?.code === "P2002") {
              console.warn(
                `Participant ${participantId} already exists in conversation ${conversation.id}`
              );
            } else {
              console.error(
                `❌ Failed to add participant ${participantId} to conversation ${conversation.id}:`,
                error
              );
              throw error; // Re-throw to rollback transaction
            }
          }
        }

        console.log(
          `✅ Successfully created conversation ${conversation.id} with ${allParticipants.length} participants`
        );

        // Return conversation with participants (use transaction client)
        return this.getConversationById(conversation.id, tx);
      });
    } catch (error) {
      console.error("❌ Error creating conversation:", error);
      throw error;
    }
  }

  /**
   * Get conversation by ID with participants and last message
   * @param conversationId - The ID of the conversation to retrieve
   * @param tx - Optional transaction client (use when called from within a transaction)
   */
  async getConversationById(
    conversationId: number,
    tx?: any // Transaction client from Prisma
  ) {
    // Use transaction client if provided, otherwise use regular prisma client
    const prismaClient = tx || this.prisma;

    const conversation = await prismaClient.conversation.findUnique({
      where: { id: conversationId },
      include: {
        Participants: {
          where: {
            isActive: true, // Only include active participants
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

    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    console.log(
      `Retrieved conversation ${conversationId} with ${conversation.Participants.length} active participants`
    );

    return {
      id: conversation.id,
      orderId: conversation.orderId,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      Participants: conversation.Participants,
      Order: conversation.Order,
    };
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(
    userId: number,
    page: number = 1,
    limit: number = 20
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
        status: {
          not: "removed",
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
          orderBy: { createdAt: "desc" },
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
      orderBy: { updatedAt: "desc" },
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
    limit: number = 50
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
      orderBy: { createdAt: "asc" },
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
    const { conversationId, content, messageType = "text", metadata } = dto;

    // Verify conversation exists and is not removed
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
      },
      include: {
        Order: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.status === "removed") {
      throw new Error("Cannot send messages in a deleted conversation");
    }

    // Verify user is participant in conversation
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
    });

    if (!participant) {
      throw new Error("User is not a participant in this conversation");
    }

    // Validate message content - prevent phone numbers only when order is "open"
    // Once order is "in_progress" (candidate chosen), phone numbers are allowed
    if (
      messageType === "text" &&
      content &&
      conversation.Order?.status === "open"
    ) {
      const containsPhoneNumber = (text: string): boolean => {
        // More comprehensive phone number detection
        // Handles various formats including:
        // - International: +374 77 7539543, +1-234-567-8900
        // - Local formats: 094122345, 093 10 19 43, 094 40-60 - 71 10
        // - With multiple spaces: 033      50 6070
        // - With quotes: "000777659-67"

        const phonePatterns = [
          // International format: +374 77 7539543, +1 234 567 8900
          /\+\d{1,4}[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,9}/g,
          // Local formats with spaces/dashes: 094 40-60 - 71 10, 093 10 19 43
          /0\d{1,2}[\s\-\.]+[\d\s\-\.]{5,}/g,
          // Formats with parentheses: (123) 456-7890
          /\(\d{1,4}\)[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,9}/g,
          // Sequences of digits with separators: 055906940, "000777659-67"
          /["']?\d{2,}[\s\-\.]?\d{1,}[\s\-\.]?\d{1,}["']?/g,
          // Consecutive digits (7+): 1234567890
          /\d{7,}/g,
        ];

        // Check if any pattern matches
        for (const pattern of phonePatterns) {
          const matches = text.match(pattern);
          if (matches) {
            for (const match of matches) {
              // Remove all non-digit characters to get pure number
              const digitsOnly = match.replace(/\D/g, "");

              // Check if it's a valid phone number length (7-15 digits)
              if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
                const num = parseInt(digitsOnly);

                // Filter out false positives:
                // - Years (1900-2099)
                // - Very small numbers that are likely not phones
                // - Numbers that are too short even after cleaning
                if (
                  !(num >= 1900 && num <= 2099) &&
                  digitsOnly.length >= 7 &&
                  // Additional check: if it starts with 0 and has 7+ digits, likely a phone
                  (match.trim().startsWith("0") ||
                    match.trim().startsWith("+") ||
                    digitsOnly.length >= 8)
                ) {
                  return true;
                }
              }
            }
          }
        }

        // Additional check: look for sequences of digits separated by spaces/dashes
        // that when combined form a phone number (7-15 digits)
        const flexiblePattern = /[\d\s\-\.\(\)\+]{7,}/g;
        const flexibleMatches = text.match(flexiblePattern);
        if (flexibleMatches) {
          for (const match of flexibleMatches) {
            const digitsOnly = match.replace(/\D/g, "");
            if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
              const num = parseInt(digitsOnly);
              // Check if it looks like a phone number (not a year, not too small)
              if (
                !(num >= 1900 && num <= 2099) &&
                digitsOnly.length >= 7 &&
                // Must have some separators or be 8+ digits to avoid false positives
                (match.match(/[\s\-\.]/) || digitsOnly.length >= 8)
              ) {
                return true;
              }
            }
          }
        }

        return false;
      };

      if (containsPhoneNumber(content)) {
        throw new Error(
          "Phone numbers cannot be shared until a candidate is chosen. Please wait until the order is accepted."
        );
      }
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

    // Emit real-time event via Pusher
    try {
      // Emit to conversation channel
      await this.pusherService.trigger(
        `conversation-${conversationId}`,
        "new-message",
        message
      );

      // Also update conversation list for all participants
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId, isActive: true },
        select: { userId: true },
      });

      // Emit conversation update to each participant
      for (const participant of participants) {
        await this.pusherService.trigger(
          `user-${participant.userId}`,
          "conversation-updated",
          {
            conversationId,
            lastMessage: message,
            updatedAt: new Date().toISOString(),
          }
        );
      }
    } catch (error) {
      console.error("Error emitting Pusher event:", error);
      // Don't fail the request if Pusher fails
    }

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
    senderId: number
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
          await this.notificationsService.createNotificationWithPush(
            participant.User.id,
            "chat_message",
            "notificationChatMessageTitle",
            message.content.length > 100
              ? `${message.content.substring(0, 100)}...`
              : message.content,
            {
              type: "chat_message",
              conversationId: conversationId.toString(),
              messageId: message.id.toString(),
              senderId: senderId.toString(),
            },
            {
              senderName: message.Sender.name,
            }
          );
        }
      }
    } catch (error) {
      console.error("Error sending message notifications:", error);
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
   * Delete a conversation (mark as removed) - only if closed
   */
  async deleteConversation(userId: number, conversationId: number) {
    // Verify the conversation exists and user is a participant
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        Participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new Error(
        "Conversation not found or you are not authorized to delete it"
      );
    }

    // Check if conversation is closed
    if (
      conversation.status !== "closed" &&
      conversation.status !== "completed"
    ) {
      throw new Error("Conversations can only be deleted if they are closed");
    }

    // Mark conversation as removed (don't delete from DB)
    const updatedConversation = await this.prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        status: "removed",
      },
    });

    // Emit Pusher event to notify all participants
    try {
      // Get all participants
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId, isActive: true },
        select: { userId: true },
      });

      // Emit to conversation channel
      await this.pusherService.trigger(
        `conversation-${conversationId}`,
        "conversation-deleted",
        {
          conversationId: conversationId,
          deletedBy: userId,
        }
      );

      // Emit to each participant's user channel
      for (const participant of participants) {
        await this.pusherService.trigger(
          `user-${participant.userId}`,
          "conversation-deleted",
          {
            conversationId: conversationId,
            deletedBy: userId,
          }
        );
      }
    } catch (error) {
      console.error("Error emitting Pusher event:", error);
      // Don't fail the request if Pusher fails
    }

    return updatedConversation;
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
          orderBy: { createdAt: "desc" },
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
   * Create conversation for order (between client and specialist, optionally with peers)
   */
  async createOrderConversation(
    orderId: number,
    specialistId: number,
    proposalId?: number
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { Client: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Check if conversation already exists for this order and specialist
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        orderId,
        Participants: {
          some: { userId: specialistId, isActive: true },
        },
      },
      include: {
        Participants: {
          where: { isActive: true },
        },
        Messages: {
          where: {
            senderId: specialistId,
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
        },
      },
    });

    // Verify existing conversation has client and specialist (and optionally peers)
    if (existingConversation) {
      const activeParticipants = existingConversation.Participants.filter(
        (p) => p.isActive
      );

      // For group applications, we may have more than 2 participants
      const hasClient = activeParticipants.some(
        (p) => p.userId === order.clientId
      );
      const hasSpecialist = activeParticipants.some(
        (p) => p.userId === specialistId
      );

      if (!hasClient || !hasSpecialist) {
        console.warn(
          `Existing conversation ${existingConversation.id} doesn't have both client and specialist. Creating new conversation.`
        );
        // Don't use this conversation, create a new one instead
      } else {
        // If proposalId is provided, check if peers or team members need to be added
        if (proposalId) {
          const proposal = (await this.prisma.orderProposal.findUnique({
            where: { id: proposalId },
            include: {
              ProposalPeers: {
                where: {
                  status: { not: "rejected" },
                },
              },
              Team: {
                select: {
                  id: true,
                  name: true,
                  Members: {
                    where: {
                      status: "accepted",
                      isActive: true,
                    },
                    select: {
                      userId: true,
                    },
                  },
                },
              },
            },
          })) as any;

          if (proposal) {
            let peerIds: number[] = [];

            if (proposal.isGroupApplication) {
              peerIds = proposal.ProposalPeers.map((pp: any) => pp.userId);
            }

            // If team is associated, add all accepted team members
            if (proposal.teamId && proposal.Team) {
              const teamMemberIds = proposal.Team.Members.map(
                (m: any) => m.userId
              );
              // Merge with existing peerIds, avoiding duplicates
              peerIds = [...new Set([...peerIds, ...teamMemberIds])];
            }

            const missingPeers = peerIds.filter(
              (peerId) => !activeParticipants.some((p) => p.userId === peerId)
            );

            // Add missing peers/team members to conversation
            if (missingPeers.length > 0) {
              await this.prisma.conversationParticipant.createMany({
                data: missingPeers.map((peerId) => ({
                  conversationId: existingConversation.id,
                  userId: peerId,
                  isActive: true,
                })),
                skipDuplicates: true,
              });
            }

            // Update conversation title if team is associated
            if (proposal.teamId && proposal.Team) {
              const teamName = proposal.Team.name;
              const newTitle = `${teamName} & ${order.Client.name}`;

              // Update title if it's different
              if (existingConversation.title !== newTitle) {
                await this.prisma.conversation.update({
                  where: { id: existingConversation.id },
                  data: {
                    title: newTitle,
                  },
                });
                existingConversation.title = newTitle;
              }
            }
          }
        }

        // Reopen conversation if it's closed (e.g., after rejection)
        if (
          existingConversation.status === "closed" ||
          existingConversation.status === "completed"
        ) {
          console.log(
            `Reopening closed conversation ${existingConversation.id} for order ${orderId}`
          );
          await this.prisma.conversation.update({
            where: { id: existingConversation.id },
            data: {
              status: "active",
              updatedAt: new Date(),
            },
          });
          existingConversation.status = "active";
        }

        // Check if proposal message was already sent (first message from specialist)
        const hasProposalMessage = existingConversation.Messages.length > 0;

        // If no messages from specialist yet, send the proposal message
        if (!hasProposalMessage) {
          try {
            const proposal = await this.prisma.orderProposal.findFirst({
              where: {
                orderId: orderId,
                userId: specialistId,
              },
              orderBy: {
                createdAt: "desc",
              },
            });

            if (proposal && proposal.message && proposal.message.trim()) {
              // Retry logic to handle timing issues
              let messageSent = false;
              let retries = 3;
              let delay = 500;

              while (!messageSent && retries > 0) {
                try {
                  // Wait a bit before retrying (except first attempt)
                  if (retries < 3) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    delay *= 2;
                  }

                  const sentMessage = await this.sendMessage(specialistId, {
                    conversationId: existingConversation.id,
                    content: proposal.message,
                    messageType: "text",
                  });
                  console.log(
                    `✅ Sent proposal message to existing conversation ${existingConversation.id}. Message ID: ${sentMessage.id}`
                  );
                  messageSent = true;
                } catch (messageError: any) {
                  console.error(
                    `Failed to send proposal message to existing conversation (attempt ${4 - retries}/3):`,
                    messageError?.message || messageError
                  );

                  // If it's a participant error, retry
                  if (
                    messageError?.message?.includes("not a participant") ||
                    messageError?.message?.includes("participant")
                  ) {
                    retries--;
                    if (retries === 0) {
                      console.error(
                        "Failed to send proposal message after all retries"
                      );
                    }
                  } else {
                    // For other errors, don't retry
                    retries = 0;
                  }
                }
              }
            } else {
              console.log(
                `No proposal message found for orderId ${orderId} and specialistId ${specialistId}`
              );
            }
          } catch (error) {
            console.error(
              "Error fetching or sending proposal message to existing conversation:",
              error
            );
          }
        }

        return this.getConversationById(existingConversation.id);
      }
    }

    // Get proposal to check for peers and team
    let peerIds: number[] = [];
    let teamName: string | null = null;
    let teamId: number | null = null;
    if (proposalId) {
      const proposal = (await this.prisma.orderProposal.findUnique({
        where: { id: proposalId },
        include: {
          ProposalPeers: {
            where: {
              status: { not: "rejected" },
            },
            include: {
              User: {
                select: {
                  id: true,
                },
              },
            },
          },
          Team: {
            select: {
              id: true,
              name: true,
              Members: {
                where: {
                  status: "accepted",
                  isActive: true,
                },
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      })) as any;

      if (proposal) {
        if (proposal.isGroupApplication) {
          peerIds = proposal.ProposalPeers.map((pp: any) => pp.userId);
        }

        // If team is associated with proposal, get team name and all accepted team members
        if (proposal.teamId && proposal.Team) {
          teamId = proposal.teamId;
          teamName = proposal.Team.name;
          // Add all accepted team members to peerIds (they will be added to chat)
          const teamMemberIds = proposal.Team.Members.map((m: any) => m.userId);
          // Merge with existing peerIds, avoiding duplicates
          const allTeamMemberIds = [...new Set([...peerIds, ...teamMemberIds])];
          peerIds = allTeamMemberIds;
        }
      }
    }

    // Create new conversation with client, lead specialist, and all peers/team members
    const allParticipantIds = [order.clientId, specialistId, ...peerIds];
    console.log(
      `Creating conversation for order ${orderId} with specialist ${specialistId}, client ${order.clientId}, and ${peerIds.length} peers/team members`
    );

    // Set conversation title: use team name if team is selected, otherwise use order title
    const conversationTitle = teamName
      ? `${teamName} & ${order.Client.name}`
      : `Order: ${order.title || "Untitled"}`;

    const conversation = await this.createConversation(specialistId, {
      orderId,
      title: conversationTitle,
      participantIds: allParticipantIds,
    });

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    console.log(
      `✅ Conversation ${conversation.id} created successfully. Fetching proposal message...`
    );

    // Verify participants were created
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: conversation.id,
        isActive: true,
      },
    });
    console.log(
      `Verified: Conversation ${conversation.id} has ${participants.length} active participants:`,
      participants.map((p) => ({ userId: p.userId, isActive: p.isActive }))
    );

    // Fetch the proposal message and send it as the first message in the conversation
    try {
      const proposal = await this.prisma.orderProposal.findFirst({
        where: {
          orderId: orderId,
          userId: specialistId,
        },
        orderBy: {
          createdAt: "desc", // Get most recent proposal
        },
      });

      if (!proposal) {
        console.warn(
          `⚠️ No proposal found for orderId ${orderId} and specialistId ${specialistId}`
        );
        return conversation;
      }

      if (!proposal.message || !proposal.message.trim()) {
        console.warn(
          `⚠️ Proposal ${proposal.id} exists but has no message content`
        );
        return conversation;
      }

      console.log(
        `Found proposal ${proposal.id} with message: "${proposal.message.substring(0, 50)}..."`
      );

      // Add a small delay to ensure participants are fully committed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Retry logic to handle timing issues
      let messageSent = false;
      let retries = 3;
      let delay = 500;

      while (!messageSent && retries > 0) {
        try {
          // Wait a bit before retrying (except first attempt)
          if (retries < 3) {
            console.log(`Retrying message send (attempt ${4 - retries}/3)...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          }

          // Verify participant exists before sending
          const participantCheck =
            await this.prisma.conversationParticipant.findFirst({
              where: {
                conversationId: conversation.id,
                userId: specialistId,
                isActive: true,
              },
            });

          if (!participantCheck) {
            throw new Error(
              `Specialist ${specialistId} is not a participant in conversation ${conversation.id}`
            );
          }

          console.log(
            `Sending proposal message to conversation ${conversation.id}...`
          );

          // Send the proposal message as the first message in the conversation
          const sentMessage = await this.sendMessage(specialistId, {
            conversationId: conversation.id,
            content: proposal.message,
            messageType: "text",
          });

          console.log(
            `✅ Successfully sent proposal message as first message in conversation ${conversation.id}. Message ID: ${sentMessage.id}`
          );
          messageSent = true;
        } catch (messageError: any) {
          console.error(
            `❌ Failed to send proposal message (attempt ${4 - retries}/3):`,
            {
              error: messageError?.message || messageError,
              code: messageError?.code,
              conversationId: conversation.id,
              specialistId: specialistId,
            }
          );

          // If it's a participant error, retry
          if (
            messageError?.message?.includes("not a participant") ||
            messageError?.message?.includes("participant") ||
            messageError?.code === "P2003" // Foreign key constraint
          ) {
            retries--;
            if (retries === 0) {
              console.error(
                `❌ Failed to send proposal message after all retries. Conversation ${conversation.id} was created but message was not sent.`
              );
            }
          } else {
            // For other errors, don't retry
            console.error(
              `❌ Non-retryable error when sending proposal message:`,
              messageError
            );
            retries = 0;
          }
        }
      }
    } catch (error) {
      // Log error but don't fail conversation creation if message sending fails
      console.error("❌ Error fetching or sending proposal message:", error);
    }

    return conversation;
  }

  /**
   * Get conversation participants (excluding current user)
   */
  async getConversationParticipants(
    conversationId: number,
    currentUserId: number
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
   * If rejectPeerIds is provided, only reject those specific peers
   * Otherwise, reject the whole group/proposal
   */
  async rejectApplication(
    orderId: number,
    clientId: number,
    proposalId?: number,
    rejectPeerIds?: number[]
  ) {
    return this.prisma
      .$transaction(async (tx) => {
        // Verify the client owns this order
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            clientId: clientId,
          },
          include: {
            Proposals: {
              where: {
                status: "pending",
              },
            },
          },
        });

        if (!order) {
          throw new Error("Order not found or you are not the owner");
        }

        // Handle individual peer rejection
        if (proposalId && rejectPeerIds && rejectPeerIds.length > 0) {
          // Reject specific peers only
          const proposal = await tx.orderProposal.findUnique({
            where: { id: proposalId },
            include: {
              ProposalPeers: true,
            },
          });

          if (!proposal || proposal.orderId !== orderId) {
            throw new Error(
              "Proposal not found or does not belong to this order"
            );
          }

          // Update rejected peers
          await tx.proposalPeer.updateMany({
            where: {
              proposalId,
              userId: { in: rejectPeerIds },
              status: { not: "rejected" },
            },
            data: {
              status: "rejected",
            },
          });

          // Remove rejected peers from conversation participants
          const conversations = await tx.conversation.findMany({
            where: {
              orderId,
            },
            include: {
              Participants: {
                where: {
                  userId: { in: rejectPeerIds },
                  isActive: true,
                },
              },
            },
          });

          for (const conversation of conversations) {
            if (conversation.Participants.length > 0) {
              await tx.conversationParticipant.updateMany({
                where: {
                  conversationId: conversation.id,
                  userId: { in: rejectPeerIds },
                  isActive: true,
                },
                data: {
                  isActive: false,
                },
              });
            }
          }

          // Check if proposal should remain active (if lead or other peers remain)
          const activePeers = await tx.proposalPeer.findMany({
            where: {
              proposalId,
              status: { not: "rejected" },
            },
          });

          // Send notifications to rejected peers only
          for (const peerId of rejectPeerIds) {
            try {
              await this.notificationsService.createNotificationWithPush(
                peerId,
                "peer_rejected",
                "notificationPeerRejectedTitle",
                "notificationPeerRejectedMessage",
                {
                  type: "peer_rejected",
                  orderId: orderId,
                  proposalId: proposalId,
                },
                {
                  orderTitle: order.title || "the order",
                }
              );
            } catch (error) {
              console.error(
                `Failed to send notification to peer ${peerId}:`,
                error
              );
            }
          }

          return {
            message: "Peers rejected successfully",
            rejectedPeers: rejectPeerIds.length,
            proposalRemainsActive:
              activePeers.length > 0 ||
              (proposal.leadUserId && proposal.userId === proposal.leadUserId),
          };
        }

        // Get all pending proposals for this order (whole group rejection)
        const pendingProposals = order.Proposals;

        // Refund credits to lead applicants only (for group applications)
        for (const proposal of pendingProposals) {
          // Check if this is a team application
          const isTeamApplication = proposal.teamId !== null && proposal.teamId !== undefined;
          
          // Get pricing configuration based on whether it's a team application
          const orderBudget = order.budget || 0;
          const pricingConfig =
            await this.orderPricingService.getPricingConfig(orderBudget, isTeamApplication);
          const creditCost = pricingConfig.creditCost;
          const refundAmount = Math.round(
            creditCost * pricingConfig.refundPercentage
          );

          console.log(
            `Refunding ${refundAmount} credits (${pricingConfig.refundPercentage * 100}% of ${creditCost} credits) for proposal ${proposal.id} (${isTeamApplication ? 'team' : 'individual'})`
          );

          // For group/team applications, refund only to lead applicant
          const refundUserId = proposal.leadUserId || proposal.userId;

          if (refundAmount > 0) {
            const updatedUser = await tx.user.update({
              where: { id: refundUserId },
              data: {
                creditBalance: {
                  increment: refundAmount,
                },
              },
              select: { creditBalance: true },
            });

            // Log credit transaction
            await this.creditTransactionsService.logTransaction({
              userId: refundUserId,
              amount: refundAmount,
              balanceAfter: updatedUser.creditBalance,
              type: "rejection_refund",
              status: "completed",
              description: `Refund for rejected application on order #${orderId}`,
              referenceId: orderId.toString(),
              referenceType: "order",
              metadata: {
                orderId,
                proposalId: proposal.id,
                refundAmount,
                creditCost,
                refundPercentage: pricingConfig.refundPercentage,
                isGroupApplication: proposal.isGroupApplication,
                isTeamApplication,
                teamId: proposal.teamId,
              },
              tx,
            });
          }

          // Update proposal status to rejected
          await tx.orderProposal.update({
            where: { id: proposal.id },
            data: { status: "rejected" },
          });

          // Update all proposal peers to rejected
          if (proposal.isGroupApplication) {
            await tx.proposalPeer.updateMany({
              where: {
                proposalId: proposal.id,
                status: { not: "rejected" },
              },
              data: {
                status: "rejected",
              },
            });
          }
        }

        // Update order status to closed
        await tx.order.update({
          where: { id: orderId },
          data: { status: "closed" },
        });

        // Close all conversations related to this order
        await tx.conversation.updateMany({
          where: { orderId: orderId },
          data: {
            status: "closed",
            updatedAt: new Date(),
          },
        });

        return {
          message: "Application rejected and credits refunded",
          refundedCredits: pendingProposals.length,
        };
      })
      .then(async (result) => {
        // Emit Pusher events after transaction completes
        try {
          // Get order with all participants (client and specialists with proposals)
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              title: true,
              clientId: true,
              Client: { select: { id: true } },
              Proposals: {
                select: { userId: true },
                distinct: ["userId"],
              },
            },
          });

          if (order) {
            const userIds = new Set<number>();
            userIds.add(order.clientId);
            order.Proposals.forEach((p) => userIds.add(p.userId));

            // Emit to order channel
            await this.pusherService.trigger(
              `order-${orderId}`,
              "order-status-updated",
              {
                orderId,
                status: "closed",
                updatedAt: new Date().toISOString(),
              }
            );

            // Emit to each user's channel
            for (const userId of userIds) {
              await this.pusherService.trigger(
                `user-${userId}`,
                "order-status-updated",
                {
                  orderId,
                  status: "closed",
                  updatedAt: new Date().toISOString(),
                }
              );
            }

            // Send notifications to all rejected specialists
            const rejectedProposals = await this.prisma.orderProposal.findMany({
              where: {
                orderId: orderId,
                status: "rejected",
              },
              include: {
                User: {
                  select: { id: true, name: true },
                },
              },
            });

            for (const proposal of rejectedProposals) {
              try {
                await this.notificationsService.createNotificationWithPush(
                  proposal.userId,
                  "proposal_rejected",
                  "notificationProposalRejectedTitle",
                  "notificationProposalRejectedMessage",
                  {
                    type: "proposal_rejected",
                    orderId: orderId,
                    proposalId: proposal.id,
                  },
                  {
                    orderTitle: order.title || "the order",
                  }
                );
              } catch (error) {
                console.error(
                  `Failed to send notification to user ${proposal.userId}:`,
                  error
                );
              }
            }
          }
        } catch (error) {
          console.error("Error emitting Pusher event for order status:", error);
        }

        return result;
      });
  }

  /**
   * Choose application
   */
  async chooseApplication(orderId: number, clientId: number) {
    return this.prisma
      .$transaction(async (tx) => {
        // Verify the client owns this order
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            clientId: clientId,
          },
          include: {
            Proposals: {
              where: {
                status: "pending",
              },
            },
          },
        });

        if (!order) {
          throw new Error("Order not found or you are not the owner");
        }

        if (order.Proposals.length === 0) {
          throw new Error("No pending proposals found");
        }

        // For now, we'll choose the first proposal
        // TODO: Allow client to specify which proposal to choose
        const chosenProposal = order.Proposals[0];

        // Update the chosen proposal to accepted
        await tx.orderProposal.update({
          where: { id: chosenProposal.id },
          data: { status: "accepted" },
        });

        // Reject all other proposals and refund their credits using pricing table
        const otherProposals = order.Proposals.filter(
          (p) => p.id !== chosenProposal.id
        );

        const orderBudget = order.budget || 0;

        for (const proposal of otherProposals) {
          // Check if this is a team application
          const isTeamApplication = proposal.teamId !== null && proposal.teamId !== undefined;
          
          // Get pricing configuration based on whether it's a team application
          const pricingConfig =
            await this.orderPricingService.getPricingConfig(orderBudget, isTeamApplication);
          const creditCost = pricingConfig.creditCost;
          const refundAmount = Math.round(
            creditCost * pricingConfig.refundPercentage
          );

          console.log(
            `Refunding ${refundAmount} credits (${pricingConfig.refundPercentage * 100}% of ${creditCost} credits) for proposal ${proposal.id} (${isTeamApplication ? 'team' : 'individual'})`
          );

          // Only refund to lead applicant for team applications
          const refundUserId = isTeamApplication && proposal.leadUserId
            ? proposal.leadUserId
            : proposal.userId;

          if (refundAmount > 0) {
            await tx.user.update({
              where: { id: refundUserId },
              data: {
                creditBalance: {
                  increment: refundAmount,
                },
              },
            });
          }

          await tx.orderProposal.update({
            where: { id: proposal.id },
            data: { status: "rejected" },
          });
        }

        // Update order status to in_progress (work has started, not completed yet)
        await tx.order.update({
          where: { id: orderId },
          data: { status: "in_progress" },
        });

        // Get the conversation for this order to send system message
        const conversation = await tx.conversation.findFirst({
          where: { orderId },
          include: {
            Participants: {
              where: { isActive: true },
              select: { userId: true },
            },
          },
        });

        // Send system message to notify participants they can now share phone numbers
        let systemMessage: any = null;
        if (conversation) {
          systemMessage = await tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: clientId, // Use client ID as sender for system message
              content: "You can now share contact information with each other.",
              messageType: "system",
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
        }

        // Keep conversations active (don't close them - work is in progress)
        // Conversations remain active so client and specialist can communicate during work

        return {
          message:
            "Application chosen successfully and order is now in progress",
          chosenProposalId: chosenProposal.id,
          refundedCredits: otherProposals.length,
          systemMessage, // Include system message in result
        };
      })
      .then(async (result) => {
        // Emit Pusher events after transaction completes
        try {
          // Get order with all participants (client and specialists with proposals)
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              title: true,
              clientId: true,
              Client: { select: { id: true } },
              Proposals: {
                select: { userId: true },
                distinct: ["userId"],
              },
            },
          });

          if (order) {
            const userIds = new Set<number>();
            userIds.add(order.clientId);
            order.Proposals.forEach((p) => userIds.add(p.userId));

            // Emit to order channel
            await this.pusherService.trigger(
              `order-${orderId}`,
              "order-status-updated",
              {
                orderId,
                status: "in_progress",
                updatedAt: new Date().toISOString(),
              }
            );

            // Emit to each user's channel
            for (const userId of userIds) {
              await this.pusherService.trigger(
                `user-${userId}`,
                "order-status-updated",
                {
                  orderId,
                  status: "in_progress",
                  updatedAt: new Date().toISOString(),
                }
              );
            }

            // Emit system message to conversation channel if it exists
            if (result.systemMessage) {
              const conversation = await this.prisma.conversation.findFirst({
                where: { orderId },
              });

              if (conversation) {
                await this.pusherService.trigger(
                  `conversation-${conversation.id}`,
                  "new-message",
                  result.systemMessage
                );

                // Also update conversation list for all participants
                const participants =
                  await this.prisma.conversationParticipant.findMany({
                    where: { conversationId: conversation.id, isActive: true },
                    select: { userId: true },
                  });

                for (const participant of participants) {
                  await this.pusherService.trigger(
                    `user-${participant.userId}`,
                    "conversation-updated",
                    {
                      conversationId: conversation.id,
                      lastMessage: result.systemMessage,
                      updatedAt: new Date().toISOString(),
                    }
                  );
                }
              }
            }

            // Send notifications
            try {
              // Get conversation for notifications
              const conversationForNotification =
                await this.prisma.conversation.findFirst({
                  where: { orderId },
                  select: { id: true },
                });

              // Get chosen proposal and rejected proposals
              const chosenProposal = await this.prisma.orderProposal.findUnique(
                {
                  where: { id: result.chosenProposalId },
                  include: {
                    User: {
                      select: { id: true, name: true },
                    },
                  },
                }
              );

              const rejectedProposals =
                await this.prisma.orderProposal.findMany({
                  where: {
                    orderId: orderId,
                    status: "rejected",
                  },
                  include: {
                    User: {
                      select: { id: true, name: true },
                    },
                  },
                });

              // Notify chosen specialist
              if (chosenProposal) {
                try {
                  await this.notificationsService.createNotificationWithPush(
                    chosenProposal.userId,
                    "proposal_accepted",
                    "notificationProposalAcceptedTitle",
                    "notificationProposalAcceptedMessage",
                    {
                      type: "proposal_accepted",
                      orderId: orderId,
                      proposalId: chosenProposal.id,
                      conversationId: conversationForNotification?.id,
                    },
                    {
                      orderTitle: order.title || "the order",
                    }
                  );
                } catch (error) {
                  console.error(
                    `Failed to send notification to chosen specialist ${chosenProposal.userId}:`,
                    error
                  );
                }
              }

              // Notify rejected specialists
              for (const proposal of rejectedProposals) {
                try {
                  await this.notificationsService.createNotificationWithPush(
                    proposal.userId,
                    "proposal_rejected",
                    "notificationProposalRejectedTitle",
                    "notificationProposalRejectedMessage",
                    {
                      type: "proposal_rejected",
                      orderId: orderId,
                      proposalId: proposal.id,
                    },
                    {
                      orderTitle: order.title || "the order",
                    }
                  );
                } catch (error) {
                  console.error(
                    `Failed to send notification to rejected specialist ${proposal.userId}:`,
                    error
                  );
                }
              }
            } catch (error) {
              console.error("Error sending notifications:", error);
            }
          }
        } catch (error) {
          console.error("Error emitting Pusher event for order status:", error);
        }

        return result;
      });
  }

  /**
   * Cancel chosen application and reopen order
   */
  async cancelApplication(orderId: number, clientId: number) {
    return this.prisma
      .$transaction(async (tx) => {
        // Verify the client owns this order
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            clientId: clientId,
          },
          include: {
            Proposals: {
              where: {
                status: "accepted",
              },
            },
          },
        });

        if (!order) {
          throw new Error("Order not found or you are not the owner");
        }

        if (order.Proposals.length === 0) {
          throw new Error("No accepted proposal found");
        }

        // Mark the accepted proposal as canceled
        await tx.orderProposal.updateMany({
          where: {
            orderId: orderId,
            status: "accepted",
          },
          data: { status: "canceled" },
        });

        // Update order status to closed to allow feedback submission
        await tx.order.update({
          where: { id: orderId },
          data: { status: "closed" },
        });

        // Get all conversations related to this order before updating
        const conversations = await tx.conversation.findMany({
          where: { orderId: orderId },
          include: {
            Participants: {
              where: { isActive: true },
              select: { userId: true },
            },
          },
        });

        // Close all conversations related to this order
        await tx.conversation.updateMany({
          where: { orderId: orderId },
          data: {
            status: "closed",
            updatedAt: new Date(),
          },
        });

        return {
          message:
            "Application canceled, order closed, and conversation closed",
        };
      })
      .then(async (result) => {
        // Emit Pusher events after transaction completes
        try {
          // Get order with all participants (client and specialists with proposals)
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
              Client: { select: { id: true } },
              Proposals: {
                select: { userId: true },
                distinct: ["userId"],
              },
            },
          });

          if (order) {
            const userIds = new Set<number>();
            userIds.add(order.clientId);
            order.Proposals.forEach((p) => userIds.add(p.userId));

            // Emit to order channel
            await this.pusherService.trigger(
              `order-${orderId}`,
              "order-status-updated",
              {
                orderId,
                status: "closed",
                updatedAt: new Date().toISOString(),
              }
            );

            // Emit to each user's channel
            for (const userId of userIds) {
              await this.pusherService.trigger(
                `user-${userId}`,
                "order-status-updated",
                {
                  orderId,
                  status: "closed",
                  updatedAt: new Date().toISOString(),
                }
              );
            }
          }

          // Also emit conversation status updates
          const conversations = await this.prisma.conversation.findMany({
            where: { orderId: orderId },
            include: {
              Participants: {
                where: { isActive: true },
                select: { userId: true },
              },
            },
          });

          for (const conversation of conversations) {
            // Emit to conversation channel
            await this.pusherService.trigger(
              `conversation-${conversation.id}`,
              "conversation-status-updated",
              {
                conversationId: conversation.id,
                status: "closed",
                updatedAt: new Date().toISOString(),
              }
            );

            // Emit to each participant's user channel
            for (const participant of conversation.Participants) {
              await this.pusherService.trigger(
                `user-${participant.userId}`,
                "conversation-status-updated",
                {
                  conversationId: conversation.id,
                  status: "closed",
                  updatedAt: new Date().toISOString(),
                }
              );
            }
          }
        } catch (error) {
          console.error(
            "Error emitting Pusher event for order/conversation status:",
            error
          );
          // Don't fail the request if Pusher fails
        }

        return result;
      });
  }

  /**
   * Complete order and close conversation
   */
  async completeOrder(orderId: number, clientId: number) {
    return this.prisma
      .$transaction(async (tx) => {
        // Verify the client owns this order
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            clientId: clientId,
          },
        });

        if (!order) {
          throw new Error("Order not found or you are not the owner");
        }

        // Update order status to completed
        await tx.order.update({
          where: { id: orderId },
          data: { status: "completed" },
        });

        // Log status change if status actually changed
        if (order.status !== "completed") {
          await this.logOrderChange(
            orderId,
            "status",
            order.status,
            "completed",
            clientId,
            "Order completed",
            tx
          );
        }

        // Get all conversations related to this order before updating
        const conversations = await tx.conversation.findMany({
          where: { orderId: orderId },
          include: {
            Participants: {
              where: { isActive: true },
              select: { userId: true },
            },
          },
        });

        // Close all conversations related to this order
        await tx.conversation.updateMany({
          where: { orderId: orderId },
          data: {
            status: "completed",
            updatedAt: new Date(),
          },
        });

        return {
          message: "Order completed successfully",
        };
      })
      .then(async (result) => {
        // Emit Pusher events after transaction completes
        try {
          // Get order with all participants (client and specialists with proposals)
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
              Client: { select: { id: true } },
              Proposals: {
                select: { userId: true },
                distinct: ["userId"],
              },
            },
          });

          if (order) {
            const userIds = new Set<number>();
            userIds.add(order.clientId);
            order.Proposals.forEach((p) => userIds.add(p.userId));

            // Emit to order channel
            await this.pusherService.trigger(
              `order-${orderId}`,
              "order-status-updated",
              {
                orderId,
                status: "completed",
                updatedAt: new Date().toISOString(),
              }
            );

            // Emit to each user's channel
            for (const userId of userIds) {
              await this.pusherService.trigger(
                `user-${userId}`,
                "order-status-updated",
                {
                  orderId,
                  status: "completed",
                  updatedAt: new Date().toISOString(),
                }
              );
            }
          }

          // Also emit conversation status updates
          const conversations = await this.prisma.conversation.findMany({
            where: { orderId: orderId },
            include: {
              Participants: {
                where: { isActive: true },
                select: { userId: true },
              },
            },
          });

          for (const conversation of conversations) {
            // Emit to conversation channel
            await this.pusherService.trigger(
              `conversation-${conversation.id}`,
              "conversation-status-updated",
              {
                conversationId: conversation.id,
                status: "completed",
                updatedAt: new Date().toISOString(),
              }
            );

            // Emit to each participant's user channel
            for (const participant of conversation.Participants) {
              await this.pusherService.trigger(
                `user-${participant.userId}`,
                "conversation-status-updated",
                {
                  conversationId: conversation.id,
                  status: "completed",
                  updatedAt: new Date().toISOString(),
                }
              );
            }
          }
        } catch (error) {
          console.error(
            "Error emitting Pusher event for order/conversation status:",
            error
          );
          // Don't fail the request if Pusher fails
        }

        return result;
      });
  }

  /**
   * Broadcast typing status to conversation participants
   */
  async sendTypingStatus(
    userId: number,
    conversationId: number,
    isTyping: boolean
  ) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
    });

    if (!participant) {
      throw new Error("You are not a participant of this conversation");
    }

    try {
      await this.pusherService.trigger(
        `conversation-${conversationId}`,
        "currently-typing",
        {
          conversationId,
          userId,
          isTyping,
          timestamp: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error("Failed to broadcast typing status:", error);
    }

    return { success: true };
  }
}
