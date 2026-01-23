import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { CreateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { UpdateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { PurchaseSubscriptionDto } from "./dto/user-subscription.dto";
import { CancelSubscriptionDto } from "./dto/user-subscription.dto";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  /**
   * Get all active subscription plans
   */
  @Get("plans")
  async getPlans(@Query("language") language: string = "en") {
    return this.subscriptionsService.getAllPlans(language);
  }

  /**
   * Get a specific plan by ID
   */
  @Get("plans/:id")
  async getPlanById(
    @Param("id", ParseIntPipe) id: number,
    @Query("language") language: string = "en"
  ) {
    return this.subscriptionsService.getPlanById(id, language);
  }

  /**
   * Get user's current subscription
   */
  @UseGuards(JwtAuthGuard)
  @Get("my-subscription")
  async getMySubscription(
    @Request() req,
    @Query("language") language: string = "en"
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User ID not found in token");
    }
    const subscription = await this.subscriptionsService.getUserActiveSubscription(
      userId,
      language
    );
    // Ensure we always return a valid JSON response (null is valid JSON)
    return subscription || null;
  }

  /**
   * Get user's subscription history
   */
  @UseGuards(JwtAuthGuard)
  @Get("my-subscriptions")
  async getMySubscriptions(@Request() req) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User ID not found in token");
    }
    return this.subscriptionsService.getUserSubscriptions(userId);
  }

  /**
   * Purchase a subscription
   */
  @UseGuards(JwtAuthGuard)
  @Post("purchase")
  async purchaseSubscription(
    @Request() req,
    @Body() purchaseDto: PurchaseSubscriptionDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User ID not found in token");
    }
    return this.subscriptionsService.purchaseSubscription(userId, purchaseDto);
  }

  /**
   * Cancel subscription
   */
  @UseGuards(JwtAuthGuard)
  @Post("cancel")
  async cancelSubscription(
    @Request() req,
    @Body() cancelDto: CancelSubscriptionDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User ID not found in token");
    }
    return this.subscriptionsService.cancelSubscription(
      userId,
      cancelDto.subscriptionId,
    );
  }

  /**
   * Renew subscription manually
   */
  @UseGuards(JwtAuthGuard)
  @Post("renew")
  async renewSubscription(
    @Request() req,
    @Body() body: { subscriptionId: number },
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User ID not found in token");
    }
    return this.subscriptionsService.renewSubscription(
      userId,
      body.subscriptionId,
    );
  }

  /**
   * Payment callback endpoint (called by payment gateway)
   */
  @Get("callback")
  async paymentCallback(@Query() query: any) {
    const orderID =
      query.orderID || query.orderId || query.order_id;
    const responseCode =
      query.responseCode ||
      query.response_code ||
      query.ResponseCode ||
      query.resposneCode;
    const paymentID =
      query.paymentID || query.paymentId || query.payment_id || query.PaymentID;
    const opaque = query.opaque || query.Opaque;

    if (!orderID || !paymentID) {
      throw new BadRequestException("Missing required payment parameters");
    }

    return this.subscriptionsService.handleSubscriptionPaymentCallback(
      orderID,
      responseCode,
      paymentID,
      opaque,
    );
  }

  /**
   * Also support POST for callback
   */
  @Post("callback")
  async paymentCallbackPost(
    @Body()
    body: {
      orderID: string;
      responseCode: string;
      paymentID: string;
      opaque?: string;
    },
  ) {
    if (!body.orderID || !body.paymentID) {
      throw new BadRequestException("Missing required payment parameters");
    }

    return this.subscriptionsService.handleSubscriptionPaymentCallback(
      body.orderID,
      body.responseCode,
      body.paymentID,
      body.opaque,
    );
  }

  // Admin endpoints

  /**
   * Create a new subscription plan (admin only)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("plans")
  async createPlan(@Body() createPlanDto: CreateSubscriptionPlanDto) {
    return this.subscriptionsService.createPlan(createPlanDto);
  }

  /**
   * Update a subscription plan (admin only)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("plans/:id")
  async updatePlan(
    @Param("id", ParseIntPipe) id: number,
    @Body() updatePlanDto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionsService.updatePlan(id, updatePlanDto);
  }

  /**
   * Get all subscriptions (admin only)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("all")
  async getAllSubscriptions(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "20",
  ) {
    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 20;
    return this.subscriptionsService.getAllSubscriptions(
      pageNumber,
      limitNumber,
    );
  }

  /**
   * Get all subscription plans (admin only - includes inactive)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/plans")
  async getAllPlansAdmin(@Query("language") language: string = "en") {
    return this.subscriptionsService.getAllPlansAdmin(language);
  }

  /**
   * Get all market subscriptions (admin only)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/market-subscriptions")
  async getAllMarketSubscriptions(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "20",
  ) {
    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 20;
    return this.subscriptionsService.getAllMarketSubscriptions(
      pageNumber,
      limitNumber,
    );
  }

  /**
   * Market subscription endpoints
   */

  /**
   * Purchase subscription for a market
   */
  @UseGuards(JwtAuthGuard)
  @Post("markets/:marketId/purchase")
  async purchaseMarketSubscription(
    @Param("marketId", ParseIntPipe) marketId: number,
    @Request() req,
    @Body() purchaseDto: PurchaseSubscriptionDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User ID not found in token");
    }
    return this.subscriptionsService.purchaseMarketSubscription(
      userId,
      marketId,
      purchaseDto,
    );
  }

  /**
   * Get market's active subscription
   */
  @Get("markets/:marketId/active")
  async getMarketActiveSubscription(
    @Param("marketId", ParseIntPipe) marketId: number,
  ) {
    return this.subscriptionsService.getMarketActiveSubscription(marketId);
  }

  /**
   * Get market's subscription history
   */
  @Get("markets/:marketId/subscriptions")
  async getMarketSubscriptions(
    @Param("marketId", ParseIntPipe) marketId: number,
  ) {
    return this.subscriptionsService.getMarketSubscriptions(marketId);
  }

  /**
   * Admin: Cancel a user subscription
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/user-subscriptions/:id/cancel")
  async adminCancelUserSubscription(
    @Param("id", ParseIntPipe) subscriptionId: number,
  ) {
    return this.subscriptionsService.adminCancelUserSubscription(subscriptionId);
  }

  /**
   * Admin: Extend a user subscription
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/user-subscriptions/:id/extend")
  async adminExtendUserSubscription(
    @Param("id", ParseIntPipe) subscriptionId: number,
    @Body() body: { additionalDays: number },
  ) {
    return this.subscriptionsService.adminExtendUserSubscription(
      subscriptionId,
      body.additionalDays,
    );
  }

  /**
   * Admin: Cancel a market subscription
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/market-subscriptions/:id/cancel")
  async adminCancelMarketSubscription(
    @Param("id", ParseIntPipe) subscriptionId: number,
  ) {
    return this.subscriptionsService.adminCancelMarketSubscription(
      subscriptionId,
    );
  }

  /**
   * Admin: Extend a market subscription
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/market-subscriptions/:id/extend")
  async adminExtendMarketSubscription(
    @Param("id", ParseIntPipe) subscriptionId: number,
    @Body() body: { additionalDays: number },
  ) {
    return this.subscriptionsService.adminExtendMarketSubscription(
      subscriptionId,
      body.additionalDays,
    );
  }
}
