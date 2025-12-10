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
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { AIService } from "../ai/ai.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";

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
      serviceId?: number;
      title: string;
      description: string;
      budget: number;
      currency?: string;
      rateUnit?: string;
      availableDates?: string[];
      location?: string;
      skills?: string[];
      useAIEnhancement?: boolean;
      questions?: string[];
    }
  ) {
    // Validate user is authenticated
    if (!req.user || !req.user.userId) {
      throw new Error("User not authenticated. Please log in and try again.");
    }

    return this.ordersService.createOrder(
      req.user.userId,
      body.serviceId,
      body.title,
      body.description,
      body.budget,
      body.currency,
      body.rateUnit,
      body.availableDates,
      body.location,
      body.skills,
      body.useAIEnhancement ?? false,
      body.questions
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("create-with-media")
  async createWithMedia(
    @Request() req,
    @Body()
    body: {
      serviceId?: number;
      title: string;
      description: string;
      budget: number;
      currency?: string;
      rateUnit?: string;
      availableDates?: string[];
      location?: string;
      skills?: string[];
      mediaFiles?: Array<{
        fileName: string;
        fileUrl: string;
        fileType: string;
        mimeType: string;
        fileSize: number;
      }>;
      useAIEnhancement?: boolean;
      questions?: string[];
    }
  ) {
    return this.ordersService.createOrderWithMedia(
      req.user.userId,
      body.serviceId,
      body.title,
      body.description,
      body.budget,
      body.currency,
      body.rateUnit,
      body.availableDates,
      body.location,
      body.skills,
      body.mediaFiles || [],
      body.useAIEnhancement ?? false,
      body.questions
    );
  }

  @Get()
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("status") status?: string,
    @Query("serviceId") serviceId?: string,
    @Query("serviceIds") serviceIds?: string,
    @Query("clientId") clientId?: string,
    @Request() req?: any
  ) {
    // Parse serviceIds from comma-separated string or single serviceId
    let parsedServiceIds: number[] | undefined;
    if (serviceIds) {
      parsedServiceIds = serviceIds
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
    }

    // Check if user is admin (optional, for admin access to all orders)
    const isAdmin = req?.user?.role === "admin";

    return this.ordersService.findAll(
      parseInt(page),
      parseInt(limit),
      status,
      serviceId ? parseInt(serviceId) : undefined,
      parsedServiceIds && parsedServiceIds.length > 0
        ? parsedServiceIds
        : undefined,
      clientId ? parseInt(clientId) : undefined,
      isAdmin
    );
  }

  @Get("search")
  async searchOrders(
    @Query("q") query: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("serviceIds") serviceIds?: string
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

    // Parse serviceIds from comma-separated string
    let parsedServiceIds: number[] | undefined;
    if (serviceIds) {
      parsedServiceIds = serviceIds
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
    }

    return this.ordersService.searchOrders(
      query,
      parseInt(page),
      parseInt(limit),
      parsedServiceIds && parsedServiceIds.length > 0
        ? parsedServiceIds
        : undefined
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

  @Get("service/:serviceId")
  async getOrdersByService(
    @Param("serviceId") serviceId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.ordersService.getOrdersByService(
      +serviceId,
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
    @Query("serviceId") serviceId?: string,
    @Query("location") location?: string,
    @Query("budgetMin") budgetMin?: string,
    @Query("budgetMax") budgetMax?: string
  ) {
    return this.ordersService.getAvailableOrders(
      parseInt(page),
      parseInt(limit),
      serviceId ? parseInt(serviceId) : undefined,
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
  async findOne(@Param("id") id: string) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${id}`);
    }
    return this.ordersService.findOne(orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body()
    body: {
      serviceId?: number;
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
}
