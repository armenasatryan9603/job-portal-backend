import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrderPricingService } from "../order-pricing/order-pricing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AIService } from "../ai/ai.service";
import { CreditTransactionsService } from "../credit/credit-transactions.service";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly AI_ENHANCEMENT_CREDIT_COST = parseFloat(
    process.env.AI_ENHANCEMENT_CREDIT_COST || "2"
  );

  constructor(
    private prisma: PrismaService,
    private orderPricingService: OrderPricingService,
    private notificationsService: NotificationsService,
    private aiService: AIService,
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

  async createOrder(
    clientId: number,
    serviceId: number | undefined,
    title: string,
    description: string,
    budget: number,
    availableDates?: string[],
    location?: string,
    skills?: string[],
    useAIEnhancement: boolean = false,
    questions?: string[]
  ) {
    // Check if client exists
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new BadRequestException(`Client with ID ${clientId} not found`);
    }

    // If serviceId is provided, check if service exists
    if (serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        throw new BadRequestException(`Service with ID ${serviceId} not found`);
      }
    }

    // Ensure arrays are properly formatted
    const formattedAvailableDates = Array.isArray(availableDates)
      ? availableDates
      : availableDates
        ? [availableDates]
        : [];

    const formattedSkills = Array.isArray(skills)
      ? skills
      : skills
        ? [skills]
        : [];

    // Handle AI enhancement if requested
    let titleEn: string | undefined;
    let titleRu: string | undefined;
    let titleHy: string | undefined;
    let descriptionEn: string | undefined;
    let descriptionRu: string | undefined;
    let descriptionHy: string | undefined;

    if (useAIEnhancement) {
      // Check if AI service is available
      if (!this.aiService.isAvailable()) {
        throw new BadRequestException(
          "AI enhancement is not available. Please contact support."
        );
      }

      // Check if user has sufficient credits
      if (client.creditBalance < this.AI_ENHANCEMENT_CREDIT_COST) {
        throw new BadRequestException(
          `Insufficient credit balance. Required: ${this.AI_ENHANCEMENT_CREDIT_COST} credits, Available: ${client.creditBalance} credits`
        );
      }

      try {
        // Enhance text with AI
        const enhanced = await this.aiService.enhanceOrderText(
          title,
          description
        );
        titleEn = enhanced.titleEn;
        titleRu = enhanced.titleRu;
        titleHy = enhanced.titleHy;
        descriptionEn = enhanced.descriptionEn;
        descriptionRu = enhanced.descriptionRu;
        descriptionHy = enhanced.descriptionHy;

        // Deduct credits in a transaction
        await this.prisma.$transaction(async (tx) => {
          const updatedUser = await tx.user.update({
            where: { id: clientId },
            data: {
              creditBalance: { decrement: this.AI_ENHANCEMENT_CREDIT_COST },
            },
            select: { creditBalance: true },
          });

          // Log credit transaction
          await this.creditTransactionsService.logTransaction({
            userId: clientId,
            amount: -this.AI_ENHANCEMENT_CREDIT_COST,
            balanceAfter: updatedUser.creditBalance,
            type: "ai_enhancement",
            status: "completed",
            description: `AI enhancement for order creation`,
            referenceId: null,
            referenceType: null,
            metadata: {
              service: "order_creation_ai_enhancement",
              cost: this.AI_ENHANCEMENT_CREDIT_COST,
            },
            tx,
          });
        });

        this.logger.log(
          `AI enhancement applied for order by user ${clientId}. Credits deducted: ${this.AI_ENHANCEMENT_CREDIT_COST}`
        );
      } catch (error) {
        this.logger.error("Error during AI enhancement:", error);
        // If AI enhancement fails, fall back to saving user input as-is
        this.logger.warn(
          "Falling back to saving user input without AI enhancement"
        );
      }
    }

    const order = await this.prisma.order.create({
      data: {
        clientId,
        serviceId,
        title,
        description,
        titleEn,
        titleRu,
        titleHy,
        descriptionEn,
        descriptionRu,
        descriptionHy,
        budget,
        availableDates: formattedAvailableDates,
        location,
        skills: formattedSkills,
        status: "open",
        ...(questions && questions.length > 0
          ? {
              questions: {
                create: questions
                  .filter((q) => q && q.trim().length > 0)
                  .map((question, index) => ({
                    question: question.trim(),
                    order: index,
                  })),
              },
            }
          : {}),
      } as any,
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
          },
        },
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            Proposals: true,
            Reviews: true,
          },
        },
      } as any,
    });

    // Log initial "open" status
    await this.logOrderChange(
      order.id,
      "status",
      null,
      "open",
      clientId,
      "Order created"
    );

    // Send notifications to users who have notifications enabled for this service
    if (serviceId) {
      await this.sendNewOrderNotifications(
        order.id,
        serviceId,
        order.title || ""
      );
    }

    return order;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    serviceId?: number,
    serviceIds?: number[],
    clientId?: number
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    // Support both single serviceId (backward compatibility) and multiple serviceIds
    if (serviceIds && serviceIds.length > 0) {
      where.serviceId = { in: serviceIds };
    } else if (serviceId) {
      where.serviceId = serviceId;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          Client: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          BannerImage: {
            select: {
              id: true,
              fileUrl: true,
              fileType: true,
            },
          },
          Proposals: {
            take: 3,
            orderBy: { createdAt: "desc" },
            include: {},
          },
          questions: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        } as any,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Calculate credit cost for each order
    const ordersWithCreditCost = await Promise.all(
      orders.map(async (order) => {
        const creditCost = await this.orderPricingService.getCreditCost(
          order.budget || 0
        );
        return {
          ...order,
          creditCost,
        };
      })
    );

    return {
      orders: ordersWithCreditCost,
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

  async findOne(id: number) {
    // Validate that id is a valid number
    if (!id || isNaN(id) || id <= 0) {
      throw new Error(`Invalid order ID: ${id}`);
    }

    const order = await this.prisma.order.findUnique({
      where: { id: Number(id) },
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            bio: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            nameRu: true,
            nameHy: true,
            description: true,
            descriptionEn: true,
            descriptionRu: true,
            descriptionHy: true,
            imageUrl: true,
            parentId: true,
            averagePrice: true,
            minPrice: true,
            maxPrice: true,
            completionRate: true,
            isActive: true,
          },
        },
        Proposals: {
          orderBy: { createdAt: "desc" },
        },
        Reviews: {
          include: {
            Reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        MediaFiles: {
          orderBy: { createdAt: "desc" },
        },
        BannerImage: {
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
          },
        },
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            Proposals: true,
            Reviews: true,
          },
        },
      } as any,
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Calculate credit cost for the order
    const creditCost = await this.orderPricingService.getCreditCost(
      order.budget || 0
    );

    // Transform Service to match frontend expectations (add name and description fields)
    const orderWithService = order as any;
    let transformedService = orderWithService.Service;
    if (orderWithService.Service) {
      transformedService = {
        ...orderWithService.Service,
        name:
          orderWithService.Service.nameEn ||
          orderWithService.Service.nameRu ||
          orderWithService.Service.nameHy ||
          orderWithService.Service.name ||
          "",
        description:
          orderWithService.Service.descriptionEn ||
          orderWithService.Service.descriptionRu ||
          orderWithService.Service.descriptionHy ||
          orderWithService.Service.description ||
          null,
      };
    }

    return {
      ...order,
      Service: transformedService,
      creditCost,
    };
  }

  async setBannerImage(orderId: number, mediaFileId: number) {
    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Verify media file exists and belongs to this order
    const mediaFile = await this.prisma.mediaFile.findFirst({
      where: {
        id: mediaFileId,
        orderId: orderId,
        fileType: "image", // Only images can be banner
      },
    });

    if (!mediaFile) {
      throw new NotFoundException(
        `Media file with ID ${mediaFileId} not found or is not an image for this order`
      );
    }

    // Update order with banner image
    return this.prisma.order.update({
      where: { id: orderId },
      data: { bannerImageId: mediaFileId },
      include: {
        BannerImage: {
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
          },
        },
      },
    });
  }

  async update(
    id: number,
    updateOrderDto: {
      serviceId?: number;
      title?: string;
      description?: string;
      budget?: number;
      status?: string;
      titleEn?: string;
      titleRu?: string;
      titleHy?: string;
      descriptionEn?: string;
      descriptionRu?: string;
      descriptionHy?: string;
      questions?: string[];
    },
    userId: number,
    useAIEnhancement: boolean = false
  ) {
    // Validate that id is a valid number
    if (!id || isNaN(id) || id <= 0) {
      throw new Error(`Invalid order ID: ${id}`);
    }

    // Check if order exists
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: Number(id) },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Verify user is the owner of the order
    if (existingOrder.clientId !== userId) {
      throw new BadRequestException("You can only update your own orders");
    }

    // Get client to check credits if AI enhancement is enabled
    const client = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!client) {
      throw new BadRequestException(`Client with ID ${userId} not found`);
    }

    // If serviceId is being updated, check if service exists
    if (updateOrderDto.serviceId !== undefined) {
      if (updateOrderDto.serviceId !== null) {
        const service = await this.prisma.service.findUnique({
          where: { id: updateOrderDto.serviceId },
        });

        if (!service) {
          throw new BadRequestException(
            `Service with ID ${updateOrderDto.serviceId} not found`
          );
        }
      }
    }

    // Validate status
    const validStatuses = ["open", "in_progress", "completed", "cancelled"];
    if (
      updateOrderDto.status &&
      !validStatuses.includes(updateOrderDto.status)
    ) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    // Handle AI enhancement if requested
    let titleEn: string | undefined;
    let titleRu: string | undefined;
    let titleHy: string | undefined;
    let descriptionEn: string | undefined;
    let descriptionRu: string | undefined;
    let descriptionHy: string | undefined;
    let shouldDeductCredits = false;

    // Check if enhanced fields are already provided (from modal accept)
    if (
      updateOrderDto.titleEn &&
      updateOrderDto.descriptionEn &&
      useAIEnhancement
    ) {
      // Enhanced data already provided from modal - use it and deduct credits
      titleEn = updateOrderDto.titleEn;
      titleRu = updateOrderDto.titleRu;
      titleHy = updateOrderDto.titleHy;
      descriptionEn = updateOrderDto.descriptionEn;
      descriptionRu = updateOrderDto.descriptionRu;
      descriptionHy = updateOrderDto.descriptionHy;
      shouldDeductCredits = true;
    }
    // Only apply AI enhancement if title or description is being updated and enhanced fields not already provided
    else if (
      useAIEnhancement &&
      (updateOrderDto.title !== undefined ||
        updateOrderDto.description !== undefined)
    ) {
      // Check if AI service is available
      if (!this.aiService.isAvailable()) {
        throw new BadRequestException(
          "AI enhancement is not available. Please contact support."
        );
      }

      // Check if user has sufficient credits
      if (client.creditBalance < this.AI_ENHANCEMENT_CREDIT_COST) {
        throw new BadRequestException(
          `Insufficient credit balance. Required: ${this.AI_ENHANCEMENT_CREDIT_COST} credits, Available: ${client.creditBalance} credits`
        );
      }

      // Use existing values if not being updated, otherwise use new values
      const titleToEnhance =
        updateOrderDto.title !== undefined
          ? updateOrderDto.title
          : existingOrder.title || "";
      const descriptionToEnhance =
        updateOrderDto.description !== undefined
          ? updateOrderDto.description
          : existingOrder.description || "";

      if (!titleToEnhance || !descriptionToEnhance) {
        throw new BadRequestException(
          "Title and description are required for AI enhancement"
        );
      }

      try {
        // Enhance text with AI
        const enhanced = await this.aiService.enhanceOrderText(
          titleToEnhance,
          descriptionToEnhance
        );
        titleEn = enhanced.titleEn;
        titleRu = enhanced.titleRu;
        titleHy = enhanced.titleHy;
        descriptionEn = enhanced.descriptionEn;
        descriptionRu = enhanced.descriptionRu;
        descriptionHy = enhanced.descriptionHy;
        shouldDeductCredits = true;
      } catch (error) {
        this.logger.error("Error during AI enhancement:", error);
        // If AI enhancement fails, fall back to saving user input as-is
        this.logger.warn(
          "Falling back to saving user input without AI enhancement"
        );
        shouldDeductCredits = false; // Don't deduct credits if AI failed
      }
    }

    // Deduct credits if AI enhancement was used (either from modal accept or AI service call)
    if (shouldDeductCredits && titleEn && descriptionEn) {
      // Check if user has sufficient credits
      if (client.creditBalance < this.AI_ENHANCEMENT_CREDIT_COST) {
        throw new BadRequestException(
          `Insufficient credit balance. Required: ${this.AI_ENHANCEMENT_CREDIT_COST} credits, Available: ${client.creditBalance} credits`
        );
      }

      // Deduct credits in a transaction
      await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            creditBalance: { decrement: this.AI_ENHANCEMENT_CREDIT_COST },
          },
          select: { creditBalance: true },
        });

        // Log credit transaction
        await this.creditTransactionsService.logTransaction({
          userId: userId,
          amount: -this.AI_ENHANCEMENT_CREDIT_COST,
          balanceAfter: updatedUser.creditBalance,
          type: "ai_enhancement",
          status: "completed",
          description: `AI enhancement for order update`,
          referenceId: id.toString(),
          referenceType: "order",
          metadata: {
            service: "order_update_ai_enhancement",
            cost: this.AI_ENHANCEMENT_CREDIT_COST,
            orderId: id,
          },
          tx,
        });
      });

      this.logger.log(
        `AI enhancement applied for order update by user ${userId} (from modal). Credits deducted: ${this.AI_ENHANCEMENT_CREDIT_COST}`
      );
    }

    // Prepare update data (exclude useAIEnhancement and questions as they're handled separately)
    const {
      useAIEnhancement: _,
      questions,
      ...updateData
    } = updateOrderDto as any;

    // Add multilingual fields if AI enhancement was used
    // Check both: fields from AI service call OR fields already in updateOrderDto (from modal accept)
    if (titleEn && descriptionEn) {
      // Use fields from AI service call (when AI enhancement happens in this method)
      updateData.titleEn = titleEn;
      updateData.titleRu = titleRu;
      updateData.titleHy = titleHy;
      updateData.descriptionEn = descriptionEn;
      updateData.descriptionRu = descriptionRu;
      updateData.descriptionHy = descriptionHy;
    } else if (
      (updateOrderDto as any).titleEn &&
      (updateOrderDto as any).descriptionEn
    ) {
      // Use fields already in updateOrderDto (when accepting from modal)
      updateData.titleEn = (updateOrderDto as any).titleEn;
      updateData.titleRu = (updateOrderDto as any).titleRu;
      updateData.titleHy = (updateOrderDto as any).titleHy;
      updateData.descriptionEn = (updateOrderDto as any).descriptionEn;
      updateData.descriptionRu = (updateOrderDto as any).descriptionRu;
      updateData.descriptionHy = (updateOrderDto as any).descriptionHy;
    }

    // Handle questions update if provided
    if (questions !== undefined) {
      // Delete existing questions and create new ones
      await (this.prisma as any).orderQuestion.deleteMany({
        where: { orderId: Number(id) },
      });

      if (questions && questions.length > 0) {
        await (this.prisma as any).orderQuestion.createMany({
          data: questions
            .filter((q: string) => q && q.trim().length > 0)
            .map((question: string, index: number) => ({
              orderId: Number(id),
              question: question.trim(),
              order: index,
            })),
        });
      }
    }

    // Log changes before updating
    if (
      updateOrderDto.title !== undefined &&
      updateOrderDto.title !== existingOrder.title
    ) {
      await this.logOrderChange(
        Number(id),
        "title",
        existingOrder.title || null,
        updateOrderDto.title || null,
        userId
      );
    }

    if (
      updateOrderDto.budget !== undefined &&
      updateOrderDto.budget !== existingOrder.budget
    ) {
      await this.logOrderChange(
        Number(id),
        "budget",
        existingOrder.budget?.toString() || null,
        updateOrderDto.budget?.toString() || null,
        userId
      );
    }

    if (
      updateOrderDto.status !== undefined &&
      updateOrderDto.status !== existingOrder.status
    ) {
      await this.logOrderChange(
        Number(id),
        "status",
        existingOrder.status || null,
        updateOrderDto.status || null,
        userId
      );
    }

    return this.prisma.order.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            Proposals: true,
            Reviews: true,
          },
        },
      } as any,
    });
  }

  async remove(id: number) {
    // Validate that id is a valid number
    if (!id || isNaN(id) || id <= 0) {
      throw new Error(`Invalid order ID: ${id}`);
    }

    // Check if order exists
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: Number(id) },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Check if order has proposals or reviews
    const [proposalsCount, reviewsCount] = await Promise.all([
      this.prisma.orderProposal.count({ where: { orderId: Number(id) } }),
      this.prisma.review.count({ where: { orderId: Number(id) } }),
    ]);

    if (proposalsCount > 0 || reviewsCount > 0) {
      throw new BadRequestException(
        "Cannot delete order with existing proposals or reviews. Please handle them first."
      );
    }

    return this.prisma.order.delete({
      where: { id: Number(id) },
    });
  }

  async getOrdersByClient(
    clientId: number,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findAll(page, limit, undefined, undefined, undefined, clientId);
  }

  async getOrdersBySpecialist(
    specialistId: number,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          Proposals: {
            some: {
              userId: specialistId,
              status: "accepted",
            },
          },
        },
        include: {
          Client: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          Service: true,
          Proposals: {
            where: {
              userId: specialistId,
              status: "accepted",
            },
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({
        where: {
          Proposals: {
            some: {
              userId: specialistId,
              status: "accepted",
            },
          },
        },
      }),
    ]);

    // Calculate credit cost for each order
    const ordersWithCreditCost = await Promise.all(
      orders.map(async (order) => {
        const creditCost = await this.orderPricingService.getCreditCost(
          order.budget || 0
        );
        return {
          ...order,
          creditCost,
        };
      })
    );

    return {
      orders: ordersWithCreditCost,
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

  async getOrdersByService(
    serviceId: number,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findAll(page, limit, undefined, serviceId, undefined);
  }

  async getOrdersByStatus(
    status: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findAll(page, limit, status, undefined, undefined);
  }

  async searchOrders(
    query: string,
    page: number = 1,
    limit: number = 10,
    serviceIds?: number[]
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        {
          Client: {
            name: { contains: query, mode: "insensitive" },
          },
        },
        {
          Service: {
            name: { contains: query, mode: "insensitive" },
          },
        },
      ],
    };

    // Add serviceIds filter if provided
    if (serviceIds && serviceIds.length > 0) {
      where.serviceId = { in: serviceIds };
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          Client: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          Service: {
            select: {
              id: true,
              name: true,
            },
          },
          BannerImage: {
            select: {
              id: true,
              fileUrl: true,
              fileType: true,
            },
          },
          Proposals: {
            take: 3,
            orderBy: { createdAt: "desc" },
            include: {},
          },
          questions: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        } as any,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Calculate credit cost for each order
    const ordersWithCreditCost = await Promise.all(
      orders.map(async (order) => {
        const creditCost = await this.orderPricingService.getCreditCost(
          order.budget || 0
        );
        return {
          ...order,
          creditCost,
        };
      })
    );

    return {
      orders: ordersWithCreditCost,
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

  async updateOrderStatus(orderId: number, status: string, userId: number) {
    // Validate that orderId is a valid number
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }

    // Check if order exists and user is the client
    const order = await this.prisma.order.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.clientId !== userId) {
      throw new BadRequestException("You can only update your own orders");
    }

    // Validate status
    const validStatuses = ["open", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    // Only log if status actually changed
    if (order.status !== status) {
      await this.logOrderChange(
        orderId,
        "status",
        order.status,
        status,
        userId
      );
    }

    return this.prisma.order.update({
      where: { id: Number(orderId) },
      data: { status },
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            Proposals: true,
            Reviews: true,
          },
        },
      },
    });
  }

  /**
   * Get order change history
   */
  async getOrderChangeHistory(orderId: number) {
    const history = await this.prisma.orderChangeHistory.findMany({
      where: { orderId },
      include: {
        ChangedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return history;
  }

  async getAvailableOrders(
    page: number = 1,
    limit: number = 10,
    serviceId?: number,
    location?: string,
    budgetMin?: number,
    budgetMax?: number
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      status: "open",
    };

    if (serviceId) {
      where.serviceId = serviceId;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          Client: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              verified: true,
            },
          },
          questions: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        } as any,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
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

  /**
   * Create order with media files in a transaction
   * If media file upload fails, the order creation is rolled back
   */
  async createOrderWithMedia(
    clientId: number,
    serviceId: number | undefined,
    title: string,
    description: string,
    budget: number,
    availableDates?: string[],
    location?: string,
    skills?: string[],
    mediaFiles: Array<{
      fileName: string;
      fileUrl: string;
      fileType: string;
      mimeType: string;
      fileSize: number;
    }> = [],
    useAIEnhancement: boolean = false,
    questions?: string[]
  ) {
    // Validate media files first (check if URLs are accessible)
    if (mediaFiles.length > 0) {
      await this.validateMediaFiles(mediaFiles);
    }

    // Check if client exists
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new BadRequestException(`Client with ID ${clientId} not found`);
    }

    // Handle AI enhancement if requested (before transaction)
    let titleEn: string | undefined;
    let titleRu: string | undefined;
    let titleHy: string | undefined;
    let descriptionEn: string | undefined;
    let descriptionRu: string | undefined;
    let descriptionHy: string | undefined;

    if (useAIEnhancement) {
      // Check if AI service is available
      if (!this.aiService.isAvailable()) {
        throw new BadRequestException(
          "AI enhancement is not available. Please contact support."
        );
      }

      // Check if user has sufficient credits
      if (client.creditBalance < this.AI_ENHANCEMENT_CREDIT_COST) {
        throw new BadRequestException(
          `Insufficient credit balance. Required: ${this.AI_ENHANCEMENT_CREDIT_COST} credits, Available: ${client.creditBalance} credits`
        );
      }

      try {
        // Enhance text with AI
        const enhanced = await this.aiService.enhanceOrderText(
          title,
          description
        );
        titleEn = enhanced.titleEn;
        titleRu = enhanced.titleRu;
        titleHy = enhanced.titleHy;
        descriptionEn = enhanced.descriptionEn;
        descriptionRu = enhanced.descriptionRu;
        descriptionHy = enhanced.descriptionHy;

        this.logger.log(
          `AI enhancement applied for order with media by user ${clientId}`
        );
      } catch (error) {
        this.logger.error("Error during AI enhancement:", error);
        // If AI enhancement fails, fall back to saving user input as-is
        this.logger.warn(
          "Falling back to saving user input without AI enhancement"
        );
      }
    }

    // Use Prisma transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Deduct credits if AI enhancement was used
      if (useAIEnhancement && titleEn && descriptionEn) {
        const updatedUser = await tx.user.update({
          where: { id: clientId },
          data: {
            creditBalance: { decrement: this.AI_ENHANCEMENT_CREDIT_COST },
          },
          select: { creditBalance: true },
        });

        // Log credit transaction
        await this.creditTransactionsService.logTransaction({
          userId: clientId,
          amount: -this.AI_ENHANCEMENT_CREDIT_COST,
          balanceAfter: updatedUser.creditBalance,
          type: "ai_enhancement",
          status: "completed",
          description: `AI enhancement for order creation with media`,
          referenceId: null,
          referenceType: null,
          metadata: {
            service: "order_creation_ai_enhancement",
            cost: this.AI_ENHANCEMENT_CREDIT_COST,
          },
          tx,
        });
      }

      // Create the order first
      const order = await tx.order.create({
        data: {
          clientId,
          serviceId,
          title,
          description,
          titleEn,
          titleRu,
          titleHy,
          descriptionEn,
          descriptionRu,
          descriptionHy,
          budget,
          availableDates: availableDates || [],
          location,
          skills: skills || [],
          status: "open",
          ...(questions && questions.length > 0
            ? {
                questions: {
                  create: questions
                    .filter((q) => q && q.trim().length > 0)
                    .map((question, index) => ({
                      question: question.trim(),
                      order: index,
                    })),
                },
              }
            : {}),
        } as any,
        include: {
          Client: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          Service: {
            select: {
              id: true,
              name: true,
            },
          },
          questions: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        } as any,
      });

      // Create media file records if any
      const createdMediaFiles: any[] = [];
      if (mediaFiles.length > 0) {
        for (const mediaFile of mediaFiles) {
          try {
            // Check if media file already exists (shouldn't happen, but check anyway)
            const existingMediaFile = await tx.mediaFile.findFirst({
              where: {
                fileUrl: mediaFile.fileUrl,
                orderId: order.id,
              },
            });

            if (existingMediaFile) {
              // Already exists, use it
              createdMediaFiles.push(existingMediaFile);
            } else {
              // Create new media file record
              const createdMediaFile = await tx.mediaFile.create({
                data: {
                  orderId: order.id,
                  fileName: mediaFile.fileName,
                  fileUrl: mediaFile.fileUrl,
                  fileType: mediaFile.fileType,
                  mimeType: mediaFile.mimeType,
                  fileSize: mediaFile.fileSize,
                  uploadedBy: clientId,
                },
              });
              createdMediaFiles.push(createdMediaFile);
            }
          } catch (error) {
            // If any media file creation fails, the transaction will be rolled back
            console.error("Failed to create media file:", error);
            throw new BadRequestException(
              `Failed to create media file: ${mediaFile.fileName}`
            );
          }
        }
      }

      // Log initial "open" status within transaction
      await this.logOrderChange(
        order.id,
        "status",
        null,
        "open",
        clientId,
        "Order created",
        tx
      );

      const result = {
        ...order,
        MediaFiles: createdMediaFiles,
      };

      // Send notifications to users who have notifications enabled for this service
      // Do this after transaction completes to avoid blocking the transaction
      if (serviceId) {
        // Use setImmediate to send notifications asynchronously after transaction
        setImmediate(async () => {
          await this.sendNewOrderNotifications(
            order.id,
            serviceId,
            order.title || ""
          );
        });
      }

      return result;
    });
  }

  /**
   * Send notifications to users who have notifications enabled for a service
   * when a new order is created for that service
   */
  private async sendNewOrderNotifications(
    orderId: number,
    serviceId: number,
    orderTitle: string
  ): Promise<void> {
    try {
      // Find all users who have notifications enabled for this service
      const userServices = await this.prisma.userService.findMany({
        where: {
          serviceId,
          notificationsEnabled: true,
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              fcmToken: true,
            },
          },
          Service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (userServices.length === 0) {
        this.logger.log(
          `No users with notifications enabled for service ${serviceId}`
        );
        return;
      }

      // Get service name for notification
      const serviceName =
        userServices[0]?.Service?.name || `Service #${serviceId}`;

      // Get the order to find the client ID (to exclude from notifications)
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { clientId: true },
      });

      const clientId = order?.clientId;

      // Send notification to each user (excluding the order creator)
      const notifications = userServices
        .filter(
          (us) =>
            us.User.fcmToken && // Only users with FCM tokens
            us.userId !== clientId // Don't notify the order creator
        )
        .map((us) =>
          this.notificationsService
            .createNotificationWithPush(
              us.userId,
              "new_order",
              "notificationNewOrderTitle",
              "notificationNewOrderMessage",
              {
                type: "order",
                orderId: orderId.toString(),
                serviceId: serviceId.toString(),
                serviceName: serviceName,
              },
              {
                orderTitle: orderTitle,
                serviceName: serviceName,
              }
            )
            .catch((error) => {
              this.logger.error(
                `Failed to send notification to user ${us.userId}:`,
                error
              );
            })
        );

      await Promise.all(notifications);

      this.logger.log(
        `Sent new order notifications to ${notifications.length} users for order ${orderId} in service ${serviceId}`
      );
    } catch (error) {
      this.logger.error(
        `Error sending new order notifications for order ${orderId}:`,
        error
      );
      // Don't throw - notification failure shouldn't break order creation
    }
  }

  /**
   * Save an order for later (bookmark)
   */
  async saveOrder(userId: number, orderId: number) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if already saved
    const existing = await this.prisma.savedOrder.findUnique({
      where: {
        userId_orderId: {
          userId,
          orderId,
        },
      },
    });

    if (existing) {
      return existing; // Already saved
    }

    // Create saved order
    return this.prisma.savedOrder.create({
      data: {
        userId,
        orderId,
      },
    });
  }

  /**
   * Unsave an order (remove bookmark)
   */
  async unsaveOrder(userId: number, orderId: number) {
    const savedOrder = await this.prisma.savedOrder.findUnique({
      where: {
        userId_orderId: {
          userId,
          orderId,
        },
      },
    });

    if (!savedOrder) {
      throw new NotFoundException("Order is not saved");
    }

    await this.prisma.savedOrder.delete({
      where: {
        id: savedOrder.id,
      },
    });

    return { success: true, message: "Order unsaved successfully" };
  }

  /**
   * Get all saved orders for a user
   */
  async getSavedOrders(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [savedOrders, total] = await Promise.all([
      this.prisma.savedOrder.findMany({
        where: { userId },
        include: {
          Order: {
            include: {
              Client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  verified: true,
                },
              },
              Service: {
                select: {
                  id: true,
                  name: true,
                  nameEn: true,
                  nameRu: true,
                  nameHy: true,
                },
              },
              MediaFiles: {
                select: {
                  id: true,
                  fileUrl: true,
                  fileType: true,
                },
                take: 1,
              },
              BannerImage: {
                select: {
                  id: true,
                  fileUrl: true,
                },
              },
              Proposals: {
                select: {
                  id: true,
                },
              },
              _count: {
                select: {
                  Proposals: true,
                  Reviews: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      this.prisma.savedOrder.count({
        where: { userId },
      }),
    ]);

    // Filter out any null orders (in case an order was deleted but savedOrder record still exists)
    const orders = savedOrders
      .map((so) => so.Order)
      .filter((order) => order != null);

    return {
      orders,
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
   * Check if an order is saved by a user
   */
  async isOrderSaved(userId: number, orderId: number): Promise<boolean> {
    const savedOrder = await this.prisma.savedOrder.findUnique({
      where: {
        userId_orderId: {
          userId,
          orderId,
        },
      },
    });

    return !!savedOrder;
  }

  /**
   * Validate media files before creating the order
   * Note: We don't check file accessibility via HTTP since files are stored in Vercel Blob
   * The files were just uploaded, so we trust they exist
   */
  private async validateMediaFiles(
    mediaFiles: Array<{
      fileName: string;
      fileUrl: string;
      fileType: string;
      mimeType: string;
      fileSize: number;
    }>
  ) {
    for (const mediaFile of mediaFiles) {
      try {
        // Validate file type
        const allowedTypes = ["image", "video"];
        if (!allowedTypes.includes(mediaFile.fileType)) {
          throw new BadRequestException(
            `Invalid file type: ${mediaFile.fileType}. Allowed types: ${allowedTypes.join(", ")}`
          );
        }

        // Validate file size (50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (mediaFile.fileSize > maxSize) {
          throw new BadRequestException(
            `File too large: ${mediaFile.fileName}. Maximum size: 50MB`
          );
        }

        // Validate required fields
        if (!mediaFile.fileName || !mediaFile.fileUrl || !mediaFile.mimeType) {
          throw new BadRequestException(
            `Missing required fields for media file: ${mediaFile.fileName}`
          );
        }

        console.log(`Validated media file: ${mediaFile.fileName}`);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Failed to validate media file: ${mediaFile.fileName}`
        );
      }
    }
  }
}
