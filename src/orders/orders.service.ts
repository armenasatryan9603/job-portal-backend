import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrderPricingService } from "../order-pricing/order-pricing.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private orderPricingService: OrderPricingService,
    private notificationsService: NotificationsService
  ) {}

  async createOrder(
    clientId: number,
    serviceId: number | undefined,
    title: string,
    description: string,
    budget: number,
    availableDates?: string[],
    location?: string,
    skills?: string[]
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

    const order = await this.prisma.order.create({
      data: {
        clientId,
        serviceId,
        title,
        description,
        budget,
        availableDates: formattedAvailableDates,
        location,
        skills: formattedSkills,
        status: "open",
      },
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
        _count: {
          select: {
            Proposals: true,
            Reviews: true,
          },
        },
      },
    });

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
    clientId?: number
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (serviceId) {
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
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        },
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
        _count: {
          select: {
            Proposals: true,
            Reviews: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Calculate credit cost for the order
    const creditCost = await this.orderPricingService.getCreditCost(
      order.budget || 0
    );

    return {
      ...order,
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
    }
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

    return this.prisma.order.update({
      where: { id: Number(id) },
      data: updateOrderDto,
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
    return this.findAll(page, limit, undefined, undefined, clientId);
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
    return this.findAll(page, limit, undefined, serviceId);
  }

  async getOrdersByStatus(
    status: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findAll(page, limit, status);
  }

  async searchOrders(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
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
        },
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
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({
        where: {
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
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        },
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
    }> = []
  ) {
    // Validate media files first (check if URLs are accessible)
    if (mediaFiles.length > 0) {
      await this.validateMediaFiles(mediaFiles);
    }

    // Use Prisma transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Create the order first
      const order = await tx.order.create({
        data: {
          clientId,
          serviceId,
          title,
          description,
          budget,
          availableDates: availableDates || [],
          location,
          skills: skills || [],
          status: "open",
        },
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
          _count: {
            select: {
              Proposals: true,
              Reviews: true,
            },
          },
        },
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
              "New Order Available!",
              `A new order "${orderTitle}" has been posted in ${serviceName}. Check it out!`,
              {
                type: "order",
                orderId: orderId.toString(),
                serviceId: serviceId.toString(),
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
