import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { AIService } from "../ai/ai.service";
import { CreditTransactionsService } from "../credit/credit-transactions.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderPricingService } from "../order-pricing/order-pricing.service";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { PusherService } from "../pusher/pusher.service";
import { SkillsService } from "../skills/skills.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

interface SubscriptionFeatures {
  unlimitedApplications?: boolean;
  publishPermanentOrders?: boolean;
  publishMarkets?: boolean;
  prioritySupport?: boolean;
  advancedFilters?: boolean;
  featuredProfile?: boolean;
}

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
    private creditTransactionsService: CreditTransactionsService,
    private skillsService: SkillsService,
    private subscriptionsService: SubscriptionsService,
    private pusherService: PusherService,
  ) {}

  /**
   * Helper method to check if a booking would be affected by schedule changes
   */
  private isBookingAffectedByScheduleChange(
    booking: { scheduledDate: string; startTime: string; endTime: string },
    oldSchedule: any,
    newSchedule: any,
    oldAvailableDates?: string[],
    newAvailableDates?: string[]
  ): boolean {
    // Check if schedule is actually changing
    const scheduleChanged =
      newSchedule !== undefined &&
      JSON.stringify(oldSchedule) !== JSON.stringify(newSchedule);
    const datesChanged =
      newAvailableDates !== undefined &&
      JSON.stringify(oldAvailableDates) !== JSON.stringify(newAvailableDates);

    if (!scheduleChanged && !datesChanged) {
      return false; // No change, booking not affected
    }

    // For permanent orders with weeklySchedule
    if (scheduleChanged && (newSchedule || oldSchedule)) {
      // If schedule is being removed entirely
      if (newSchedule === null || newSchedule === undefined) {
        return true; // All bookings are affected
      }

      const bookingDate = new Date(booking.scheduledDate);
      const dayOfWeek = bookingDate.getDay();
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayName = dayNames[dayOfWeek];
      const newDaySchedule = newSchedule[dayName];
      const oldDaySchedule = oldSchedule?.[dayName];

      // Check if day was enabled in old schedule
      const wasEnabled = oldDaySchedule?.enabled === true;

      // Check if day is enabled in new schedule
      const isEnabled = newDaySchedule?.enabled === true;

      // If day was enabled but is now disabled, booking is affected
      if (wasEnabled && !isEnabled) {
        return true;
      }

      // If day is enabled in new schedule, check work hours
      if (isEnabled && newDaySchedule?.workHours) {
        const { start, end } = newDaySchedule.workHours;
        // Check if booking time is within new work hours
        if (booking.startTime < start || booking.endTime > end) {
          return true; // Booking time is outside new work hours
        }
      }

      return false; // Booking is still valid
    }

    // For legacy availableDates
    if (datesChanged) {
      const datesToCheck = newAvailableDates || [];

      // Check if booking date is in the new available dates
      const bookingDateStr = booking.scheduledDate;
      const dateFound = datesToCheck.some((dateStr: string) => {
        try {
          const parsed = JSON.parse(dateStr);
          if (parsed.date === bookingDateStr) {
            // Check if the time slot is still available
            const times = parsed.times || [];
            const bookingTimeSlot = `${booking.startTime}-${booking.endTime}`;
            return times.includes(bookingTimeSlot);
          }
        } catch (e) {
          // If parsing fails, try direct comparison
          return dateStr === bookingDateStr;
        }
        return false;
      });

      return !dateFound; // If date not found, booking is affected
    }

    return false; // No schedule change, booking not affected
  }

  /**
   * Helper method to cancel affected bookings and send notifications
   */
  private async cancelAffectedBookings(
    bookings: Array<{
      id: number;
      scheduledDate: string;
      startTime: string;
      endTime: string;
      clientId: number;
      Client?: { name: string };
    }>,
    orderId: number
  ): Promise<void> {
    if (bookings.length === 0) return;

    // Cancel all affected bookings
    await this.prisma.booking.updateMany({
      where: {
        id: { in: bookings.map((b) => b.id) },
      },
      data: {
        status: "cancelled",
      },
    });

    // Send notifications to clients
    for (const booking of bookings) {
      try {
        await this.notificationsService.createNotificationWithPush(
          booking.clientId,
          "booking_cancelled",
          "Booking Cancelled",
          `Your booking on ${booking.scheduledDate} from ${booking.startTime} to ${booking.endTime} has been cancelled because the specialist removed that availability.`,
          {
            bookingId: booking.id,
            orderId: orderId,
            scheduledDate: booking.scheduledDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: "schedule_removed",
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send notification for cancelled booking ${booking.id}:`,
          error
        );
      }
    }

    this.logger.log(
      `Cancelled ${bookings.length} booking(s) for order ${orderId} due to schedule change`
    );
  }

  /**
   * Helper method to check if a booking overlaps with breaks
   */
  private doesBookingOverlapWithBreaks(
    booking: { scheduledDate: string; startTime: string; endTime: string },
    weeklySchedule: any
  ): { overlaps: boolean; overlappingBreaks: Array<{ start: string; end: string }> } {
    if (!weeklySchedule) {
      return { overlaps: false, overlappingBreaks: [] };
    }

    const bookingDate = new Date(booking.scheduledDate);
    const dayOfWeek = bookingDate.getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[dayOfWeek];
    const daySchedule = weeklySchedule[dayName];

    if (!daySchedule?.enabled || !daySchedule?.breaks || daySchedule.breaks.length === 0) {
      return { overlaps: false, overlappingBreaks: [] };
    }

    // Check for break exclusions (priority bookings)
    const breakExclusions = weeklySchedule.breakExclusions || {};
    const exclusionsForDate = breakExclusions[booking.scheduledDate] || [];

    // Filter out excluded breaks
    const activeBreaks = daySchedule.breaks.filter((breakItem: { start: string; end: string }) => {
      return !exclusionsForDate.some(
        (exclusion: { start: string; end: string }) =>
          exclusion.start === breakItem.start && exclusion.end === breakItem.end
      );
    });

    const overlappingBreaks: Array<{ start: string; end: string }> = [];

    // Check if booking overlaps with any break
    for (const breakItem of activeBreaks) {
      const breakStart = this.timeToMinutes(breakItem.start);
      const breakEnd = this.timeToMinutes(breakItem.end);
      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = this.timeToMinutes(booking.endTime);

      // Check if time ranges overlap
      if (bookingStart < breakEnd && bookingEnd > breakStart) {
        overlappingBreaks.push(breakItem);
      }
    }

    return {
      overlaps: overlappingBreaks.length > 0,
      overlappingBreaks,
    };
  }

  /**
   * Helper method to convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Helper method to notify clients about break overlaps
   */
  private async notifyBreakOverlaps(
    bookings: Array<{
      id: number;
      scheduledDate: string;
      startTime: string;
      endTime: string;
      clientId: number;
      Client?: { name: string };
      MarketMember?: {
        User?: {
          id: number;
          name: string;
        };
      };
    }>,
    orderId: number,
    orderTitle: string,
    weeklySchedule: any,
    resourceBookingMode?: "select" | "auto" | "multi" | null
  ): Promise<void> {
    if (bookings.length === 0) return;

    // Send notifications to clients
    for (const booking of bookings) {
      try {
        const { overlappingBreaks } = this.doesBookingOverlapWithBreaks(booking, weeklySchedule);
        
        if (overlappingBreaks.length === 0) {
          continue; // Skip if no overlaps (shouldn't happen, but safety check)
        }

        const breakTimes = overlappingBreaks
          .map((b) => `${b.start}-${b.end}`)
          .join(", ");

        // Build notification message with specialist info if resourceBookingMode is "select"
        let specialistInfo = "";
        if (resourceBookingMode === "select" && booking.MarketMember?.User) {
          specialistInfo = ` with ${booking.MarketMember.User.name}`;
        }

        await this.notificationsService.createNotificationWithPush(
          booking.clientId,
          "booking_break_overlap",
          "Booking Overlaps with Break",
          `Your booking${specialistInfo} on ${booking.scheduledDate} from ${booking.startTime} to ${booking.endTime} for "${orderTitle}" now overlaps with a break period (${breakTimes}). Please contact the specialist if you need to reschedule.`,
          {
            bookingId: booking.id,
            orderId: orderId,
            scheduledDate: booking.scheduledDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: "break_overlap",
            breakTimes: breakTimes,
            ...(resourceBookingMode === "select" && booking.MarketMember?.User ? {
              specialistId: booking.MarketMember.User.id,
              specialistName: booking.MarketMember.User.name,
            } : {}),
          }
        );

        // Send real-time Pusher notification
        await this.pusherService.trigger(
          `user-${booking.clientId}`,
          "booking-break-overlap",
          {
            bookingId: booking.id,
            orderId: orderId,
            scheduledDate: booking.scheduledDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            orderTitle,
            breakTimes,
            ...(resourceBookingMode === "select" && booking.MarketMember?.User ? {
              specialistId: booking.MarketMember.User.id,
              specialistName: booking.MarketMember.User.name,
            } : {}),
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send break overlap notification for booking ${booking.id}:`,
          error
        );
      }
    }

    this.logger.log(
      `Notified ${bookings.length} client(s) about break overlaps for order ${orderId}`
    );
  }

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
    categoryId: number | undefined,
    title: string,
    description: string,
    budget: number,
    location: string,
    currency?: string,
    rateUnit?: string,
    availableDates?: string[],
    skills?: string[],
    skillIds?: number[],
    useAIEnhancement: boolean = false,
    questions?: string[],
    orderType: string = "one_time",
    workDurationPerClient?: number,
    weeklySchedule?: any,
    checkinRequiresApproval: boolean = false,
    resourceBookingMode?: "select" | "auto" | "multi",
    requiredResourceCount?: number
  ) {
    // Validate location is provided and not empty
    if (!location || !location.trim()) {
      throw new BadRequestException("Location is required");
    }
    // Check if client exists
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      include: {
        UserCategories: true,
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

    if (!client) {
      throw new BadRequestException(`Client with ID ${clientId} not found`);
    }

    // For permanent orders, only check if user is a specialist (not subscription)
    // Subscription will be checked when publishing
    if (orderType === "permanent") {
      if (!client.UserCategories || client.UserCategories.length === 0) {
        throw new BadRequestException(
          "Only specialists can create permanent orders. Please add your expertise first."
        );
      }
    }

    // If categoryId is provided, check if category exists
    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        throw new BadRequestException(
          `Category with ID ${categoryId} not found`
        );
      }
    }

    // Ensure arrays are properly formatted
    const formattedAvailableDates = Array.isArray(availableDates)
      ? availableDates
      : availableDates
        ? [availableDates]
        : [];

    // Handle skills: support both skillIds (new) and skills (backward compatibility)
    // When both are present, combine them (skillIds for existing, skills for new ones to create)
    this.logger.log(
      `[createOrder] Received skillIds: ${JSON.stringify(skillIds)}, skills: ${JSON.stringify(skills)}`
    );
    let finalSkillIds: number[] = [];

    // First, add existing skill IDs
    if (skillIds && skillIds.length > 0) {
      finalSkillIds = skillIds.filter((id) => !isNaN(id) && id > 0);
      this.logger.log(
        `[createOrder] Added existing skillIds: ${JSON.stringify(finalSkillIds)}`
      );
    }

    // Then, handle new skills (skill names without IDs)
    // This can happen when both skillIds and skills are sent (mixed scenario)
    if (skills && skills.length > 0) {
      const skillNames = skills.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0
      );
      this.logger.log(
        `[createOrder] Processing new skill names: ${JSON.stringify(skillNames)}`
      );

      if (skillNames.length > 0) {
        const createdSkills =
          await this.skillsService.findOrCreateSkills(skillNames);
        this.logger.log(
          `[createOrder] Created/found ${createdSkills.length} skills`
        );
        const newSkillIds = createdSkills.map((s) => s.id);
        // Combine existing skillIds with newly created skill IDs
        finalSkillIds = [...finalSkillIds, ...newSkillIds];
        this.logger.log(
          `[createOrder] Final skillIds: ${JSON.stringify(finalSkillIds)}`
        );
      }
    }

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
        categoryId,
        title,
        description,
        titleEn,
        titleRu,
        titleHy,
        descriptionEn,
        descriptionRu,
        descriptionHy,
        budget,
        currency: currency || undefined,
        rateUnit: rateUnit || undefined,
        availableDates: formattedAvailableDates,
        location,
        status: orderType === "permanent" ? "draft" : "pending_review",
        orderType: orderType || "one_time",
        workDurationPerClient: workDurationPerClient || undefined,
        weeklySchedule:
          orderType === "permanent" && weeklySchedule
            ? weeklySchedule
            : orderType === "permanent" && workDurationPerClient
              ? this.generateWeeklySchedule(workDurationPerClient)
              : undefined,
        checkinRequiresApproval: orderType === "permanent" ? checkinRequiresApproval : false,
        resourceBookingMode: resourceBookingMode || undefined,
        requiredResourceCount: requiredResourceCount || undefined,
        ...(finalSkillIds.length > 0
          ? {
              OrderSkills: {
                create: finalSkillIds.map((skillId) => ({
                  skillId,
                })),
              },
            }
          : {}),
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
        Category: true,
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

    // Log initial "pending_review" status
    await this.logOrderChange(
      order.id,
      "status",
      null,
      "pending_review",
      clientId,
      "Order created - pending admin review"
    );

    // ✅ Notifications will be sent when order is approved (status changes to "open")
    // Do not send notifications here because order is still "pending_review"

    return order;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    categoryId?: number,
    categoryIds?: number[],
    clientId?: number,
    isAdmin: boolean = false,
    userId?: number,
    orderType?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    // Handle "not_applied" status specially
    if (status === "not_applied") {
      if (!userId) {
        // If user is not authenticated, "not_applied" doesn't make sense
        // Return empty results or treat as "all"
        this.logger.warn(
          "not_applied status requested but user is not authenticated"
        );
        // Return empty results
        return {
          orders: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      // Get all order IDs that the user has applied to
      const proposals = await this.prisma.orderProposal.findMany({
        where: {
          userId: userId,
        },
        select: {
          orderId: true,
        },
      });

      // Extract unique order IDs
      const appliedOrderIds = Array.from(
        new Set(proposals.map((p) => p.orderId))
      );

      this.logger.debug(
        `User ${userId} has applied to ${appliedOrderIds.length} orders`
      );

      // Filter out:
      // 1. Orders the user has applied to
      // 2. Orders the user created
      if (appliedOrderIds.length > 0) {
        where.id = {
          notIn: appliedOrderIds,
        };
      }

      // Filter out orders the user created
      where.clientId = {
        not: userId,
      };

      // "not_applied" should only show "open" orders
      where.status = "open";
    } else if (status && status !== "all") {
      // Apply specific status filter (skip if status is "all")
      where.status = status;
    } else if (!isAdmin && !clientId && status !== "all") {
      // For public queries (non-admin, not viewing own orders), exclude draft, pending_review and rejected
      // But only if status is not explicitly "all"
      where.status = {
        notIn: ["draft", "pending_review", "rejected"],
      };
    }
    // If status is "all", don't filter by status (show all statuses)

    // Support both single categoryId (backward compatibility) and multiple categoryIds
    if (categoryIds && categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    } else if (categoryId) {
      where.categoryId = categoryId;
    }

    if (clientId) {
      // Don't allow clientId to override "not_applied" filter
      // "not_applied" explicitly excludes user's own orders
      if (status !== "not_applied") {
        where.clientId = clientId;
        // When viewing own orders, show all statuses
        if (where.status && where.status.notIn) {
          delete where.status;
        }
      }
    }

    // Filter by orderType if provided
    if (orderType && (orderType === "one_time" || orderType === "permanent")) {
      where.orderType = orderType;
    }

    this.logger.debug(
      `🔍 findAll query - orderType: ${orderType}, userId: ${userId}, where: ${JSON.stringify(where)}`
    );

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
          Category: true,
          BannerImage: {
            select: {
              id: true,
              fileUrl: true,
              fileType: true,
            },
          },
          OrderSkills: {
            include: {
              Skill: true,
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

    // Check and update permanent orders with expired subscriptions
    // This ensures orders are hidden when subscription expires
    const permanentOrdersToCheck = orders.filter(
      (order) => order.orderType === "permanent" && (order.status === "active" || order.status === "open")
    );

    if (permanentOrdersToCheck.length > 0) {
      await Promise.all(
        permanentOrdersToCheck.map(async (order) => {
          try {
            const ownerSubscription = await this.subscriptionsService.getUserActiveSubscription(
              order.clientId
            );

            if (!ownerSubscription) {
              // No active subscription - change to draft
              await this.prisma.order.update({
                where: { id: order.id },
                data: { status: "draft" },
              });
              order.status = "draft";
              this.logger.log(
                `Order ${order.id} status changed to draft due to expired subscription`
              );
            } else {
              const hasFeature = this.subscriptionsService.hasFeature(
                ownerSubscription,
                "publishPermanentOrders"
              );
              if (!hasFeature) {
                // Subscription doesn't have required feature - change to draft
                await this.prisma.order.update({
                  where: { id: order.id },
                  data: { status: "draft" },
                });
                order.status = "draft";
                this.logger.log(
                  `Order ${order.id} status changed to draft - subscription missing publishPermanentOrders feature`
                );
              }
            }
          } catch (error) {
            this.logger.error(
              `Error checking subscription for order ${order.id}: ${error.message}`
            );
          }
        })
      );
    }

    // Calculate credit cost and refund percentage for each order and transform OrderSkills to skills array
    const ordersWithCreditCost = await Promise.all(
      orders.map(async (order) => {
        const pricingConfig = await this.orderPricingService.getPricingConfig(
          order.budget || 0
        );

        // Transform OrderSkills to skills array for backward compatibility
        const skills = (order as any).OrderSkills
          ? (order as any).OrderSkills.map((os: any) => {
              // Return skill name based on language preference (default to nameEn)
              return (
                os.Skill?.nameEn || os.Skill?.nameRu || os.Skill?.nameHy || ""
              );
            }).filter((name: string) => name)
          : [];

        return {
          ...order,
          creditCost: pricingConfig.creditCost,
          refundPercentage: pricingConfig.refundPercentage,
          skills,
        };
      })
    );

    this.logger.debug(
      `📦 findAll result - orderType: ${orderType}, found: ${orders.length}, total: ${total}`
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

    const order = await this.prisma.order.findFirst({
      where: { id: Number(id), deletedAt: null },
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
        Category: {
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
        OrderSkills: {
          include: {
            Skill: true,
          },
        },
        Markets: {
          include: {
            Market: {
              select: {
                id: true,
                name: true,
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
      } as any,
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Transform OrderSkills to skills array for backward compatibility
    (order as any).skills = order.OrderSkills
      ? order.OrderSkills.map((os) => {
          // Return skill name based on language preference (default to nameEn)
          return os.Skill.nameEn || os.Skill.nameRu || os.Skill.nameHy;
        })
      : [];

    // Calculate credit cost and refund percentage for the order
    const pricingConfig = await this.orderPricingService.getPricingConfig(
      order.budget || 0
    );

    // Transform Category to match frontend expectations (add name and description fields)
    const orderWithCategory = order as any;
    let transformedCategory = orderWithCategory.Category;
    if (orderWithCategory.Category) {
      transformedCategory = {
        ...orderWithCategory.Category,
        name:
          orderWithCategory.Category.nameEn ||
          orderWithCategory.Category.nameRu ||
          orderWithCategory.Category.nameHy ||
          orderWithCategory.Category.name ||
          "",
        description:
          orderWithCategory.Category.descriptionEn ||
          orderWithCategory.Category.descriptionRu ||
          orderWithCategory.Category.descriptionHy ||
          orderWithCategory.Category.description ||
          null,
      };
    }

    return {
      ...order,
      Category: transformedCategory,
      creditCost: pricingConfig.creditCost,
      refundPercentage: pricingConfig.refundPercentage,
    };
  }

  async setBannerImage(orderId: number, mediaFileId: number) {
    // Verify order exists
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
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
      categoryId?: number;
      title?: string;
      description?: string;
      budget?: number;
      currency?: string;
      rateUnit?: string;
      status?: string;
      titleEn?: string;
      titleRu?: string;
      titleHy?: string;
      descriptionEn?: string;
      descriptionRu?: string;
      descriptionHy?: string;
      questions?: string[];
      skills?: string[];
      skillIds?: number[];
      orderType?: string;
      workDurationPerClient?: number;
      weeklySchedule?: any;
      availableDates?: string[];
      checkinRequiresApproval?: boolean;
      resourceBookingMode?: "select" | "auto" | "multi";
      requiredResourceCount?: number;
    },
    userId: number,
    useAIEnhancement: boolean = false
  ) {
    // Validate that id is a valid number
    if (!id || isNaN(id) || id <= 0) {
      throw new Error(`Invalid order ID: ${id}`);
    }

    // Check if order exists
    const existingOrder = await this.prisma.order.findFirst({
      where: { id: Number(id), deletedAt: null },
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

    // If categoryId is being updated, check if category exists
    if (updateOrderDto.categoryId !== undefined) {
      if (updateOrderDto.categoryId !== null) {
        const category = await this.prisma.category.findUnique({
          where: { id: updateOrderDto.categoryId },
        });

        if (!category) {
          throw new BadRequestException(
            `Category with ID ${updateOrderDto.categoryId} not found`
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

    // Handle skills update if provided
    let finalSkillIds: number[] | undefined = undefined;
    // Handle skills: support both skillIds (new) and skills (backward compatibility)
    // When both are present, combine them (skillIds for existing, skills for new ones to create)
    finalSkillIds = [];

    // First, add existing skill IDs
    if (updateOrderDto.skillIds !== undefined) {
      finalSkillIds = Array.isArray(updateOrderDto.skillIds)
        ? updateOrderDto.skillIds.filter((id) => !isNaN(id) && id > 0)
        : [];
    }

    // Then, handle new skills (skill names without IDs)
    // This can happen when both skillIds and skills are sent (mixed scenario)
    if (updateOrderDto.skills !== undefined) {
      if (
        Array.isArray(updateOrderDto.skills) &&
        updateOrderDto.skills.length > 0
      ) {
        const skillNames = updateOrderDto.skills.filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0
        );

        if (skillNames.length > 0) {
          const createdSkills =
            await this.skillsService.findOrCreateSkills(skillNames);
          const newSkillIds = createdSkills.map((s) => s.id);
          // Combine existing skillIds with newly created skill IDs
          finalSkillIds = [...finalSkillIds, ...newSkillIds];
        }
      }
    }

    // Prepare update data (exclude useAIEnhancement, questions, skills, skillIds, and categoryId as they're handled separately)
    const {
      useAIEnhancement: _,
      questions,
      skills: __,
      skillIds: ___,
      categoryId,
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

    // Handle skills update if provided
    if (finalSkillIds !== undefined) {
      // Delete existing OrderSkills
      await (this.prisma as any).orderSkill.deleteMany({
        where: { orderId: Number(id) },
      });

      // Create new OrderSkills if any
      if (finalSkillIds.length > 0) {
        await (this.prisma as any).orderSkill.createMany({
          data: finalSkillIds.map((skillId) => ({
            orderId: Number(id),
            skillId,
          })),
        });
      }
    }

    // Handle categoryId update using relation syntax
    if (categoryId !== undefined) {
      if (categoryId === null) {
        updateData.Category = { disconnect: true };
      } else {
        updateData.Category = { connect: { id: categoryId } };
      }
    }

    // Validate schedule changes for permanent orders with existing bookings
    if (
      (updateOrderDto.weeklySchedule !== undefined ||
        updateOrderDto.availableDates !== undefined) &&
      existingOrder.orderType === "permanent"
    ) {
      // Get all active bookings for this order
      const existingBookings = await this.prisma.booking.findMany({
        where: {
          orderId: id,
          status: { in: ["confirmed", "pending"] },
        },
        include: {
          Client: {
            select: {
              id: true,
              name: true,
            },
          },
          MarketMember: {
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (existingBookings.length > 0) {
        // Get old schedule/dates
        const oldWeeklySchedule = existingOrder.weeklySchedule as any;
        const oldAvailableDates = existingOrder.availableDates as string[];

        // Get new schedule/dates
        const newWeeklySchedule =
          updateOrderDto.weeklySchedule !== undefined
            ? updateOrderDto.weeklySchedule
            : oldWeeklySchedule;
        const newAvailableDates =
          updateOrderDto.availableDates !== undefined
            ? updateOrderDto.availableDates
            : oldAvailableDates;

        // Check which bookings would be affected
        const affectedBookings = existingBookings.filter((booking) =>
          this.isBookingAffectedByScheduleChange(
            booking,
            oldWeeklySchedule,
            newWeeklySchedule,
            oldAvailableDates,
            newAvailableDates
          )
        );

        if (affectedBookings.length > 0) {
          // Separate past/current bookings from future bookings
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          const pastBookings = affectedBookings.filter((booking) => {
            const bookingDate = new Date(booking.scheduledDate);
            bookingDate.setHours(0, 0, 0, 0);
            return bookingDate <= now;
          });

          const futureBookings = affectedBookings.filter((booking) => {
            const bookingDate = new Date(booking.scheduledDate);
            bookingDate.setHours(0, 0, 0, 0);
            return bookingDate > now;
          });

          // Prevent removal of dates with past/current bookings
          if (pastBookings.length > 0) {
            throw new BadRequestException(
              `Cannot remove dates with past or current bookings. ${pastBookings.length} booking(s) would be affected. Please contact support if you need to modify past bookings.`
            );
          }

          // Auto-cancel future bookings with notification
          if (futureBookings.length > 0) {
            await this.cancelAffectedBookings(
              futureBookings.map((b) => ({
                id: b.id,
                scheduledDate: b.scheduledDate,
                startTime: b.startTime,
                endTime: b.endTime,
                clientId: b.clientId,
                Client: b.Client,
              })),
              id
            );

            this.logger.log(
              `Auto-cancelled ${futureBookings.length} future booking(s) for order ${id} due to schedule change`
            );
          }
        }

        // Check for break overlaps with existing bookings (only if schedule has breaks)
        // Only check if schedule actually changed and new schedule has breaks
        const scheduleChanged =
          updateOrderDto.weeklySchedule !== undefined &&
          JSON.stringify(oldWeeklySchedule) !== JSON.stringify(newWeeklySchedule);
        
        if (scheduleChanged && newWeeklySchedule) {
          // Check if new schedule has any breaks
          const hasBreaks = Object.values(newWeeklySchedule).some((daySchedule: any) => {
            return daySchedule?.breaks && Array.isArray(daySchedule.breaks) && daySchedule.breaks.length > 0;
          });

          if (hasBreaks) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            // Get all future bookings
            const futureBookings = existingBookings.filter((booking) => {
              const bookingDate = new Date(booking.scheduledDate);
              bookingDate.setHours(0, 0, 0, 0);
              return bookingDate > now;
            });

            // Check which bookings overlap with breaks
            const bookingsWithBreakOverlaps = futureBookings.filter((booking) => {
              const { overlaps } = this.doesBookingOverlapWithBreaks(booking, newWeeklySchedule);
              return overlaps;
            });

            // Send notifications for bookings that overlap with breaks
            if (bookingsWithBreakOverlaps.length > 0) {
              await this.notifyBreakOverlaps(
                bookingsWithBreakOverlaps.map((b) => ({
                  id: b.id,
                  scheduledDate: b.scheduledDate,
                  startTime: b.startTime,
                  endTime: b.endTime,
                  clientId: b.clientId,
                  Client: b.Client,
                  MarketMember: (b as any).MarketMember,
                })),
                id,
                existingOrder.title || "Untitled",
                newWeeklySchedule,
                existingOrder.resourceBookingMode as "select" | "auto" | "multi" | null
              );
            }
          }
        }
      }
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
        OrderSkills: {
          include: {
            Skill: true,
          },
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
    const existingOrder = await this.prisma.order.findFirst({
      where: { id: Number(id), deletedAt: null },
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
          deletedAt: null,
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
          Category: true,
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

    // Calculate credit cost and refund percentage for each order
    const ordersWithCreditCost = await Promise.all(
      orders.map(async (order) => {
        const pricingConfig = await this.orderPricingService.getPricingConfig(
          order.budget || 0
        );
        return {
          ...order,
          creditCost: pricingConfig.creditCost,
          refundPercentage: pricingConfig.refundPercentage,
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

  async getOrdersByCategory(
    categoryId: number,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findAll(page, limit, undefined, categoryId, undefined);
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
    categoryIds?: number[],
    orderType?: string
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        {
          Client: {
            name: { contains: query, mode: "insensitive" },
          },
        },
        {
          Category: {
            name: { contains: query, mode: "insensitive" },
          },
        },
        {
          OrderSkills: {
            some: {
              Skill: {
                OR: [
                  { nameEn: { contains: query, mode: "insensitive" } },
                  { nameRu: { contains: query, mode: "insensitive" } },
                  { nameHy: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
      // Exclude draft, pending_review and rejected orders from search results
      status: {
        notIn: ["draft", "pending_review", "rejected"],
      },
    };

    // Add categoryIds filter if provided
    if (categoryIds && categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }

    // Filter by orderType if provided
    if (orderType && (orderType === "one_time" || orderType === "permanent")) {
      where.orderType = orderType;
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
          Category: true,
          BannerImage: {
            select: {
              id: true,
              fileUrl: true,
              fileType: true,
            },
          },
          OrderSkills: {
            include: {
              Skill: true,
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

    // Calculate credit cost and refund percentage for each order and transform OrderSkills to skills array
    const ordersWithCreditCost = await Promise.all(
      orders.map(async (order) => {
        const pricingConfig = await this.orderPricingService.getPricingConfig(
          order.budget || 0
        );

        // Transform OrderSkills to skills array for backward compatibility
        const skills = (order as any).OrderSkills
          ? (order as any).OrderSkills.map((os: any) => {
              // Return skill name based on language preference (default to nameEn)
              return (
                os.Skill?.nameEn || os.Skill?.nameRu || os.Skill?.nameHy || ""
              );
            }).filter((name: string) => name)
          : [];

        return {
          ...order,
          creditCost: pricingConfig.creditCost,
          refundPercentage: pricingConfig.refundPercentage,
          skills,
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
    categoryId?: number,
    location?: string,
    budgetMin?: number,
    budgetMax?: number
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      deletedAt: null,
      // Show only open orders (exclude pending_review and rejected)
      status: "open",
    };

    if (categoryId) {
      where.categoryId = categoryId;
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
    categoryId: number | undefined,
    title: string,
    description: string,
    budget: number,
    location: string,
    currency?: string,
    rateUnit?: string,
    availableDates?: string[],
    skills?: string[],
    skillIds?: number[],
    mediaFiles: Array<{
      fileName: string;
      fileUrl: string;
      fileType: string;
      mimeType: string;
      fileSize: number;
    }> = [],
    useAIEnhancement: boolean = false,
    questions?: string[],
    orderType: string = "one_time",
    workDurationPerClient?: number,
    weeklySchedule?: any,
    checkinRequiresApproval: boolean = false,
    resourceBookingMode?: "select" | "auto" | "multi",
    requiredResourceCount?: number
  ) {
    // Validate location is provided and not empty
    if (!location || !location.trim()) {
      throw new BadRequestException("Location is required");
    }

    // Validate media files first (check if URLs are accessible)
    if (mediaFiles.length > 0) {
      await this.validateMediaFiles(mediaFiles);
    }

    // Check if client exists
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      include: {
        UserCategories: true,
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

    if (!client) {
      throw new BadRequestException(`Client with ID ${clientId} not found`);
    }

    // For permanent orders, only check if user is a specialist (not subscription)
    // Subscription will be checked when publishing
    if (orderType === "permanent") {
      if (!client.UserCategories || client.UserCategories.length === 0) {
        throw new BadRequestException(
          "Only specialists can create permanent orders. Please add your expertise first."
        );
      }
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

    // Handle skills: support both skillIds (new) and skills (backward compatibility)
    // When both are present, combine them (skillIds for existing, skills for new ones to create)
    let finalSkillIds: number[] = [];

    // First, add existing skill IDs
    if (skillIds && skillIds.length > 0) {
      finalSkillIds = skillIds.filter((id) => !isNaN(id) && id > 0);
    }

    // Then, handle new skills (skill names without IDs)
    // This can happen when both skillIds and skills are sent (mixed scenario)
    if (skills && skills.length > 0) {
      const skillNames = skills.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0
      );

      if (skillNames.length > 0) {
        const createdSkills =
          await this.skillsService.findOrCreateSkills(skillNames);
        const newSkillIds = createdSkills.map((s) => s.id);
        // Combine existing skillIds with newly created skill IDs
        finalSkillIds = [...finalSkillIds, ...newSkillIds];
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
          categoryId,
          title,
          description,
          titleEn,
          titleRu,
          titleHy,
          descriptionEn,
          descriptionRu,
          descriptionHy,
          budget,
          currency: currency || undefined,
          rateUnit: rateUnit || undefined,
          availableDates: availableDates || [],
          location,
          status: orderType === "permanent" ? "draft" : "open",
          orderType: orderType || "one_time",
          workDurationPerClient: workDurationPerClient || undefined,
          weeklySchedule:
            orderType === "permanent" && weeklySchedule
              ? weeklySchedule
              : orderType === "permanent" && workDurationPerClient
                ? this.generateWeeklySchedule(workDurationPerClient)
                : undefined,
          checkinRequiresApproval: orderType === "permanent" ? checkinRequiresApproval : false,
          resourceBookingMode: resourceBookingMode || undefined,
          requiredResourceCount: requiredResourceCount || undefined,
          ...(finalSkillIds.length > 0
            ? {
                OrderSkills: {
                  create: finalSkillIds.map((skillId) => ({
                    skillId,
                  })),
                },
              }
            : {}),
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
          Category: {
            select: {
              id: true,
              name: true,
            },
          },
          questions: {
            orderBy: { order: "asc" },
          },
          OrderSkills: {
            include: {
              Skill: true,
            },
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

      // ✅ Notifications will be sent when order is approved (status changes to "open")
      // Do not send notifications here because order is still "pending_review"

      return result;
    });
  }

  /**
   * Send notifications to users who have notifications enabled for a service
   * when a new order becomes available (status is "open")
   */
  private async sendNewOrderNotifications(
    orderId: number,
    categoryId: number,
    orderTitle: string
  ): Promise<void> {
    try {
      // ✅ CRITICAL: Check order status - only send notifications for "open" orders
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, deletedAt: null },
        select: {
          clientId: true,
          status: true,
        },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found, skipping notifications`);
        return;
      }

      // ✅ Only send notifications if order is "open" (available for specialists)
      if (order.status !== "open") {
        this.logger.log(
          `Order ${orderId} is not open (status: ${order.status}), skipping notifications. Notifications will be sent when order is approved.`
        );
        return;
      }

      const clientId = order.clientId;

      // Find all users who have notifications enabled for this service
      const userCategories = await this.prisma.userCategory.findMany({
        where: {
          categoryId,
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
          Category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (userCategories.length === 0) {
        this.logger.log(
          `No users with notifications enabled for category ${categoryId}`
        );
        return;
      }

      // Get category name for notification
      const categoryName =
        userCategories[0]?.Category?.name || `Category #${categoryId}`;

      // Send notification to each user (excluding the order creator)
      const notifications = userCategories
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
                categoryId: categoryId.toString(),
                categoryName: categoryName,
              },
              {
                orderTitle: orderTitle,
                categoryName: categoryName,
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
        `Sent new order notifications to ${notifications.length} users for order ${orderId} in category ${categoryId}`
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
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
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
              Category: {
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
    const ordersFiltered = savedOrders
      .map((so) => so.Order)
      .filter((order) => order != null);

    // Calculate credit cost and refund percentage for each order
    const ordersWithPricing = await Promise.all(
      ordersFiltered.map(async (order) => {
        const pricingConfig = await this.orderPricingService.getPricingConfig(
          order.budget || 0
        );
        return {
          ...order,
          creditCost: pricingConfig.creditCost,
          refundPercentage: pricingConfig.refundPercentage,
        };
      })
    );

    return {
      orders: ordersWithPricing,
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

  /**
   * Approve a pending order (admin only)
   */
  async approveOrder(orderId: number, adminId: number) {
    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            fcmToken: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if order is in pending_review status
    if (order.status !== "pending_review") {
      throw new BadRequestException(
        `Order is not pending review. Current status: ${order.status}`
      );
    }

    // Update order status to open (approved orders become open)
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "open",
        rejectionReason: null, // Clear any previous rejection reason
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
        Category: {
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

    // Log status change
    await this.logOrderChange(
      orderId,
      "status",
      "pending_review",
      "open",
      adminId,
      "Order approved by admin"
    );

    // Send notification to order creator (includes push notification)
    await this.notificationsService.createNotificationWithPush(
      order.clientId,
      "order_approved",
      "Order Approved", // Will be used as-is if not a translation key
      `Your order "${order.title || "Untitled"}" has been approved and is now open for specialists to apply.`, // Will be used as-is if not a translation key
      {
        orderId: order.id,
        orderTitle: order.title,
      }
    );

    // Send notifications to users who have notifications enabled for this service
    if (order.categoryId) {
      await this.sendNewOrderNotifications(
        order.id,
        order.categoryId,
        order.title || ""
      );
    }

    this.logger.log(
      `Order ${orderId} approved by admin ${adminId}. Client: ${order.clientId}`
    );

    return updatedOrder;
  }

  /**
   * Reject a pending order (admin only)
   */
  async rejectOrder(orderId: number, adminId: number, reason?: string) {
    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            fcmToken: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if order is in pending_review status
    if (order.status !== "pending_review") {
      throw new BadRequestException(
        `Order is not pending review. Current status: ${order.status}`
      );
    }

    // Update order status to rejected
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "rejected",
        rejectionReason: reason || null,
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
        Category: {
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

    // Log status change
    await this.logOrderChange(
      orderId,
      "status",
      "pending_review",
      "rejected",
      adminId,
      reason ? `Order rejected: ${reason}` : "Order rejected by admin"
    );

    // Prepare notification message
    const notificationMessage = reason
      ? `Your order "${order.title || "Untitled"}" has been rejected. Reason: ${reason}`
      : `Your order "${order.title || "Untitled"}" has been rejected. Please review and resubmit.`;

    // Send notification to order creator (includes push notification)
    await this.notificationsService.createNotificationWithPush(
      order.clientId,
      "order_rejected",
      "Order Rejected", // Will be used as-is if not a translation key
      notificationMessage, // Will be used as-is if not a translation key
      {
        orderId: order.id,
        orderTitle: order.title,
        rejectionReason: reason,
      }
    );

    this.logger.log(
      `Order ${orderId} rejected by admin ${adminId}. Client: ${order.clientId}. Reason: ${reason || "No reason provided"}`
    );

    return updatedOrder;
  }

  /**
   * Note: Slot generation removed - clients now book custom time ranges within work hours
   */

  /**
   * Generate initial weekly schedule (only work hours, no slots)
   * workDurationPerClient is now just a suggestion for clients
   */
  generateWeeklySchedule(
    workDurationPerClient: number,
    customSchedule?: any
  ): any {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    const schedule: any = {};

    days.forEach((day) => {
      if (customSchedule && customSchedule[day]) {
        // Use custom schedule for this day (ensure no slots property)
        const { slots, ...daySchedule } = customSchedule[day];
        schedule[day] = daySchedule;
      } else {
        // Default: weekdays enabled (9-17), weekends disabled
        const isWeekend = day === "saturday" || day === "sunday";
        if (isWeekend) {
          schedule[day] = { enabled: false };
        } else {
          schedule[day] = {
            enabled: true,
            workHours: { start: "09:00", end: "17:00" },
            // No slots - clients book custom time ranges
          };
        }
      }
    });

    // Include subscribeAheadDays from customSchedule if provided, otherwise default to 90 days
    if (customSchedule?.subscribeAheadDays !== undefined) {
      schedule.subscribeAheadDays = customSchedule.subscribeAheadDays;
    } else {
      schedule.subscribeAheadDays = 90;
    }

    return schedule;
  }

  /**
   * Get available days with work hours and existing bookings
   * Clients use this to visualize timeline and select custom time ranges
   */
  async getAvailableSlotsForDateRange(
    orderId: number,
    startDate: Date,
    endDate: Date,
    marketMemberId?: number
  ) {
    // Build bookings where clause
    const bookingsWhere: any = {
      status: {
        in: ["confirmed", "completed"],
      },
    };

    // If marketMemberId is provided, filter bookings by that specialist
    if (marketMemberId) {
      bookingsWhere.marketMemberId = marketMemberId;
    }

    const orderResult = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Bookings: {
          where: bookingsWhere,
        },
        Markets: {
          include: {
            Market: {
              select: {
                id: true,
                name: true,
                weeklySchedule: true,
              },
            },
          },
        },
      },
    });

    if (!orderResult) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Type assertion for the order with all necessary fields
    // We need to explicitly type this because Prisma's generated types
    // don't always include all fields when using includes with where clauses
    type OrderWithBookings = {
      id: number;
      clientId: number;
      categoryId: number | null;
      title: string | null;
      description: string | null;
      budget: number | null;
      currency: string;
      rateUnit: string;
      availableDates: string[];
      location: string | null;
      status: string;
      createdAt: Date;
      bannerImageId: number | null;
      titleEn: string | null;
      titleRu: string | null;
      titleHy: string | null;
      descriptionEn: string | null;
      descriptionRu: string | null;
      descriptionHy: string | null;
      rejectionReason: string | null;
      orderType: string;
      workDurationPerClient: number | null;
      weeklySchedule: Prisma.JsonValue | null;
      checkinRequiresApproval: boolean;
      resourceBookingMode: string | null;
      requiredResourceCount: number | null;
      deletedAt: Date | null;
      Bookings: Array<{
        id: number;
        orderId: number;
        clientId: number;
        scheduledDate: string;
        startTime: string;
        endTime: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
      Markets: Array<{
        id: number;
        orderId: number;
        marketId: number;
        Market: {
          id: number;
          name: string;
          weeklySchedule?: Prisma.JsonValue | null;
        };
      }>;
    };

    const order = orderResult as unknown as OrderWithBookings;

    // Get weeklySchedule from order, or fallback to market's schedule
    let weeklySchedule = order.weeklySchedule as Record<string, {
      enabled: boolean;
      workHours: { start: string; end: string } | null;
    }> | null;

    // If order doesn't have a schedule, try to use market's schedule as fallback
    if (!weeklySchedule && order.Markets && order.Markets.length > 0) {
      // Find first market with a weeklySchedule
      for (const marketOrder of order.Markets) {
        const market = marketOrder.Market;
        if (market && (market as any).weeklySchedule) {
          weeklySchedule = (market as any).weeklySchedule as Record<string, {
            enabled: boolean;
            workHours: { start: string; end: string } | null;
          }>;
          break;
        }
      }
    }

    // If no schedule found, default to 24-hour working schedule for all days
    if (!weeklySchedule) {
      weeklySchedule = {
        monday: { enabled: true, workHours: { start: "00:00", end: "23:59" } },
        tuesday: { enabled: true, workHours: { start: "00:00", end: "23:59" } },
        wednesday: { enabled: true, workHours: { start: "00:00", end: "23:59" } },
        thursday: { enabled: true, workHours: { start: "00:00", end: "23:59" } },
        friday: { enabled: true, workHours: { start: "00:00", end: "23:59" } },
        saturday: { enabled: true, workHours: { start: "00:00", end: "23:59" } },
        sunday: { enabled: true, workHours: { start: "00:00", end: "23:59" } },
      };
    }
    const availableDays: Array<{
      date: string;
      workHours: { start: string; end: string } | null;
      bookings: Array<{ startTime: string; endTime: string; clientId?: number }>;
      capacity?: { total: number; booked: number; available: number };
    }> = [];

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    // Iterate through each date in the range
    const currentDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      // Skip past dates
      if (currentDate < today) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const dayOfWeek = currentDate.getDay();
      const dayName = dayNames[dayOfWeek];
      const daySchedule = weeklySchedule[dayName];

      // Check if day is enabled and has work hours
      if (daySchedule && daySchedule.enabled && daySchedule.workHours) {
        const dateStr = currentDate.toISOString().split("T")[0];

        // Get all bookings for this date
        const dayBookings = order.Bookings.filter(
          (booking: OrderWithBookings['Bookings'][0]) => booking.scheduledDate === dateStr
        )
          .map((booking: OrderWithBookings['Bookings'][0]) => ({
            startTime: booking.startTime,
            endTime: booking.endTime,
            clientId: booking.clientId,
          }))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Calculate availability based on mode
        let dayData: {
          date: string;
          workHours: { start: string; end: string } | null;
          bookings: Array<{ startTime: string; endTime: string; clientId?: number }>;
          capacity?: { total: number; booked: number; available: number };
        } = {
          date: dateStr,
          workHours: daySchedule.workHours,
          bookings: dayBookings,
        };

        // Handle multi mode - show capacity based on requiredResourceCount
        const mode = order.resourceBookingMode;
        if (mode === "multi") {
          const requiredResourceCount = (order as any).requiredResourceCount;
          if (requiredResourceCount && requiredResourceCount > 0) {
            // Count bookings for this day
            const bookedCount = dayBookings.length;
            const availableCount = Math.max(0, requiredResourceCount - bookedCount);

            dayData.capacity = {
              total: requiredResourceCount,
              booked: bookedCount,
              available: availableCount,
            };
          }
        }

        availableDays.push(dayData);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      availableDays,
      workDurationPerClient: order.workDurationPerClient,
    };
  }

  /**
   * Get available slots for a specific resource
   * Note: Resources feature removed - this method returns all slots for backward compatibility
   */
  async getAvailableSlotsByResource(
    orderId: number,
    resourceId: number,
    startDate: Date,
    endDate: Date
  ) {
    // Return all available slots (resources feature removed)
    return this.getAvailableSlotsForDateRange(
      orderId,
      startDate,
      endDate
    );
  }

  /**
   * Publish a permanent order (requires subscription)
   */
  async publishPermanentOrder(orderId: number, userId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Client: {
          include: {
            Subscriptions: {
              where: {
                status: "active",
                endDate: {
                  gte: new Date(),
                },
              },
              include: {
                Plan: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check ownership
    if (order.clientId !== userId) {
      throw new ForbiddenException("You can only publish your own orders");
    }

    // Check if it's a permanent order
    if (order.orderType !== "permanent") {
      throw new BadRequestException(
        "Only permanent orders need to be published"
      );
    }

    // Allow republishing if order is active/open but subscription expired
    // Check if order owner has active subscription
    const ownerSubscription = await this.subscriptionsService.getUserActiveSubscription(
      userId
    );

    if (order.status === "active" || order.status === "open") {
      // If order is active/open, check if subscription is still valid
      if (ownerSubscription) {
        const hasFeature = this.subscriptionsService.hasFeature(
          ownerSubscription,
          "publishPermanentOrders"
        );
        if (hasFeature) {
          throw new BadRequestException("Order is already published and active");
        }
      }
      // Subscription expired - allow republishing by changing to draft first
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: "draft" },
      });
      // Log status change
      await this.logOrderChange(
        orderId,
        "status",
        order.status,
        "draft",
        userId,
        "Order status changed to draft due to expired subscription - ready for republishing"
      );
    } else if (order.status !== "draft") {
      throw new BadRequestException("Order is already published");
    }

    // Check if user has active subscription with publishPermanentOrders feature
    const hasFeature = order.Client.Subscriptions?.some(
      (sub) =>
        sub.status === "active" &&
        new Date(sub.endDate) > new Date() &&
        (sub.Plan?.features as any)?.publishPermanentOrders === true
    );

    if (!hasFeature) {
      throw new BadRequestException(
        "A subscription with 'publishPermanentOrders' feature is required to publish permanent orders."
      );
    }

    // Check if order was previously approved by admin
    // Look for a history entry where status changed from "pending_review" to "active" or "open"
    const previousApproval = await this.prisma.orderChangeHistory.findFirst({
      where: {
        orderId: orderId,
        fieldChanged: "status",
        oldValue: "pending_review",
        newValue: {
          in: ["active", "open"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If order was previously approved, skip admin approval and restore to previous status
    // Otherwise, require admin approval (go to "pending_review")
    // For permanent orders, prefer "active" status, but use previous status if available
    const newStatus = previousApproval 
      ? (previousApproval.newValue === "open" ? "open" : "active")
      : "pending_review";
    const logReason = previousApproval
      ? `Permanent order republished - previously approved (was ${previousApproval.newValue}), skipping admin review`
      : "Permanent order published - pending admin review";

    // Update status
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Category: true,
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            Proposals: true,
            Reviews: true,
          },
        },
      },
    });

    // Log status change
    await this.logOrderChange(
      orderId,
      "status",
      "draft",
      newStatus,
      userId,
      logReason
    );

    // If going directly to active/open (skipping admin approval), send notification
    if (newStatus === "active" || newStatus === "open") {
      try {
        await this.notificationsService.createNotificationWithPush(
          userId,
          "order_approved",
          "Order Published",
          `Your permanent order "${order.title || order.titleEn || "Untitled"}" has been published and is now live.`,
          {
            orderId: order.id,
            orderTitle: order.title || order.titleEn || "Untitled",
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send notification for order ${orderId}:`,
          error
        );
      }
    }

    return updatedOrder;
  }

  /**
   * Get available slots for a permanent order
   * Supports both weekly schedule (new) and availableDates (legacy)
   * @param marketMemberId - Optional market member ID to filter slots by specialist (for select mode)
   */
  async getAvailableSlots(orderId: number, startDate?: Date, endDate?: Date, marketMemberId?: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Bookings: {
          where: {
            status: {
              in: ["confirmed", "completed"],
            },
          },
        },
        Markets: {
          include: {
            Market: {
              select: {
                id: true,
                name: true,
                weeklySchedule: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.orderType !== "permanent") {
      throw new BadRequestException(
        "Available slots can only be retrieved for permanent orders"
      );
    }

    // Check if order has weeklySchedule or if it can use market's schedule as fallback
    const hasOrderSchedule = !!order.weeklySchedule;
    const hasMarketSchedule = order.Markets && order.Markets.length > 0 && 
      order.Markets.some(mo => mo.Market && (mo.Market as any).weeklySchedule);

    // If order uses new weekly schedule format (either own or market's)
    if (hasOrderSchedule || hasMarketSchedule) {
      const start = startDate || new Date();
      const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 3 months default
      return this.getAvailableSlotsForDateRange(orderId, start, end, marketMemberId);
    }

    // Legacy: Parse available dates from the order (for backward compatibility)
    const availableSlots: Array<{ date: string; times: string[] }> = [];

    if (order.availableDates && order.availableDates.length > 0) {
      order.availableDates.forEach((dateStr: string) => {
        try {
          const { date, times = [] } = JSON.parse(dateStr);
          if (!date) return;

          // Filter out times that are already booked
          // Convert new booking format (startTime-endTime) to old slot format for comparison
          const bookedTimes = order.Bookings.filter(
            (booking) => booking.scheduledDate === date
          ).map((booking) => `${booking.startTime}-${booking.endTime}`);

          const availableTimes = times.filter(
            (time: string) => !bookedTimes.includes(time)
          );

          if (availableTimes.length > 0) {
            availableSlots.push({
              date,
              times: availableTimes,
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to parse date: ${dateStr}`, error);
        }
      });
    }

    return {
      orderId: order.id,
      workDurationPerClient: order.workDurationPerClient,
      availableSlots,
    };
  }
}
