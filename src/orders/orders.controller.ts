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
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

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
      availableDates?: string[];
      location?: string;
      skills?: string[];
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
      body.availableDates,
      body.location,
      body.skills
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
    }
  ) {
    return this.ordersService.createOrderWithMedia(
      req.user.userId,
      body.serviceId,
      body.title,
      body.description,
      body.budget,
      body.availableDates,
      body.location,
      body.skills,
      body.mediaFiles || []
    );
  }

  @Get()
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("status") status?: string,
    @Query("serviceId") serviceId?: string,
    @Query("clientId") clientId?: string
  ) {
    return this.ordersService.findAll(
      parseInt(page),
      parseInt(limit),
      status,
      serviceId ? parseInt(serviceId) : undefined,
      clientId ? parseInt(clientId) : undefined
    );
  }

  @Get("search")
  async searchOrders(
    @Query("q") query: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
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

    return this.ordersService.searchOrders(
      query,
      parseInt(page),
      parseInt(limit)
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
    updateOrderDto: {
      serviceId?: number;
      title?: string;
      description?: string;
      budget?: number;
      status?: string;
    }
  ) {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${id}`);
    }
    return this.ordersService.update(orderId, updateOrderDto);
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
}
