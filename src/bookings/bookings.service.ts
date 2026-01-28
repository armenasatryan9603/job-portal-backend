import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma.service";
import { PusherService } from "../pusher/pusher.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private pusherService: PusherService,
    private subscriptionsService: SubscriptionsService
  ) {}

  /**
   * Create a new booking (check-in)
   */
  /**
   * Validate time format (HH:MM)
   */
  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Check if time range is within work hours
   */
  private isWithinWorkHours(
    startTime: string,
    endTime: string,
    workHours: { start: string; end: string }
  ): boolean {
    return (
      startTime >= workHours.start &&
      endTime <= workHours.end &&
      startTime < endTime
    );
  }

  /**
   * Check if new booking overlaps with existing bookings
   */
  private hasOverlap(
    startTime: string,
    endTime: string,
    existingBookings: Array<{ startTime: string; endTime: string }>
  ): boolean {
    return existingBookings.some((booking) => {
      // Two time ranges overlap if:
      // start1 < end2 AND end1 > start2
      return startTime < booking.endTime && endTime > booking.startTime;
    });
  }

  /**
   * Get day schedule from order's weekly schedule, with fallback to market's schedule
   */
  private getDaySchedule(order: any, scheduledDate: string): any {
    let weeklySchedule = order.weeklySchedule as any;
    
    // If order doesn't have a schedule, try to use market's schedule as fallback
    if (!weeklySchedule && order.Markets && order.Markets.length > 0) {
      // Find first market with a weeklySchedule
      for (const marketOrder of order.Markets) {
        const market = marketOrder.Market || marketOrder;
        if (market && market.weeklySchedule) {
          weeklySchedule = market.weeklySchedule;
          break;
        }
      }
    }

    // If no schedule found, default to 24-hour working day
    if (!weeklySchedule) {
      return {
        enabled: true,
        workHours: { start: "00:00", end: "23:59" },
      };
    }

    const date = new Date(scheduledDate);
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[date.getDay()];
    const daySchedule = weeklySchedule[dayName];

    // If day is not enabled or doesn't have work hours, default to 24-hour working day
    if (!daySchedule || !daySchedule.enabled || !daySchedule.workHours) {
      return {
        enabled: true,
        workHours: { start: "00:00", end: "23:59" },
      };
    }

    return daySchedule;
  }

  /**
   * Check if client has overlapping bookings in other orders from the same market
   */
  private async checkMarketOrderBookingConflict(
    orderId: number,
    clientId: number,
    scheduledDate: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    // Load the order with Markets relation
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        Markets: true,
      },
    });

    if (!order || !order.Markets || order.Markets.length === 0) {
      // Order doesn't belong to a market, no conflict check needed
      return false;
    }

    // Get the marketId from the first MarketOrder entry
    const marketId = order.Markets[0].marketId;

    // Find all other orders in the same market
    const otherMarketOrders = await this.prisma.marketOrder.findMany({
      where: {
        marketId,
        orderId: {
          not: orderId,
        },
      },
      select: {
        orderId: true,
      },
    });

    if (otherMarketOrders.length === 0) {
      // No other orders in the same market, no conflict
      return false;
    }

    // Extract order IDs
    const otherOrderIds = otherMarketOrders.map((mo) => mo.orderId);

    // Get all bookings for the client in those other orders on the same date
    const conflictingBookings = await this.prisma.booking.findMany({
      where: {
        clientId,
        scheduledDate,
        orderId: {
          in: otherOrderIds,
        },
        status: {
          in: ["confirmed", "completed", "pending"],
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Check if any of those bookings overlap with the requested time range
    if (conflictingBookings.length === 0) {
      return false;
    }

    // Use the existing hasOverlap method to check for conflicts
    return this.hasOverlap(startTime, endTime, conflictingBookings);
  }

  async createBooking(
    orderId: number,
    clientId: number,
    scheduledDate: string,
    startTime: string,
    endTime: string,
    marketMemberId?: number
  ) {
    // Validate time format
    if (
      !this.isValidTimeFormat(startTime) ||
      !this.isValidTimeFormat(endTime)
    ) {
      throw new BadRequestException(
        "Invalid time format. Use HH:MM (e.g., 09:00)"
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException("End time must be after start time");
    }

    // Verify order exists and is a permanent order
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        Client: true,
        Markets: {
          include: {
            Market: {
              select: {
                id: true,
                weeklySchedule: true,
              },
            },
          },
        },
        Bookings: {
          where: {
            scheduledDate,
            status: {
              in: ["confirmed", "completed", "pending"],
            },
          },
        },
      },
    });
    
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Determine booking status based on approval requirement
    const requiresApproval = order.checkinRequiresApproval ?? false;
    const bookingStatus = requiresApproval ? "pending" : "confirmed";

    if (order.orderType !== "permanent") {
      throw new BadRequestException(
        "Bookings can only be created for permanent orders"
      );
    }

    if (order.status !== "open" && order.status !== "active") {
      throw new BadRequestException(
        "Bookings can only be created for active permanent orders"
      );
    }

    // Check if order owner has active subscription with publishPermanentOrders feature
    const ownerSubscription = await this.subscriptionsService.getUserActiveSubscription(
      order.clientId
    );

    if (!ownerSubscription) {
      throw new BadRequestException(
        "This service is currently unavailable. The service owner's subscription has expired. Please contact the service provider."
      );
    }

    const hasFeature = this.subscriptionsService.hasFeature(
      ownerSubscription,
      "publishPermanentOrders"
    );

    if (!hasFeature) {
      throw new BadRequestException(
        "This service is currently unavailable. The service owner's subscription has expired. Please contact the service provider."
      );
    }

    // Check for overlapping bookings in other orders from the same market
    const hasMarketConflict = await this.checkMarketOrderBookingConflict(
      orderId,
      clientId,
      scheduledDate,
      startTime,
      endTime
    );

    if (hasMarketConflict) {
      throw new BadRequestException(
        "You already have a booking for this time in another order from the same service. Please choose a different time."
      );
    }

    // Get day schedule and validate against work hours
    const daySchedule = this.getDaySchedule(order, scheduledDate);

    if (!this.isWithinWorkHours(startTime, endTime, daySchedule.workHours)) {
      throw new BadRequestException(
        `Time range must be within work hours: ${daySchedule.workHours.start} - ${daySchedule.workHours.end}`
      );
    }

    // Handle booking based on order's resourceBookingMode
    const mode = order.resourceBookingMode as "select" | "auto" | "multi" | null;
    
    // Get all bookings for the same time slot (for capacity checking)
    // Include pending bookings for capacity calculation
    const allBookingsForDate = await this.prisma.booking.findMany({
      where: {
        orderId,
        scheduledDate,
        status: {
          in: ["confirmed", "completed", "pending"],
        },
      },
    });

    const overlappingBookings = allBookingsForDate.filter((booking) => {
      // Check if bookings overlap in time
      return (
        (startTime < booking.endTime && endTime > booking.startTime)
      );
    });

    // For multi mode, check capacity based on requiredResourceCount
    if (mode === "multi") {
      const requiredResourceCount = (order as any).requiredResourceCount;
      
      if (!requiredResourceCount || requiredResourceCount <= 0) {
        throw new BadRequestException(
          "requiredResourceCount must be set for multi mode orders"
        );
      }

      // Check if adding this booking would exceed the required resource count
      if (overlappingBookings.length >= requiredResourceCount) {
        throw new BadRequestException(
          `Maximum capacity reached for this time slot. Maximum resources: ${requiredResourceCount}, Current bookings: ${overlappingBookings.length}`
        );
      }
    } else {
      // For select and auto modes, check for time conflicts (no overlapping bookings allowed)
      if (overlappingBookings.length > 0) {
        throw new BadRequestException(
          "Time range conflicts with an existing booking"
        );
      }
    }

    // Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        orderId,
        clientId,
        scheduledDate,
        startTime,
        endTime,
        status: bookingStatus,
        ...(marketMemberId ? { marketMemberId } : {}),
      },
      include: {
        Order: {
          include: {
            Category: true,
          },
        },
        Client: true,
        MarketMember: {
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
      },
    });

    // Send notification to the specialist (order creator)
    try {
      // Build notification message with specialist info if resourceBookingMode is "select"
      let specialistInfo = "";
      if (mode === "select" && booking.MarketMember?.User) {
        specialistInfo = ` with ${booking.MarketMember.User.name}`;
      }

      const notificationTitle = requiresApproval ? "New Booking Request" : "New Booking";
      const notificationMessage = requiresApproval
        ? `${booking.Client.name} has requested a booking${specialistInfo} for ${scheduledDate} from ${startTime} to ${endTime}. Approval required.`
        : `${booking.Client.name} has checked in${specialistInfo} for ${scheduledDate} from ${startTime} to ${endTime}`;
      
      await this.notificationsService.createNotificationWithPush(
        order.clientId,
        "new_booking",
        notificationTitle,
        notificationMessage,
        {
          bookingId: booking.id,
          orderId: order.id,
          clientId: clientId,
          scheduledDate,
          startTime,
          endTime,
          status: bookingStatus,
          ...(mode === "select" && booking.MarketMember?.User ? {
            specialistId: booking.MarketMember.User.id,
            specialistName: booking.MarketMember.User.name,
          } : {}),
        }
      );

      // Send real-time Pusher notification
      await this.pusherService.trigger(
        `user-${order.clientId}`,
        "booking-created",
        {
          bookingId: booking.id,
          orderId: order.id,
          clientId: clientId,
          clientName: booking.Client.name,
          scheduledDate,
          startTime,
          endTime,
          ...(mode === "select" && booking.MarketMember?.User ? {
            specialistId: booking.MarketMember.User.id,
            specialistName: booking.MarketMember.User.name,
          } : {}),
        }
      );
    } catch (error) {
      this.logger.error("Failed to send booking notification:", error);
      // Don't fail the booking creation if notification fails
    }

    return booking;
  }

  /**
   * Create multiple bookings at once
   */
  async createMultipleBookings(
    orderId: number,
    clientId: number,
    slots: Array<{ date: string; startTime: string; endTime: string; marketMemberId?: number }>
  ) {
    const bookings: any[] = [];
    const errors: Array<{
      slot: { date: string; startTime: string; endTime: string; marketMemberId?: number };
      error: string;
    }> = [];

    for (const slot of slots) {
      try {
        const booking = await this.createBooking(
          orderId,
          clientId,
          slot.date,
          slot.startTime,
          slot.endTime,
          slot.marketMemberId
        );
        bookings.push(booking);
      } catch (error: any) {
        errors.push({
          slot,
          error: error.message || "Unknown error",
        });
      }
    }

    return {
      bookings,
      errors,
      success: bookings.length > 0,
    };
  }

  /**
   * Get all bookings for an order
   */
  async getOrderBookings(orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return this.prisma.booking.findMany({
      where: { orderId },
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
        Order: {
          select: {
            id: true,
            title: true,
            workDurationPerClient: true,
            resourceBookingMode: true,
          },
        },
        MarketMember: {
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
      },
      orderBy: {
        scheduledDate: "asc",
      },
    });
  }

  /**
   * Get all bookings for a client (both bookings made by user and bookings on user's orders)
   */
  async getClientBookings(clientId: number) {
    // Fetch bookings where user is the client (checked into someone else's order)
    const myBookings = await this.prisma.booking.findMany({
      where: { clientId },
      include: {
        Order: {
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            workDurationPerClient: true,
            resourceBookingMode: true,
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
              },
            },
          },
        },
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
        MarketMember: {
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
      },
    });

    // Fetch bookings on orders created by user (others checked into my orders)
    const bookingsOnMyOrders = await this.prisma.booking.findMany({
      where: {
        Order: {
          clientId: clientId,
        },
      },
      include: {
        Order: {
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            workDurationPerClient: true,
            resourceBookingMode: true,
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
              },
            },
          },
        },
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
        MarketMember: {
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
      },
    });

    // Combine both arrays and remove duplicates (in case user booked their own order)
    const allBookings = [...myBookings, ...bookingsOnMyOrders];
    const uniqueBookings = Array.from(
      new Map(allBookings.map((booking) => [booking.id, booking])).values()
    );

    // Sort by scheduled date
    return uniqueBookings.sort(
      (a, b) =>
        new Date(a.scheduledDate).getTime() -
        new Date(b.scheduledDate).getTime()
    );
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number, userId: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        Order: {
          include: {
            Client: true,
          },
        },
        Client: true,
        MarketMember: {
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
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    // Only the client who made the booking or the order creator can cancel
    if (booking.clientId !== userId && booking.Order.clientId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to cancel this booking"
      );
    }

    if (booking.status === "cancelled") {
      throw new BadRequestException("Booking is already cancelled");
    }

    // Update booking status to cancelled
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
      include: {
        Order: {
          include: {
            Client: true,
          },
        },
        Client: true,
        MarketMember: {
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
      },
    });

    // Send notification
    try {
      const notifyUserId =
        userId === booking.clientId ? booking.Order.clientId : booking.clientId;

      const cancellerName =
        userId === booking.clientId
          ? booking.Client.name
          : booking.Order.Client.name;

      // Build notification message with specialist info if resourceBookingMode is "select"
      const mode = booking.Order.resourceBookingMode as "select" | "auto" | "multi" | null;
      let specialistInfo = "";
      if (mode === "select" && booking.MarketMember?.User) {
        specialistInfo = ` with ${booking.MarketMember.User.name}`;
      }

      await this.notificationsService.createNotificationWithPush(
        notifyUserId,
        "booking_cancelled",
        "Booking Cancelled",
        `${cancellerName} cancelled booking${specialistInfo} for ${booking.scheduledDate} from ${booking.startTime} to ${booking.endTime}`,
        {
          bookingId: booking.id,
          orderId: booking.orderId,
          scheduledDate: booking.scheduledDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          ...(mode === "select" && booking.MarketMember?.User ? {
            specialistId: booking.MarketMember.User.id,
            specialistName: booking.MarketMember.User.name,
          } : {}),
        }
      );

      // Send real-time Pusher notification
      await this.pusherService.trigger(
        `user-${notifyUserId}`,
        "booking-cancelled",
        {
          bookingId: booking.id,
          orderId: booking.orderId,
          cancellerName,
          scheduledDate: booking.scheduledDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          ...(mode === "select" && booking.MarketMember?.User ? {
            specialistId: booking.MarketMember.User.id,
            specialistName: booking.MarketMember.User.name,
          } : {}),
        }
      );
    } catch (error) {
      this.logger.error("Failed to send cancellation notification:", error);
    }

    return updatedBooking;
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId: number, status: string, userId: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        Order: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    // Only the order creator (specialist) can update booking status
    if (booking.Order.clientId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to update this booking"
      );
    }

    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }
    
    // Validate status transitions
    const currentStatus = booking.status;
    if (currentStatus === "pending") {
      // From pending, can only go to confirmed (approve) or cancelled (reject)
      if (status !== "confirmed" && status !== "cancelled") {
        throw new BadRequestException(
          "Pending bookings can only be approved (confirmed) or rejected (cancelled)"
        );
      }
    } else if (currentStatus === "confirmed") {
      // From confirmed, cannot go back to pending
      if (status === "pending") {
        throw new BadRequestException(
          "Cannot change confirmed booking back to pending"
        );
      }
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status },
      include: {
        Order: true,
        Client: true,
      },
    });
  }

  /**
   * Update a booking (change date/time)
   */
  async updateBooking(
    bookingId: number,
    userId: number,
    updateData: {
      scheduledDate?: string;
      startTime?: string;
      endTime?: string;
    }
  ) {
    // Fetch existing booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        Order: {
          include: {
            Client: true,
            Markets: {
              include: {
                Market: {
                  select: {
                    id: true,
                    weeklySchedule: true,
                  },
                },
              },
            },
            Bookings: {
              where: {
                id: { not: bookingId }, // Exclude current booking
                status: {
                  in: ["confirmed", "completed"],
                },
              },
            },
          },
        },
        Client: true,
        MarketMember: {
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
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    // Only the order creator (specialist) can update bookings
    if (booking.Order.clientId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to update this booking"
      );
    }

    if (booking.status === "cancelled") {
      throw new BadRequestException("Cannot update a cancelled booking");
    }

    // Prepare updated values
    const scheduledDate = updateData.scheduledDate || booking.scheduledDate;
    const startTime = updateData.startTime || booking.startTime;
    const endTime = updateData.endTime || booking.endTime;

    // Validate time format
    if (
      !this.isValidTimeFormat(startTime) ||
      !this.isValidTimeFormat(endTime)
    ) {
      throw new BadRequestException(
        "Invalid time format. Use HH:MM (e.g., 09:00)"
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException("End time must be after start time");
    }

    // Get day schedule and validate against work hours
    const daySchedule = this.getDaySchedule(booking.Order, scheduledDate);

    if (!this.isWithinWorkHours(startTime, endTime, daySchedule.workHours)) {
      throw new BadRequestException(
        `Time range must be within work hours: ${daySchedule.workHours.start} - ${daySchedule.workHours.end}`
      );
    }

    // Check for overlapping bookings on the new date
    const bookingsOnNewDate = booking.Order.Bookings.filter(
      (b) => b.scheduledDate === scheduledDate
    ).map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
    }));

    if (this.hasOverlap(startTime, endTime, bookingsOnNewDate)) {
      throw new BadRequestException(
        "Time range conflicts with an existing booking"
      );
    }

    // Update the booking
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        scheduledDate,
        startTime,
        endTime,
      },
      include: {
        Order: {
          include: {
            Client: true,
            Category: true,
          },
        },
        Client: true,
        MarketMember: {
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
      },
    });

    // Send notification to the client who made the booking
    try {
      // Build notification message with specialist info if resourceBookingMode is "select"
      const mode = booking.Order.resourceBookingMode as "select" | "auto" | "multi" | null;
      let specialistInfo = "";
      if (mode === "select" && booking.MarketMember?.User) {
        specialistInfo = ` with ${booking.MarketMember.User.name}`;
      }

      await this.notificationsService.createNotificationWithPush(
        booking.clientId,
        "booking_updated",
        "Booking Updated",
        `Your booking${specialistInfo} has been moved to ${scheduledDate} from ${startTime} to ${endTime}`,
        {
          bookingId: updatedBooking.id,
          orderId: updatedBooking.orderId,
          scheduledDate,
          startTime,
          endTime,
          ...(mode === "select" && booking.MarketMember?.User ? {
            specialistId: booking.MarketMember.User.id,
            specialistName: booking.MarketMember.User.name,
          } : {}),
        }
      );

      // Send real-time Pusher notification
      await this.pusherService.trigger(
        `user-${booking.clientId}`,
        "booking-updated",
        {
          bookingId: updatedBooking.id,
          orderId: updatedBooking.orderId,
          scheduledDate,
          startTime,
          endTime,
          updatedBy: booking.Order.Client.name,
          ...(mode === "select" && booking.MarketMember?.User ? {
            specialistId: booking.MarketMember.User.id,
            specialistName: booking.MarketMember.User.name,
          } : {}),
        }
      );
    } catch (error) {
      this.logger.error("Failed to send booking update notification:", error);
    }

    return updatedBooking;
  }

  /**
   * Get a single booking by ID
   */
  async getBookingById(bookingId: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
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
              },
            },
          },
        },
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
        MarketMember: {
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
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    return booking;
  }
}
