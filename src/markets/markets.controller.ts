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
  ParseIntPipe,
} from "@nestjs/common";
import { MarketsService } from "./markets.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";

@Controller("markets")
export class MarketsController {
  constructor(
    private marketsService: MarketsService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req,
    @Body()
    body: {
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
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketsService.createMarket(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/publish")
  async publish(@Param("id") id: string, @Request() req) {
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketsService.publishMarket(marketId, req.user.userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("location") location?: string,
    @Query("verified") verified?: string,
    @Query("search") search?: string,
    @Query("myServices") myServices?: string,
    @Request() req?: any
  ) {
    const filters: any = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    };

    // Only allow filtering by status if user is admin or viewing their own markets
    const userId = req?.user?.userId;
    const isAdmin = req?.user?.role === "admin";

    // Check if user wants to see their own services
    if (myServices === "true" && userId) {
      filters.createdBy = userId;
      // Don't filter by status when viewing own services - show all statuses
    } else if (status && (isAdmin || status === "draft")) {
      filters.status = status;
    }

    if (location) {
      filters.location = location;
    }

    if (verified !== undefined) {
      filters.verified = verified === "true";
    }

    if (search) {
      filters.search = search;
    }

    return this.marketsService.getMarkets(filters);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(":id")
  async findOne(@Param("id") id: string) {
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    return this.marketsService.getMarketById(marketId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Request() req,
    @Body()
    body: {
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
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketsService.updateMarket(marketId, req.user.userId, body);
  }

  @UseGuards(AdminGuard)
  @Post(":id/approve")
  async approve(@Param("id") id: string, @Request() req) {
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    return this.marketsService.approveMarket(marketId, req.user.userId);
  }

  @UseGuards(AdminGuard)
  @Post(":id/reject")
  async reject(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { rejectionReason: string }
  ) {
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    if (!body.rejectionReason) {
      throw new BadRequestException("Rejection reason is required");
    }

    return this.marketsService.rejectMarket(
      marketId,
      req.user.userId,
      body.rejectionReason
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/members")
  async addMember(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { userId: number; role?: string }
  ) {
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (!body.userId) {
      throw new BadRequestException("userId is required");
    }

    return this.marketsService.addMember(
      marketId,
      body.userId,
      req.user.userId,
      body.role || "member"
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/members/:memberId")
  async updateMember(
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Request() req,
    @Body() body: { role: string }
  ) {
    const marketId = parseInt(id, 10);
    const memberIdNum = parseInt(memberId, 10);

    if (isNaN(marketId) || isNaN(memberIdNum)) {
      throw new BadRequestException("Invalid market ID or member ID");
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (!body.role) {
      throw new BadRequestException("role is required");
    }

    return this.marketsService.updateMemberRole(
      marketId,
      memberIdNum,
      req.user.userId,
      body.role
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/members/:memberId")
  async removeMember(
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Request() req
  ) {
    const marketId = parseInt(id, 10);
    const memberIdNum = parseInt(memberId, 10);

    if (isNaN(marketId) || isNaN(memberIdNum)) {
      throw new BadRequestException("Invalid market ID or member ID");
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketsService.removeMember(
      marketId,
      memberIdNum,
      req.user.userId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/orders")
  async addOrder(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { orderId: number }
  ) {
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (!body.orderId) {
      throw new BadRequestException("orderId is required");
    }

    return this.marketsService.addOrder(
      marketId,
      body.orderId,
      req.user.userId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id/orders/:orderId")
  async removeOrder(
    @Param("id") id: string,
    @Param("orderId") orderId: string,
    @Request() req
  ) {
    const marketId = parseInt(id, 10);
    const orderIdNum = parseInt(orderId, 10);

    if (isNaN(marketId) || isNaN(orderIdNum)) {
      throw new BadRequestException("Invalid market ID or order ID");
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketsService.removeOrder(
      marketId,
      orderIdNum,
      req.user.userId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/banner")
  async setBanner(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { mediaFileId: number }
  ) {
    const marketId = parseInt(id, 10);
    if (isNaN(marketId)) {
      throw new BadRequestException(`Invalid market ID: ${id}`);
    }

    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (!body.mediaFileId) {
      throw new BadRequestException("mediaFileId is required");
    }

    return this.marketsService.setBannerImage(marketId, body.mediaFileId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("invitations/pending")
  async getPendingInvitations(@Request() req) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }
    return this.marketsService.getPendingMarketInvitations(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("invitations/:marketMemberId/accept")
  async acceptInvitation(
    @Request() req,
    @Param("marketMemberId", ParseIntPipe) marketMemberId: number
  ) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }
    return this.marketsService.acceptMarketInvitation(
      req.user.userId,
      marketMemberId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("invitations/:marketMemberId/reject")
  async rejectInvitation(
    @Request() req,
    @Param("marketMemberId", ParseIntPipe) marketMemberId: number
  ) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }
    return this.marketsService.rejectMarketInvitation(
      req.user.userId,
      marketMemberId
    );
  }

  /**
   * Get market members (specialists) for an order
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(":id/specialists")
  async getMarketSpecialists(
    @Param("id", ParseIntPipe) marketId: number
  ) {
    const market = await this.marketsService.getMarketById(marketId);
    return market.Members.filter(
      (member) => member.status === "accepted" && member.isActive
    );
  }

}
