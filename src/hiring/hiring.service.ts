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

@Injectable()
export class HiringService {
  private readonly logger = new Logger(HiringService.name);

  constructor(
    private prisma: PrismaService,
    private orderPricingService: OrderPricingService,
    private notificationsService: NotificationsService
  ) {}

  async hireSpecialist(hireData: {
    specialistId: number;
    message: string;
    orderId: number;
    clientId: number;
  }) {
    try {
      // Validate input data
      this.validateHireData(hireData);

      // Check if order exists and belongs to the client
      const order = await this.prisma.order.findUnique({
        where: { id: hireData.orderId },
        include: {
          Client: true,
          Service: true,
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

      if (hiringCost > 0) {
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

      // Deduct credits if hiring has a cost
      if (hiringCost > 0) {
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

      // Create notification for hired specialist with push notification
      await this.notificationsService.createNotificationWithPush(
        hireData.specialistId,
        "hiring_approved",
        "notificationHiringApprovedTitle",
        "notificationHiringApprovedMessage",
        {
          orderId: hireData.orderId,
          clientId: hireData.clientId,
          conversationId: conversation.id,
        },
        {
          orderTitle: order.title || "",
        }
      );

      // Process refunds for rejected applicants
      try {
        await this.orderPricingService.processRefundsForRejectedApplicants(
          hireData.orderId,
          conversation.id, // This will be the selected proposal ID
          order.budget || 0
        );
      } catch (refundError) {
        this.logger.error(
          `Error processing refunds for order ${hireData.orderId}:`,
          refundError
        );
        // Don't fail the hiring process if refunds fail
      }

      return {
        success: true,
        message: "Hiring request sent successfully",
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
