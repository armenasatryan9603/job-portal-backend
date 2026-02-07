import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  Req,
  Res,
} from "@nestjs/common";
import type { Request as ExpressRequest, Response } from "express";
import { OrdersService } from "./orders.service";
import { AIService } from "../ai/ai.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";

@Controller("orders")
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private aiService: AIService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post("create")
  async create(
    @Request() req,
    @Body()
    body: {
      categoryId?: number;
      title: string;
      description: string;
      budget: number;
      currency?: string;
      rateUnit?: string;
      availableDates?: string[];
      location: string;
      skills?: string[];
      skillIds?: number[];
      useAIEnhancement?: boolean;
      questions?: string[];
      orderType?: string;
      workDurationPerClient?: number;
      weeklySchedule?: any;
      checkinRequiresApproval?: boolean;
      resourceBookingMode?: "select" | "auto" | "multi";
      requiredResourceCount?: number;
    }
  ) {
    // Validate user is authenticated
    if (!req.user || !req.user.userId) {
      throw new Error("User not authenticated. Please log in and try again.");
    }

    // Validate location is provided
    if (!body.location || !body.location.trim()) {
      throw new BadRequestException("Location is required");
    }

    const location = body.location.trim();

    return this.ordersService.createOrder(
      req.user.userId,
      body.categoryId,
      body.title,
      body.description,
      body.budget,
      location,
      body.currency,
      body.rateUnit,
      body.availableDates,
      body.skills,
      body.skillIds,
      body.useAIEnhancement ?? false,
      body.questions,
      body.orderType || "one_time",
      body.workDurationPerClient,
      body.weeklySchedule,
      body.checkinRequiresApproval ?? false,
      body.resourceBookingMode,
      body.requiredResourceCount
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("create-with-media")
  async createWithMedia(
    @Request() req,
    @Body()
    body: {
      categoryId?: number;
      title: string;
      description: string;
      budget: number;
      currency?: string;
      rateUnit?: string;
      availableDates?: string[];
      location: string;
      skills?: string[];
      skillIds?: number[];
      mediaFiles?: Array<{
        fileName: string;
        fileUrl: string;
        fileType: string;
        mimeType: string;
        fileSize: number;
      }>;
      useAIEnhancement?: boolean;
      questions?: string[];
      orderType?: string;
      workDurationPerClient?: number;
      weeklySchedule?: any;
      checkinRequiresApproval?: boolean;
      resourceBookingMode?: "select" | "auto" | "multi";
      requiredResourceCount?: number;
    }
  ) {
    // Validate location is provided
    if (!body.location || !body.location.trim()) {
      throw new BadRequestException("Location is required");
    }

    const location = body.location.trim();

    return this.ordersService.createOrderWithMedia(
      req.user.userId,
      body.categoryId,
      body.title,
      body.description,
      body.budget,
      location,
      body.currency,
      body.rateUnit,
      body.availableDates,
      body.skills,
      body.skillIds,
      body.mediaFiles || [],
      body.useAIEnhancement ?? false,
      body.questions,
      body.orderType || "one_time",
      body.workDurationPerClient,
      body.weeklySchedule,
      body.checkinRequiresApproval ?? false,
      body.resourceBookingMode,
      body.requiredResourceCount
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("status") status?: string,
    @Query("categoryId") categoryId?: string,
    @Query("categoryIds") categoryIds?: string,
    @Query("clientId") clientId?: string,
    @Query("orderType") orderType?: string,
    @Query("country") country?: string,
    @Request() req?: any
  ) {
    // Parse categoryIds from comma-separated string or single categoryId
    let parsedCategoryIds: number[] | undefined;
    if (categoryIds) {
      parsedCategoryIds = categoryIds
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
    }

    // Check if user is admin (optional, for admin access to all orders)
    const isAdmin = req?.user?.role === "admin";
    // Get authenticated user ID (optional - endpoint is public but can have authenticated users)
    const userId = req?.user?.userId;

    return this.ordersService.findAll(
      parseInt(page),
      parseInt(limit),
      status,
      categoryId ? parseInt(categoryId) : undefined,
      parsedCategoryIds && parsedCategoryIds.length > 0
        ? parsedCategoryIds
        : undefined,
      clientId ? parseInt(clientId) : undefined,
      isAdmin,
      userId,
      orderType,
      country
    );
  }

  @Get("search")
  async searchOrders(
    @Query("q") query: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("categoryIds") categoryIds?: string,
    @Query("orderType") orderType?: string,
    @Query("country") country?: string
  ) {
    if (!query) {
      return {
        orders: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    // Parse categoryIds from comma-separated string
    let parsedCategoryIds: number[] | undefined;
    if (categoryIds) {
      parsedCategoryIds = categoryIds
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
    }

    return this.ordersService.searchOrders(
      query,
      parseInt(page),
      parseInt(limit),
      parsedCategoryIds && parsedCategoryIds.length > 0
        ? parsedCategoryIds
        : undefined,
      orderType,
      country
    );
  }

  @Get("client/:clientId")
  async getOrdersByClient(
    @Param("clientId") clientId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.ordersService.getOrdersByClient(
      +clientId,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("category/:categoryId")
  async getOrdersByCategory(
    @Param("categoryId") categoryId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.ordersService.getOrdersByCategory(
      +categoryId,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("status/:status")
  async getOrdersByStatus(
    @Param("status") status: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.ordersService.getOrdersByStatus(
      status,
      parseInt(page),
      parseInt(limit)
    );
  }

  // @UseGuards(JwtAuthGuard)
  @Get("available")
  async getAvailableOrders(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("categoryId") categoryId?: string,
    @Query("location") location?: string,
    @Query("budgetMin") budgetMin?: string,
    @Query("budgetMax") budgetMax?: string
  ) {
    return this.ordersService.getAvailableOrders(
      parseInt(page),
      parseInt(limit),
      categoryId ? parseInt(categoryId) : undefined,
      location,
      budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax ? parseFloat(budgetMax) : undefined
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-orders")
  async getMyOrders(@Request() req) {
    return this.ordersService.getOrdersByClient(req.user.userId, 1, 50);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-jobs")
  async getMyJobs(@Request() req) {
    return this.ordersService.getOrdersBySpecialist(req.user.userId, 1, 50);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/change-history")
  async getChangeHistory(@Param("id") id: string) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }
    return this.ordersService.getOrderChangeHistory(orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/save")
  async saveOrder(@Request() req, @Param("id") id: string) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }
    return this.ordersService.saveOrder(req.user.userId, orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/save")
  async unsaveOrder(@Request() req, @Param("id") id: string) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }
    return this.ordersService.unsaveOrder(req.user.userId, orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("saved/all")
  async getSavedOrders(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.ordersService.getSavedOrders(
      req.user.userId,
      pageNum,
      limitNum
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/is-saved")
  async isOrderSaved(@Request() req, @Param("id") id: string) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }
    const isSaved = await this.ordersService.isOrderSaved(
      req.user.userId,
      orderId
    );
    return { isSaved };
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @Req() req: ExpressRequest,
    @Res() res: Response
  ) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${id}`);
    }
    
    // Check if this is a web browser request (for Universal Links)
    const acceptHeader = req.headers['accept'] || '';
    const isWebRequest =
    acceptHeader.includes("text/html") ||
    req.headers["user-agent"]?.includes("Mozilla");
    
    if (isWebRequest) {
      // Serve HTML page for Universal Links
      const order = await this.ordersService.findOne(orderId);
      const safeTitle = (order.title || "")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      const safeDescription = (order.description || "")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order #${orderId} - HotWork</title>
  <meta name="description" content="${safeTitle}">
  
  <!-- Universal Links / App Links meta tags -->
  <meta property="al:ios:url" content="jobportalmobile://orders/${orderId}">
  <meta property="al:ios:app_name" content="HotWork">
  <meta property="al:android:url" content="jobportalmobile://orders/${orderId}">
  <meta property="al:android:app_name" content="HotWork">
  <meta property="al:android:package" content="com.jobportalmobile.app">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { margin: 0 0 16px 0; color: #333; }
    .order-info { margin: 16px 0; }
    .order-info p { margin: 8px 0; color: #666; }
    .open-app-btn {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #007AFF;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
  </style>
  
  <script>
    // Try to open the app immediately
    window.location.href = "jobportalmobile://orders/${orderId}";
    
    // Fallback: if app doesn't open after 2 seconds, show the page
    setTimeout(function() {
      document.getElementById('fallback').style.display = 'block';
      document.getElementById('loading').style.display = 'none';
    }, 2000);
  </script>
</head>
<body>
  <div class="container">
    <h1>Order #${orderId}</h1>
    <div id="loading" style="text-align: center; margin-top: 20px; color: #999;">
      Opening in app...
    </div>
    <div id="fallback" style="display: none;">
      <div class="order-info">
        <p><strong>Title:</strong> ${safeTitle || "N/A"}</p>
        <p><strong>Description:</strong> ${safeDescription || "N/A"}</p>
        <p><strong>Budget:</strong> ${order.budget || "N/A"} ${order.currency || ""}</p>
        <p><strong>Status:</strong> ${order.status || "N/A"}</p>
      </div>
      <a href="jobportalmobile://orders/${orderId}" class="open-app-btn">
        Open in HotWork App
      </a>
    </div>
  </div>
</body>
</html>`;
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    }

    // Return JSON for API requests
    const order = await this.ordersService.findOne(orderId);
    return res.json(order);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body()
    body: {
      categoryId?: number;
      title?: string;
      description?: string;
      budget?: number;
      currency?: string;
      rateUnit?: string;
      status?: string;
      useAIEnhancement?: boolean;
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
      resourceBookingMode?: "select" | "auto" | "multi";
      requiredResourceCount?: number;
    },
    @Request() req
  ) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${id}`);
    }

    // Extract useAIEnhancement and exclude it from updateOrderDto
    const { useAIEnhancement, ...updateOrderDto } = body;

    return this.ordersService.update(
      orderId,
      updateOrderDto,
      req.user.userId,
      useAIEnhancement ?? false
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${id}`);
    }
    return this.ordersService.remove(orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { status: string },
    @Request() req
  ) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${id}`);
    }
    return this.ordersService.updateOrderStatus(
      orderId,
      body.status,
      req.user.userId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/banner-image")
  async setBannerImage(
    @Param("id") id: string,
    @Body() body: { mediaFileId: number },
    @Request() req
  ) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${id}`);
    }

    // Verify user is the owner of the order
    const order = await this.ordersService.findOne(orderId);
    if (order.clientId !== req.user.userId) {
      throw new BadRequestException(
        "You can only set banner image for your own orders"
      );
    }

    return this.ordersService.setBannerImage(orderId, body.mediaFileId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("preview-ai-enhancement")
  async previewAIEnhancement(
    @Body()
    body: {
      title: string;
      description: string;
    }
  ) {
    if (!body.title || !body.title.trim()) {
      throw new BadRequestException("Title is required");
    }

    if (!body.description || !body.description.trim()) {
      throw new BadRequestException("Description is required");
    }

    // Check if AI service is available
    if (!this.aiService.isAvailable()) {
      throw new BadRequestException(
        "AI enhancement is not available. Please contact support."
      );
    }

    // Call AI service to enhance text (no credit deduction, no save)
    const enhanced = await this.aiService.enhanceOrderText(
      body.title.trim(),
      body.description.trim()
    );

    return {
      original: {
        title: body.title.trim(),
        description: body.description.trim(),
      },
      enhanced: {
        titleEn: enhanced.titleEn,
        titleRu: enhanced.titleRu,
        titleHy: enhanced.titleHy,
        descriptionEn: enhanced.descriptionEn,
        descriptionRu: enhanced.descriptionRu,
        descriptionHy: enhanced.descriptionHy,
        detectedLanguage: enhanced.detectedLanguage,
      },
    };
  }

  @UseGuards(AdminGuard)
  @Post(":id/approve")
  async approveOrder(@Param("id") id: string, @Request() req) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }
    return this.ordersService.approveOrder(orderId, req.user.userId);
  }

  @UseGuards(AdminGuard)
  @Post(":id/reject")
  async rejectOrder(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Request() req
  ) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }
    return this.ordersService.rejectOrder(
      orderId,
      req.user.userId,
      body.reason
    );
  }

  @Get(":id/available-slots")
  async getAvailableSlots(
    @Param("id") id: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("marketMemberId") marketMemberId?: string
  ) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const memberId = marketMemberId ? parseInt(marketMemberId, 10) : undefined;

    return this.ordersService.getAvailableSlots(orderId, start, end, memberId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/publish")
  async publishPermanentOrder(@Param("id") id: string, @Request() req) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }
    return this.ordersService.publishPermanentOrder(orderId, req.user.userId);
  }
}
