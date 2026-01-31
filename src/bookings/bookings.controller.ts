import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("bookings")
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * Create a booking (check-in) with custom time range
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @Request() req,
    @Body()
    body: {
      orderId: number;
      slots?: Array<{ date: string; startTime: string; endTime: string; marketMemberId?: number; message?: string }>;
      scheduledDate?: string;
      startTime?: string;
      endTime?: string;
      marketMemberId?: number;
      message?: string;
    }
  ) {
    const userId = req.user.userId;

    // Support both single booking and multiple bookings
    if (body.slots && body.slots.length > 0) {
      // Create multiple bookings (message per slot in each item)
      return this.bookingsService.createMultipleBookings(
        body.orderId,
        userId,
        body.slots
      );
    } else if (body.scheduledDate && body.startTime && body.endTime) {
      // Create single booking
      return this.bookingsService.createBooking(
        body.orderId,
        userId,
        body.scheduledDate,
        body.startTime,
        body.endTime,
        body.marketMemberId,
        body.message
      );
    } else {
      throw new Error(
        "Either slots array or scheduledDate/startTime/endTime must be provided"
      );
    }
  }

  /**
   * Get all bookings for an order
   */
  @Get("order/:orderId")
  async getOrderBookings(@Param("orderId", ParseIntPipe) orderId: number) {
    return this.bookingsService.getOrderBookings(orderId);
  }

  /**
   * Get user's bookings
   */
  @Get("my")
  async getMyBookings(@Request() req) {
    const userId = req.user.userId;
    return this.bookingsService.getClientBookings(userId);
  }

  /**
   * Get a specific booking
   */
  @Get(":id")
  async getBooking(@Param("id", ParseIntPipe) id: number) {
    return this.bookingsService.getBookingById(id);
  }

  /**
   * Cancel a booking
   */
  @Patch(":id/cancel")
  async cancelBooking(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.userId;
    return this.bookingsService.cancelBooking(id, userId);
  }

  /**
   * Update booking (change date/time)
   */
  @Patch(":id")
  async updateBooking(
    @Param("id", ParseIntPipe) id: number,
    @Body()
    body: {
      scheduledDate?: string;
      startTime?: string;
      endTime?: string;
    },
    @Request() req
  ) {
    const userId = req.user.userId;
    return this.bookingsService.updateBooking(id, userId, body);
  }

  /**
   * Update booking status
   */
  @Patch(":id/status")
  async updateBookingStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { status: string },
    @Request() req
  ) {
    const userId = req.user.userId;
    return this.bookingsService.updateBookingStatus(id, body.status, userId);
  }
}
