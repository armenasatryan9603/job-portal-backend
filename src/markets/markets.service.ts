import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { NotificationsService } from "../notifications/notifications.service";

interface SubscriptionFeatures {
  unlimitedApplications?: boolean;
  publishPermanentOrders?: boolean;
  publishMarkets?: boolean;
  prioritySupport?: boolean;
  advancedFilters?: boolean;
  featuredProfile?: boolean;
}

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    private prisma: PrismaService,
    private subscriptionsService: SubscriptionsService,
    private notificationsService: NotificationsService
  ) {}

  /**
   * Validate that user can create a market (must be specialist)
   */
  private async validateMarketCreation(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        UserCategories: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.UserCategories || user.UserCategories.length === 0) {
      throw new BadRequestException(
        "Only specialists can create markets. Please add your expertise first."
      );
    }

    return user;
  }

  /**
   * Validate that user can publish a market (must have active subscription)
   */
  private async validateMarketPublishing(marketId: number, userId: number) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        Creator: {
          include: {
            Subscriptions: {
              where: {
                status: "active",
                endDate: {
                  gte: new Date(),
                },
              },
            },
          },
        },
        Subscriptions: {
          where: {
            status: "active",
            endDate: {
              gte: new Date(),
            },
          },
          include: {
            SubscriptionPlan: true,
          },
        },
      },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    if (market.createdBy !== userId) {
      throw new ForbiddenException("You can only publish your own markets");
    }

    // Check for market-specific subscription with publishMarkets feature
    const hasFeature = market.Subscriptions?.some(
      (sub) => {
        if (
          sub.status !== "active" ||
          new Date(sub.endDate) <= new Date() ||
          !sub.SubscriptionPlan?.features
        ) {
          return false;
        }
        const features = sub.SubscriptionPlan.features as SubscriptionFeatures;
        return features.publishMarkets === true;
      }
    );

    if (!hasFeature) {
      throw new BadRequestException(
        "A subscription with 'publishMarkets' feature is required to publish markets."
      );
    }

    return market;
  }

  /**
   * Calculate average rating for a market
   */
  async calculateRating(marketId: number): Promise<number> {
    const reviews = await this.prisma.marketReview.findMany({
      where: { marketId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return 0;
    }

    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }

  /**
   * Create a new market (as draft)
   */
  async createMarket(
    userId: number,
    data: {
      name: string;
      nameEn?: string;
      nameRu?: string;
      nameHy?: string;
      description?: string;
      descriptionEn?: string;
      descriptionRu?: string;
      descriptionHy?: string;
      location?: string;
      weeklySchedule?: any;
    }
  ) {
    // Validate user can create market
    await this.validateMarketCreation(userId);

    // Create market as draft
    const market = await this.prisma.market.create({
      data: {
        name: data.name,
        nameEn: data.nameEn,
        nameRu: data.nameRu,
        nameHy: data.nameHy,
        description: data.description,
        descriptionEn: data.descriptionEn,
        descriptionRu: data.descriptionRu,
        descriptionHy: data.descriptionHy,
        location: data.location,
        weeklySchedule: data.weeklySchedule,
        status: "draft",
        createdBy: userId,
        verified: false,
      },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Members: {
          where: {
            isActive: true,
          },
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
        _count: {
          select: {
            Orders: true,
            Reviews: true,
            MediaFiles: true,
          },
        },
      },
    });

    // Add creator as owner member
    await this.prisma.marketMember.create({
      data: {
        marketId: market.id,
        userId: userId,
        role: "owner",
        status: "accepted",
        isActive: true,
      },
    });

    this.logger.log(`Market ${market.id} created by user ${userId}`);

    return market;
  }

  /**
   * Publish a market (requires subscription)
   */
  async publishMarket(marketId: number, userId: number) {
    // Validate publishing
    await this.validateMarketPublishing(marketId, userId);

    // Check if already published
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    if (market.status !== "draft") {
      throw new BadRequestException("Market is already published");
    }

    // Check if market has active subscription - if yes, set to active, otherwise pending_review
    const marketWithSubscription = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        Subscriptions: {
          where: {
            status: "active",
            endDate: {
              gte: new Date(),
            },
          },
        },
      },
    });

    // Update status: active if subscription exists, otherwise pending_review
    const newStatus = marketWithSubscription?.Subscriptions && marketWithSubscription.Subscriptions.length > 0
      ? "active"
      : "pending_review";

    const updatedMarket = await this.prisma.market.update({
      where: { id: marketId },
      data: { status: newStatus },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Members: {
          where: {
            isActive: true,
          },
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
        _count: {
          select: {
            Orders: true,
            Reviews: true,
            MediaFiles: true,
          },
        },
      },
    });

    // Send notification to creator
    const notificationMessage = newStatus === "active"
      ? `Your market "${market.name}" has been published and is now live.`
      : `Your market "${market.name}" has been submitted for review.`;
    
    await this.notificationsService.createNotificationWithPush(
      userId,
      "market_published",
      "Market Published",
      notificationMessage,
      {
        marketId: market.id,
        marketName: market.name,
      }
    );

    this.logger.log(
      `Market ${marketId} published by user ${userId} - status: ${newStatus}`
    );

    return updatedMarket;
  }

  /**
   * Get market by ID
   */
  async getMarketById(marketId: number) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
        BannerImage: {
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
          },
        },
        Members: {
          where: {
            isActive: true,
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                verified: true,
              },
            },
          },
        },
        Orders: {
          include: {
            Order: {
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
                Category: true,
                BannerImage: {
                  select: {
                    id: true,
                    fileUrl: true,
                    fileType: true,
                  },
                },
                MediaFiles: {
                  take: 1,
                },
              },
            },
          },
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
          take: 10,
        },
        MediaFiles: {
          orderBy: { createdAt: "desc" },
        },
        Roles: {
          where: {
            OR: [{ isDefault: true }, { marketId: marketId }],
          },
        },
        _count: {
          select: {
            Orders: true,
            Reviews: true,
            MediaFiles: true,
            Members: true,
          },
        },
      },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Calculate rating
    const rating = await this.calculateRating(marketId);

    return {
      ...market,
      rating,
    };
  }

  /**
   * Get markets with filters
   */
  async getMarkets(filters: {
    status?: string;
    location?: string;
    verified?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    createdBy?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by creator if provided
    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
      // When viewing own services, show all statuses (don't filter by status)
    } else if (filters.status) {
      where.status = filters.status;
    } else {
      // Default: only show active markets to public
      where.status = "active";
    }

    if (filters.verified !== undefined) {
      where.verified = filters.verified;
    }

    if (filters.location) {
      where.location = {
        contains: filters.location,
        mode: "insensitive",
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { nameEn: { contains: filters.search, mode: "insensitive" } },
        { nameRu: { contains: filters.search, mode: "insensitive" } },
        { nameHy: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [markets, total] = await Promise.all([
      this.prisma.market.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          Creator: {
            select: {
              id: true,
              name: true,
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
          _count: {
            select: {
              Orders: true,
              Reviews: true,
              Members: true,
            },
          },
        },
      }),
      this.prisma.market.count({ where }),
    ]);

    // Calculate ratings for each market
    const marketsWithRatings = await Promise.all(
      markets.map(async (market) => {
        const rating = await this.calculateRating(market.id);
        return {
          ...market,
          rating,
        };
      })
    );

    return {
      markets: marketsWithRatings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update market
   */
  async updateMarket(
    marketId: number,
    userId: number,
    data: {
      name?: string;
      nameEn?: string;
      nameRu?: string;
      nameHy?: string;
      description?: string;
      descriptionEn?: string;
      descriptionRu?: string;
      descriptionHy?: string;
      location?: string;
      weeklySchedule?: any;
    }
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Check ownership or admin role
    if (market.createdBy !== userId) {
      // Check if user is a member with admin/owner role
      const member = await this.prisma.marketMember.findFirst({
        where: {
          marketId: marketId,
          userId: userId,
          isActive: true,
          status: "accepted",
          role: {
            in: ["owner", "admin"],
          },
        },
      });

      if (!member) {
        throw new ForbiddenException(
          "You can only update markets you own or have admin access to"
        );
      }
    }

    const updatedMarket = await this.prisma.market.update({
      where: { id: marketId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
        ...(data.nameRu !== undefined && { nameRu: data.nameRu }),
        ...(data.nameHy !== undefined && { nameHy: data.nameHy }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.descriptionEn !== undefined && {
          descriptionEn: data.descriptionEn,
        }),
        ...(data.descriptionRu !== undefined && {
          descriptionRu: data.descriptionRu,
        }),
        ...(data.descriptionHy !== undefined && {
          descriptionHy: data.descriptionHy,
        }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.weeklySchedule !== undefined && { weeklySchedule: data.weeklySchedule }),
      },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            Orders: true,
            Reviews: true,
            MediaFiles: true,
          },
        },
      },
    });

    return updatedMarket;
  }

  /**
   * Admin approve market
   */
  async approveMarket(marketId: number, adminId: number) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            fcmToken: true,
          },
        },
      },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    if (market.status !== "pending_review") {
      throw new BadRequestException(
        `Market is not pending review. Current status: ${market.status}`
      );
    }

    const updatedMarket = await this.prisma.market.update({
      where: { id: marketId },
      data: {
        status: "active",
        rejectionReason: null,
      },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            Orders: true,
            Reviews: true,
            MediaFiles: true,
          },
        },
      },
    });

    // Send notification to creator
    await this.notificationsService.createNotificationWithPush(
      market.createdBy,
      "market_approved",
      "Market Approved",
      `Your market "${market.name}" has been approved and is now live.`,
      {
        marketId: market.id,
        marketName: market.name,
      }
    );

    this.logger.log(`Market ${marketId} approved by admin ${adminId}`);

    return updatedMarket;
  }

  /**
   * Admin reject market
   */
  async rejectMarket(
    marketId: number,
    adminId: number,
    rejectionReason: string
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            fcmToken: true,
          },
        },
      },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    if (market.status !== "pending_review") {
      throw new BadRequestException(
        `Market is not pending review. Current status: ${market.status}`
      );
    }

    const updatedMarket = await this.prisma.market.update({
      where: { id: marketId },
      data: {
        status: "rejected",
        rejectionReason,
      },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Send notification to creator
    await this.notificationsService.createNotificationWithPush(
      market.createdBy,
      "market_rejected",
      "Market Rejected",
      `Your market "${market.name}" has been rejected. Reason: ${rejectionReason}`,
      {
        marketId: market.id,
        marketName: market.name,
        rejectionReason,
      }
    );

    this.logger.log(
      `Market ${marketId} rejected by admin ${adminId}. Reason: ${rejectionReason}`
    );

    return updatedMarket;
  }

  /**
   * Add member to market
   */
  async addMember(
    marketId: number,
    userId: number,
    requestingUserId: number,
    role: string = "member"
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Check if requester has permission (owner or admin)
    const requesterMember = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        userId: requestingUserId,
        isActive: true,
        status: "accepted",
        role: {
          in: ["owner", "admin"],
        },
      },
    });

    if (!requesterMember && market.createdBy !== requestingUserId) {
      throw new ForbiddenException(
        "Only owners and admins can add members to markets"
      );
    }

    // Check if user is already a member
    const existingMember = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        userId: userId,
      },
    });

    if (existingMember) {
      if (existingMember.isActive && existingMember.status === "accepted") {
        throw new BadRequestException("User is already a member of this market");
      } else if (existingMember.isActive && existingMember.status === "pending") {
        // Update existing pending invitation with new role
        return this.prisma.marketMember.update({
          where: { id: existingMember.id },
          data: {
            role,
          },
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
        });
      } else {
        // Reactivate member with pending status
        const reactivatedMember = await this.prisma.marketMember.update({
          where: { id: existingMember.id },
          data: {
            isActive: true,
            status: "pending",
            role,
          },
          include: {
            Market: {
              select: {
                id: true,
                name: true,
              },
            },
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        });

        // Send notification for reactivated invitation
        try {
          await this.notificationsService.createNotificationWithPush(
            userId,
            "market_invitation",
            "notificationMarketInvitationTitle",
            "notificationMarketInvitationMessage",
            {
              type: "market_invitation",
              marketMemberId: reactivatedMember.id.toString(),
              marketId: marketId.toString(),
              marketName: market.name,
              inviterId: requestingUserId.toString(),
            },
            {
              marketName: market.name,
            }
          );
        } catch (error) {
          this.logger.error(
            `Failed to send market invitation notification to user ${userId}:`,
            error
          );
        }

        return reactivatedMember;
      }
    }

    // Create pending market member invitation
    // Set isActive: true so the market creator can see it in their list
    const member = await this.prisma.marketMember.create({
      data: {
        marketId: marketId,
        userId: userId,
        role,
        status: "pending", // Pending invitation
        isActive: true, // Active so market creator can see pending invitations
      },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Send notification to the invited user
    try {
      await this.notificationsService.createNotificationWithPush(
        userId,
        "market_invitation",
        "notificationMarketInvitationTitle",
        "notificationMarketInvitationMessage",
        {
          type: "market_invitation",
          marketMemberId: member.id.toString(),
          marketId: marketId.toString(),
          marketName: market.name,
          inviterId: requestingUserId.toString(),
        },
        {
          marketName: market.name,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send market invitation notification to user ${userId}:`,
        error
      );
      // Don't fail the operation if notification fails
    }

    return member;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    marketId: number,
    memberId: number,
    requestingUserId: number,
    newRole: string
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Check if requester has permission (owner only)
    const requesterMember = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        userId: requestingUserId,
        isActive: true,
        status: "accepted",
        role: "owner",
      },
    });

    if (!requesterMember && market.createdBy !== requestingUserId) {
      throw new ForbiddenException(
        "Only owners can update member roles"
      );
    }

    const member = await this.prisma.marketMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.marketId !== marketId) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    const updatedMember = await this.prisma.marketMember.update({
      where: { id: memberId },
      data: { role: newRole },
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
    });

    return updatedMember;
  }

  /**
   * Accept market invitation
   */
  async acceptMarketInvitation(userId: number, marketMemberId: number) {
    const marketMember = await this.prisma.marketMember.findUnique({
      where: { id: marketMemberId },
      include: {
        Market: {
          include: {
            Creator: {
              select: { id: true, name: true },
            },
            Members: {
              where: {
                isActive: true,
                status: "accepted",
              },
              include: {
                User: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        User: {
          select: { id: true, name: true },
        },
      },
    });

    if (!marketMember) {
      throw new NotFoundException("Market invitation not found");
    }

    if (marketMember.userId !== userId) {
      throw new BadRequestException(
        "You can only accept invitations sent to you"
      );
    }

    if (marketMember.status !== "pending") {
      throw new BadRequestException("Invitation is not pending");
    }

    // Update market member to accepted
    const updated = await this.prisma.marketMember.update({
      where: { id: marketMemberId },
      data: {
        status: "accepted",
      },
      include: {
        Market: {
          include: {
            Creator: {
              select: { id: true, name: true },
            },
            Members: {
              where: {
                isActive: true,
                status: "accepted",
              },
              include: {
                User: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        User: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Send notification to market creator
    try {
      await this.notificationsService.createNotificationWithPush(
        marketMember.Market.createdBy,
        "market_invitation_accepted",
        "notificationMarketInvitationAcceptedTitle",
        "notificationMarketInvitationAcceptedMessage",
        {
          type: "market_invitation_accepted",
          marketMemberId: updated.id.toString(),
          marketId: marketMember.Market.id.toString(),
          marketName: marketMember.Market.name,
          userId: userId.toString(),
        },
        {
          userName: updated.User.name,
          marketName: marketMember.Market.name,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send market invitation accepted notification:`,
        error
      );
    }

    return updated;
  }

  /**
   * Reject market invitation
   */
  async rejectMarketInvitation(userId: number, marketMemberId: number) {
    const marketMember = await this.prisma.marketMember.findUnique({
      where: { id: marketMemberId },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
            createdBy: true,
          },
        },
        User: {
          select: { id: true, name: true },
        },
      },
    });

    if (!marketMember) {
      throw new NotFoundException("Market invitation not found");
    }

    if (marketMember.userId !== userId) {
      throw new BadRequestException(
        "You can only reject invitations sent to you"
      );
    }

    if (marketMember.status !== "pending") {
      throw new BadRequestException("Invitation is not pending");
    }

    // Update market member to rejected
    const updated = await this.prisma.marketMember.update({
      where: { id: marketMemberId },
      data: {
        status: "rejected",
        isActive: false,
      },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
          },
        },
        User: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Send notification to market creator
    try {
      await this.notificationsService.createNotificationWithPush(
        marketMember.Market.createdBy,
        "market_invitation_rejected",
        "notificationMarketInvitationRejectedTitle",
        "notificationMarketInvitationRejectedMessage",
        {
          type: "market_invitation_rejected",
          marketMemberId: updated.id.toString(),
          marketId: marketMember.Market.id.toString(),
          marketName: marketMember.Market.name,
          userId: userId.toString(),
        },
        {
          userName: updated.User.name,
          marketName: marketMember.Market.name,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send market invitation rejected notification:`,
        error
      );
    }

    return updated;
  }

  /**
   * Get pending market invitations (received)
   */
  async getPendingMarketInvitations(userId: number) {
    const invitations = await this.prisma.marketMember.findMany({
      where: {
        userId,
        status: "pending",
        isActive: true,
      },
      include: {
        Market: {
          include: {
            Creator: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    return invitations;
  }

  /**
   * Remove member from market
   */
  async removeMember(
    marketId: number,
    memberId: number,
    requestingUserId: number
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Check if requester has permission (owner or admin)
    const requesterMember = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        userId: requestingUserId,
        isActive: true,
        status: "accepted",
        role: {
          in: ["owner", "admin"],
        },
      },
    });

    if (!requesterMember && market.createdBy !== requestingUserId) {
      throw new ForbiddenException(
        "Only owners and admins can remove members from markets"
      );
    }

    const member = await this.prisma.marketMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.marketId !== marketId) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    // Don't allow removing the owner
    if (member.role === "owner") {
      throw new BadRequestException("Cannot remove the owner from a market");
    }

    await this.prisma.marketMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    return { success: true };
  }

  /**
   * Attach permanent order to market
   */
  async addOrder(
    marketId: number,
    orderId: number,
    requestingUserId: number
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Only the owner (creator) can attach orders to markets
    if (market.createdBy !== requestingUserId) {
      throw new ForbiddenException(
        "Only the owner can attach orders to markets"
      );
    }

    // Check if order exists and is permanent
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.orderType !== "permanent") {
      throw new BadRequestException(
        "Only permanent orders can be attached to markets"
      );
    }

    // Check if already attached
    const existing = await this.prisma.marketOrder.findFirst({
      where: {
        marketId: marketId,
        orderId: orderId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        "Order is already attached to this market"
      );
    }

    const marketOrder = await this.prisma.marketOrder.create({
      data: {
        marketId: marketId,
        orderId: orderId,
      },
      include: {
        Order: {
          include: {
            Client: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            Category: true,
          },
        },
      },
    });

    return marketOrder;
  }

  /**
   * Detach order from market
   */
  async removeOrder(
    marketId: number,
    orderId: number,
    requestingUserId: number
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Only the owner (creator) can detach orders from markets
    if (market.createdBy !== requestingUserId) {
      throw new ForbiddenException(
        "Only the owner can detach orders from markets"
      );
    }

    const marketOrder = await this.prisma.marketOrder.findFirst({
      where: {
        marketId: marketId,
        orderId: orderId,
      },
    });

    if (!marketOrder) {
      throw new NotFoundException(
        "Order is not attached to this market"
      );
    }

    await this.prisma.marketOrder.delete({
      where: { id: marketOrder.id },
    });

    return { success: true };
  }

  /**
   * Set banner image for market
   */
  async setBannerImage(marketId: number, mediaFileId: number) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    const mediaFile = await this.prisma.marketMediaFile.findFirst({
      where: {
        id: mediaFileId,
        marketId: marketId,
        fileType: "image",
      },
    });

    if (!mediaFile) {
      throw new NotFoundException(
        `Media file with ID ${mediaFileId} not found or is not an image for this market`
      );
    }

    const updatedMarket = await this.prisma.market.update({
      where: { id: marketId },
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

    return updatedMarket;
  }
}
