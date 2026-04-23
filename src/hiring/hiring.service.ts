import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrderPricingService } from "../order-pricing/order-pricing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ChatService } from "../chat/chat.service";

@Injectable()
export class HiringService {
  private readonly logger = new Logger(HiringService.name);

  constructor(
    private prisma: PrismaService,
    private orderPricingService: OrderPricingService,
    private notificationsService: NotificationsService,
    private chatService: ChatService
  ) {}

  async hireSpecialist(hireData: {
    specialistId: number;
    message: string;
    orderId: number;
    clientId: number;
    paymentEnabled?: boolean;
  }) {
    try {
      // Validate input data
      this.validateHireData(hireData);

      // Check if order exists and belongs to the client
      const order = await this.prisma.order.findUnique({
        where: { id: hireData.orderId },
        include: {
          Client: true,
          Category: true,
        },
      });

      if (!order) {
        throw new NotFoundException({
          error: "ORDER_NOT_FOUND",
          message: `Order with ID ${hireData.orderId} not found`,
          details: "The order you are trying to hire for does not exist",
        });
      }

      if (order.clientId !== hireData.clientId) {
        throw new ForbiddenException({
          error: "UNAUTHORIZED_ORDER_ACCESS",
          message: "You can only hire specialists for your own orders",
          details:
            "You do not have permission to hire specialists for this order",
        });
      }

      // Check if order is in the correct status
      if (order.status !== "open") {
        throw new BadRequestException({
          error: "INVALID_ORDER_STATUS",
          message: `Cannot hire specialists for orders with status: ${order.status}`,
          details: "Only open orders can have specialists hired for them",
          currentStatus: order.status,
          allowedStatuses: ["open"],
        });
      }

      // Check if specialist exists and has specialist role
      const specialist = await this.prisma.user.findUnique({
        where: {
          id: hireData.specialistId,
          role: "specialist",
        },
      });

      if (!specialist) {
        throw new NotFoundException({
          error: "SPECIALIST_NOT_FOUND",
          message: `Specialist with ID ${hireData.specialistId} not found or not a specialist`,
          details:
            "The specialist you are trying to hire does not exist or is not a specialist",
        });
      }

      // Check if specialist is trying to hire themselves
      if (hireData.specialistId === hireData.clientId) {
        throw new BadRequestException({
          error: "SELF_HIRING_NOT_ALLOWED",
          message: "You cannot hire yourself",
          details: "Specialists cannot be hired for their own orders",
        });
      }

      // Check credit cost for hiring (if any)
      const hiringCost = await this.orderPricingService.getCreditCost(
        order.budget || 0
      );

      if (hiringCost > 0 && hireData.paymentEnabled !== false) {
        // Check if client has sufficient credits
        if (order.Client.creditBalance < hiringCost) {
          throw new BadRequestException({
            error: "INSUFFICIENT_CREDITS",
            message: "Insufficient credit balance for hiring",
            details: `Required: ${hiringCost} credits, Available: ${order.Client.creditBalance} credits`,
            requiredCredits: hiringCost,
            availableCredits: order.Client.creditBalance,
          });
        }
      }

      // Check if there's already a conversation for this order and specialist
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          orderId: hireData.orderId,
          Participants: {
            some: {
              userId: hireData.specialistId,
            },
          },
        },
        include: {
          Participants: true,
        },
      });

      // If conversation exists and is active, return the existing conversation
      if (existingConversation && existingConversation.status === "active") {
        // Fetch the full conversation details
        const fullConversation = await this.prisma.conversation.findUnique({
          where: { id: existingConversation.id },
          include: {
            Order: {
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Participants: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Messages: {
              include: {
                Sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

        return {
          success: true,
          message: "You have already contacted this specialist for this order",
          conversation: fullConversation,
          alreadyContacted: true,
        };
      }

      // Deduct credits if hiring has a cost and payment is enabled
      if (hiringCost > 0 && hireData.paymentEnabled !== false) {
        await this.prisma.user.update({
          where: { id: hireData.clientId },
          data: { creditBalance: { decrement: hiringCost } },
        });
      }

      let conversation;

      // If there's an existing conversation with this specialist for this order
      if (existingConversation) {
        // Reopen the conversation if it's closed
        if (
          existingConversation.status === "closed" ||
          existingConversation.status === "completed"
        ) {
          await this.prisma.conversation.update({
            where: { id: existingConversation.id },
            data: { status: "active" },
          });
        }

        // Ensure the specialist is an active participant
        const specialistParticipant = existingConversation.Participants.find(
          (p) => p.userId === hireData.specialistId
        );

        if (specialistParticipant && !specialistParticipant.isActive) {
          await this.prisma.conversationParticipant.update({
            where: { id: specialistParticipant.id },
            data: { isActive: true },
          });
        } else if (!specialistParticipant) {
          await this.prisma.conversationParticipant.create({
            data: {
              conversationId: existingConversation.id,
              userId: hireData.specialistId,
              isActive: true,
            },
          });
        }

        // Add the hiring message
        await this.prisma.message.create({
          data: {
            conversationId: existingConversation.id,
            content: hireData.message,
            senderId: hireData.clientId,
            messageType: "text",
          },
        });

        // Fetch the updated conversation
        conversation = await this.prisma.conversation.findUnique({
          where: { id: existingConversation.id },
          include: {
            Order: {
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Participants: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Messages: {
              include: {
                Sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });
      } else {
        // Check if there's an existing conversation for this order (without the specialist)
        const existingOrderConversation =
          await this.prisma.conversation.findFirst({
            where: {
              orderId: hireData.orderId,
            },
            include: {
              Participants: true,
            },
          });

        if (existingOrderConversation) {
          // Add specialist to existing conversation
          await this.prisma.conversationParticipant.create({
            data: {
              conversationId: existingOrderConversation.id,
              userId: hireData.specialistId,
              isActive: true,
            },
          });

          // Add the hiring message
          await this.prisma.message.create({
            data: {
              conversationId: existingOrderConversation.id,
              content: hireData.message,
              senderId: hireData.clientId,
              messageType: "text",
            },
          });

          // Fetch the updated conversation
          conversation = await this.prisma.conversation.findUnique({
            where: { id: existingOrderConversation.id },
            include: {
              Order: {
                include: {
                  Client: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
              Participants: {
                include: {
                  User: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
              Messages: {
                include: {
                  Sender: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatarUrl: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
          });
        } else {
          // Create a new conversation
          conversation = await this.prisma.conversation.create({
            data: {
              orderId: hireData.orderId,
              status: "active",
              Participants: {
                create: [
                  {
                    userId: hireData.clientId,
                    isActive: true,
                  },
                  {
                    userId: hireData.specialistId,
                    isActive: true,
                  },
                ],
              },
              Messages: {
                create: {
                  content: hireData.message,
                  senderId: hireData.clientId,
                  messageType: "text",
                },
              },
            },
            include: {
              Order: {
                include: {
                  Client: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
              Participants: {
                include: {
                  User: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
              Messages: {
                include: {
                  Sender: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatarUrl: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
          });
        }
      }

      try {
        const proposalId =
          await this.getOrCreatePendingProposalForDirectHireIndividual({
            orderId: hireData.orderId,
            specialistId: hireData.specialistId,
            message: hireData.message,
          });
        await this.chatService.chooseApplication(
          hireData.orderId,
          hireData.clientId,
          proposalId
        );
      } catch (finalizeError) {
        this.logger.error(
          `Failed to finalize direct hire (proposal / choose) for order ${hireData.orderId}:`,
          finalizeError
        );
        if (finalizeError instanceof BadRequestException) {
          throw finalizeError;
        }
        const msg =
          finalizeError instanceof Error
            ? finalizeError.message
            : "Failed to finalize hiring";
        throw new BadRequestException({
          error: "HIRE_FINALIZE_FAILED",
          message: msg,
          details:
            "Conversation was created but the order could not be moved to in progress. You may be able to choose the specialist from chat.",
        });
      }

      const orderFresh = await this.prisma.order.findUnique({
        where: { id: hireData.orderId },
        select: { status: true },
      });
      if (conversation.Order && orderFresh) {
        conversation.Order.status = orderFresh.status;
      }

      return {
        success: true,
        message: "Specialist hired and order is now in progress",
        conversation,
      };
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // Handle database errors
      if (error.code === "P2002") {
        throw new ConflictException({
          error: "DUPLICATE_CONVERSATION",
          message:
            "A conversation already exists for this order and specialist",
          details:
            "There is already a conversation between you and this specialist for this order",
        });
      }

      if (error.code === "P2025") {
        throw new NotFoundException({
          error: "RECORD_NOT_FOUND",
          message: "Required record not found during hiring process",
          details:
            "One of the required records (order, specialist, or conversation) was not found",
        });
      }

      // Handle other database errors
      if (error.code && error.code.startsWith("P")) {
        throw new InternalServerErrorException({
          error: "DATABASE_ERROR",
          message: "Database error occurred during hiring process",
          details:
            "An error occurred while processing your hiring request. Please try again.",
          code: error.code,
        });
      }

      // Handle unexpected errors
      throw new InternalServerErrorException({
        error: "HIRING_FAILED",
        message: "Failed to process hiring request",
        details:
          "An unexpected error occurred while processing your hiring request. Please try again.",
      });
    }
  }

  async hireTeam(hireData: {
    teamId: number;
    message: string;
    orderId: number;
    clientId: number;
    paymentEnabled?: boolean;
  }) {
    try {
      // Validate input data
      if (!hireData.teamId || hireData.teamId <= 0) {
        throw new BadRequestException({
          error: "INVALID_TEAM_ID",
          message: "Invalid team ID",
          details: "Team ID must be a positive number",
        });
      }

      if (!hireData.orderId || hireData.orderId <= 0) {
        throw new BadRequestException({
          error: "INVALID_ORDER_ID",
          message: "Invalid order ID",
          details: "Order ID must be a positive number",
        });
      }

      if (!hireData.clientId || hireData.clientId <= 0) {
        throw new BadRequestException({
          error: "INVALID_CLIENT_ID",
          message: "Invalid client ID",
          details: "Client ID must be a positive number",
        });
      }

      if (!hireData.message || hireData.message.trim().length === 0) {
        throw new BadRequestException({
          error: "EMPTY_MESSAGE",
          message: "Message cannot be empty",
          details: "Please provide a message when hiring a team",
        });
      }

      if (hireData.message.length > 1000) {
        throw new BadRequestException({
          error: "MESSAGE_TOO_LONG",
          message: "Message is too long",
          details: "Message cannot exceed 1000 characters",
          maxLength: 1000,
          currentLength: hireData.message.length,
        });
      }

      // Check if order exists and belongs to the client
      const order = await this.prisma.order.findUnique({
        where: { id: hireData.orderId },
        include: {
          Client: true,
          Category: true,
        },
      });

      if (!order) {
        throw new NotFoundException({
          error: "ORDER_NOT_FOUND",
          message: `Order with ID ${hireData.orderId} not found`,
          details: "The order you are trying to hire for does not exist",
        });
      }

      if (order.clientId !== hireData.clientId) {
        throw new ForbiddenException({
          error: "UNAUTHORIZED_ORDER_ACCESS",
          message: "You can only hire teams for your own orders",
          details: "You do not have permission to hire teams for this order",
        });
      }

      // Check if order is in the correct status
      if (order.status !== "open") {
        throw new BadRequestException({
          error: "INVALID_ORDER_STATUS",
          message: `Cannot hire teams for orders with status: ${order.status}`,
          details: "Only open orders can have teams hired for them",
          currentStatus: order.status,
          allowedStatuses: ["open"],
        });
      }

      // Check if team exists and is active
      const team = await this.prisma.team.findUnique({
        where: { id: hireData.teamId },
        include: {
          Creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          Members: {
            where: {
              isActive: true,
              status: "accepted",
            },
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!team) {
        throw new NotFoundException({
          error: "TEAM_NOT_FOUND",
          message: `Team with ID ${hireData.teamId} not found`,
          details: "The team you are trying to hire does not exist",
        });
      }

      if (!team.isActive) {
        throw new BadRequestException({
          error: "TEAM_NOT_ACTIVE",
          message: "Team is not active",
          details: "You can only hire active teams",
        });
      }

      // Get all accepted team members (including creator)
      const teamMemberIds = [
        team.createdBy,
        ...team.Members.map((m) => m.User.id),
      ].filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates

      if (teamMemberIds.length === 0) {
        throw new BadRequestException({
          error: "TEAM_HAS_NO_MEMBERS",
          message: "Team has no members",
          details: "You cannot hire a team with no members",
        });
      }

      // Check if client is trying to hire their own team
      if (teamMemberIds.includes(hireData.clientId)) {
        throw new BadRequestException({
          error: "SELF_HIRING_NOT_ALLOWED",
          message: "You cannot hire a team you are part of",
          details: "You cannot hire a team that includes yourself",
        });
      }

      // Check credit cost for hiring (if any)
      const hiringCost = await this.orderPricingService.getCreditCost(
        order.budget || 0
      );

      if (hiringCost > 0 && hireData.paymentEnabled !== false) {
        // Check if client has sufficient credits
        if (order.Client.creditBalance < hiringCost) {
          throw new BadRequestException({
            error: "INSUFFICIENT_CREDITS",
            message: "Insufficient credit balance for hiring",
            details: `Required: ${hiringCost} credits, Available: ${order.Client.creditBalance} credits`,
            requiredCredits: hiringCost,
            availableCredits: order.Client.creditBalance,
          });
        }
      }

      // Check if there's already a conversation for this order and team
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          orderId: hireData.orderId,
          Participants: {
            some: {
              userId: { in: teamMemberIds },
            },
          },
        },
        include: {
          Participants: true,
        },
      });

      // If conversation exists and is active, return the existing conversation
      if (existingConversation && existingConversation.status === "active") {
        // Ensure all team members are participants
        const existingParticipantIds = existingConversation.Participants.map(
          (p) => p.userId
        );
        const missingMemberIds = teamMemberIds.filter(
          (id) => !existingParticipantIds.includes(id)
        );

        if (missingMemberIds.length > 0) {
          await this.prisma.conversationParticipant.createMany({
            data: missingMemberIds.map((userId) => ({
              conversationId: existingConversation.id,
              userId,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }

        // Add the hiring message
        await this.prisma.message.create({
          data: {
            conversationId: existingConversation.id,
            content: hireData.message,
            senderId: hireData.clientId,
            messageType: "text",
          },
        });

        // Fetch the updated conversation
        const fullConversation = await this.prisma.conversation.findUnique({
          where: { id: existingConversation.id },
          include: {
            Order: {
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Participants: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Messages: {
              include: {
                Sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

        return {
          success: true,
          message: "You have already contacted this team for this order",
          conversation: fullConversation,
          alreadyContacted: true,
        };
      }

      // Deduct credits if hiring has a cost and payment is enabled
      if (hiringCost > 0 && hireData.paymentEnabled !== false) {
        await this.prisma.user.update({
          where: { id: hireData.clientId },
          data: { creditBalance: { decrement: hiringCost } },
        });
      }

      let conversation;

      // Check if there's an existing conversation for this order (without the team)
      const existingOrderConversation =
        await this.prisma.conversation.findFirst({
          where: {
            orderId: hireData.orderId,
          },
          include: {
            Participants: true,
          },
        });

      if (existingOrderConversation) {
        // Add all team members to existing conversation
        const existingParticipantIds =
          existingOrderConversation.Participants.map((p) => p.userId);
        const missingMemberIds = teamMemberIds.filter(
          (id) => !existingParticipantIds.includes(id)
        );

        if (missingMemberIds.length > 0) {
          await this.prisma.conversationParticipant.createMany({
            data: missingMemberIds.map((userId) => ({
              conversationId: existingOrderConversation.id,
              userId,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }

        // Add the hiring message
        await this.prisma.message.create({
          data: {
            conversationId: existingOrderConversation.id,
            content: hireData.message,
            senderId: hireData.clientId,
            messageType: "text",
          },
        });

        // Fetch the updated conversation
        conversation = await this.prisma.conversation.findUnique({
          where: { id: existingOrderConversation.id },
          include: {
            Order: {
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Participants: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Messages: {
              include: {
                Sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });
      } else {
        // Create a new conversation with all team members
        conversation = await this.prisma.conversation.create({
          data: {
            orderId: hireData.orderId,
            status: "active",
            title: `Order: ${order.title || "Untitled"} - Team: ${team.name}`,
            Participants: {
              create: [
                {
                  userId: hireData.clientId,
                  isActive: true,
                },
                ...teamMemberIds.map((userId) => ({
                  userId,
                  isActive: true,
                })),
              ],
            },
            Messages: {
              create: {
                content: hireData.message,
                senderId: hireData.clientId,
                messageType: "text",
              },
            },
          },
          include: {
            Order: {
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Participants: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            Messages: {
              include: {
                Sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });
      }

      try {
        const proposalId = await this.getOrCreatePendingProposalForDirectHireTeam(
          {
            orderId: hireData.orderId,
            teamId: hireData.teamId,
            leadUserId: team.createdBy,
            message: hireData.message,
          }
        );
        await this.chatService.chooseApplication(
          hireData.orderId,
          hireData.clientId,
          proposalId
        );
      } catch (finalizeError) {
        this.logger.error(
          `Failed to finalize direct team hire for order ${hireData.orderId}:`,
          finalizeError
        );
        if (finalizeError instanceof BadRequestException) {
          throw finalizeError;
        }
        const msg =
          finalizeError instanceof Error
            ? finalizeError.message
            : "Failed to finalize hiring";
        throw new BadRequestException({
          error: "HIRE_FINALIZE_FAILED",
          message: msg,
          details:
            "Conversation was created but the order could not be moved to in progress. You may be able to choose the team from chat.",
        });
      }

      const orderFreshTeam = await this.prisma.order.findUnique({
        where: { id: hireData.orderId },
        select: { status: true },
      });
      if (conversation.Order && orderFreshTeam) {
        conversation.Order.status = orderFreshTeam.status;
      }

      // Notify team members (hiring outreach — choose flow also sends acceptance)
      for (const memberId of teamMemberIds) {
        await this.notificationsService.createNotificationWithPush(
          memberId,
          "hiring_approved",
          "notificationHiringApprovedTitle",
          "notificationHiringApprovedMessage",
          {
            orderId: hireData.orderId,
            clientId: hireData.clientId,
            conversationId: conversation.id,
            teamId: hireData.teamId,
          },
          {
            orderTitle: order.title || "",
            teamName: team.name,
          }
        );
      }

      return {
        success: true,
        message: "Team hired and order is now in progress",
        conversation,
      };
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // Handle database errors
      if (error.code === "P2002") {
        throw new ConflictException({
          error: "DUPLICATE_CONVERSATION",
          message: "A conversation already exists for this order and team",
          details:
            "There is already a conversation between you and this team for this order",
        });
      }

      if (error.code === "P2025") {
        throw new NotFoundException({
          error: "RECORD_NOT_FOUND",
          message: "Required record not found during hiring process",
          details:
            "One of the required records (order, team, or conversation) was not found",
        });
      }

      // Handle other database errors
      if (error.code && error.code.startsWith("P")) {
        throw new InternalServerErrorException({
          error: "DATABASE_ERROR",
          message: "Database error occurred during hiring process",
          details:
            "An error occurred while processing your hiring request. Please try again.",
          code: error.code,
        });
      }

      // Handle unexpected errors
      throw new InternalServerErrorException({
        error: "HIRING_FAILED",
        message: "Failed to process hiring request",
        details:
          "An unexpected error occurred while processing your hiring request. Please try again.",
      });
    }
  }

  async checkHiringStatus(
    specialistId: number,
    orderId: number,
    clientId: number
  ) {
    try {
      // Check if there's already a conversation for this order and specialist
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          orderId: orderId,
          Participants: {
            some: {
              userId: specialistId,
            },
          },
        },
        include: {
          Participants: true,
        },
      });

      if (existingConversation && existingConversation.status === "active") {
        return {
          isAlreadyHired: true,
          conversationId: existingConversation.id,
          message: "You have already contacted this specialist for this order",
        };
      }

      return {
        isAlreadyHired: false,
        message: "Specialist is available for this order",
      };
    } catch (error) {
      console.error("Error checking hiring status:", error);
      return {
        isAlreadyHired: false,
        message: "Unable to check hiring status",
      };
    }
  }

  /**
   * Ensures a pending OrderProposal exists for a client-initiated specialist hire, then choose uses it.
   */
  private async getOrCreatePendingProposalForDirectHireIndividual(params: {
    orderId: number;
    specialistId: number;
    message: string;
  }): Promise<number> {
    const { orderId, specialistId, message } = params;

    const pending = await this.prisma.orderProposal.findFirst({
      where: { orderId, userId: specialistId, status: "pending" },
    });
    if (pending) {
      return pending.id;
    }

    const existing = await this.prisma.orderProposal.findFirst({
      where: { orderId, userId: specialistId },
    });
    if (existing) {
      if (
        existing.status === "rejected" ||
        existing.status === "canceled" ||
        existing.status === "cancelled"
      ) {
        await this.prisma.orderProposal.update({
          where: { id: existing.id },
          data: { status: "pending", message },
        });
        return existing.id;
      }
      throw new BadRequestException({
        error: "PROPOSAL_ALREADY_EXISTS",
        message: "This specialist already has an application on this order",
        details: `Existing proposal status: ${existing.status}`,
      });
    }

    const created = await this.prisma.orderProposal.create({
      data: {
        orderId,
        userId: specialistId,
        message,
        status: "pending",
      },
    });
    return created.id;
  }

  /**
   * Ensures a pending OrderProposal exists for a client-initiated team hire.
   */
  private async getOrCreatePendingProposalForDirectHireTeam(params: {
    orderId: number;
    teamId: number;
    leadUserId: number;
    message: string;
  }): Promise<number> {
    const { orderId, teamId, leadUserId, message } = params;

    const pending = await this.prisma.orderProposal.findFirst({
      where: { orderId, teamId, status: "pending" },
    });
    if (pending) {
      return pending.id;
    }

    const existing = await this.prisma.orderProposal.findFirst({
      where: { orderId, teamId },
    });
    if (existing) {
      if (
        existing.status === "rejected" ||
        existing.status === "canceled" ||
        existing.status === "cancelled"
      ) {
        await this.prisma.orderProposal.update({
          where: { id: existing.id },
          data: { status: "pending", message },
        });
        return existing.id;
      }
      throw new BadRequestException({
        error: "PROPOSAL_ALREADY_EXISTS",
        message: "This team already has an application on this order",
        details: `Existing proposal status: ${existing.status}`,
      });
    }

    const created = await this.prisma.orderProposal.create({
      data: {
        orderId,
        userId: leadUserId,
        leadUserId,
        teamId,
        message,
        status: "pending",
      },
    });
    return created.id;
  }

  private validateHireData(hireData: {
    specialistId: number;
    message: string;
    orderId: number;
    clientId: number;
  }) {
    if (!hireData.specialistId || hireData.specialistId <= 0) {
      throw new BadRequestException({
        error: "INVALID_SPECIALIST_ID",
        message: "Invalid specialist ID",
        details: "Specialist ID must be a positive number",
      });
    }

    if (!hireData.orderId || hireData.orderId <= 0) {
      throw new BadRequestException({
        error: "INVALID_ORDER_ID",
        message: "Invalid order ID",
        details: "Order ID must be a positive number",
      });
    }

    if (!hireData.clientId || hireData.clientId <= 0) {
      throw new BadRequestException({
        error: "INVALID_CLIENT_ID",
        message: "Invalid client ID",
        details: "Client ID must be a positive number",
      });
    }

    if (!hireData.message || hireData.message.trim().length === 0) {
      throw new BadRequestException({
        error: "EMPTY_MESSAGE",
        message: "Message cannot be empty",
        details: "Please provide a message when hiring a specialist",
      });
    }

    if (hireData.message.length > 1000) {
      throw new BadRequestException({
        error: "MESSAGE_TOO_LONG",
        message: "Message is too long",
        details: "Message cannot exceed 1000 characters",
        maxLength: 1000,
        currentLength: hireData.message.length,
      });
    }
  }
}
