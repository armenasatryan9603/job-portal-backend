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
  NotFoundException,
} from "@nestjs/common";
import { OrderProposalsService } from "./order-proposals.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("order-proposals")
export class OrderProposalsController {
  constructor(private readonly orderProposalsService: OrderProposalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body()
    createOrderProposalDto: {
      orderId: number;
      userId: number;
      price?: number;
      message?: string;
    }
  ) {
    return this.orderProposalsService.create(createOrderProposalDto);
  }

  @Post("apply")
  @UseGuards(JwtAuthGuard)
  async createWithCreditDeduction(
    @Request() req,
    @Body()
    createOrderProposalDto: {
      orderId: number;
      message?: string;
      questionAnswers?: Array<{ questionId: number; answer: string }>;
    }
  ) {
    try {
      console.log("Received apply request:", {
        orderId: createOrderProposalDto.orderId,
        hasMessage: !!createOrderProposalDto.message,
        hasQuestionAnswers: !!createOrderProposalDto.questionAnswers,
        userId: req.user?.userId,
      });

      // Get userId from JWT token
      const userId = req.user?.userId;

      if (!userId) {
        throw new BadRequestException(
          "User ID not found in authentication token"
        );
      }

      // Validate orderId
      if (!createOrderProposalDto.orderId) {
        throw new BadRequestException("Order ID is required");
      }

      // Ensure orderId is a number
      const orderId =
        typeof createOrderProposalDto.orderId === "string"
          ? parseInt(createOrderProposalDto.orderId, 10)
          : createOrderProposalDto.orderId;

      if (isNaN(orderId) || orderId <= 0) {
        throw new BadRequestException("Invalid order ID");
      }

      return await this.orderProposalsService.createWithCreditDeduction({
        orderId: orderId,
        message: createOrderProposalDto.message,
        userId: userId,
        questionAnswers: createOrderProposalDto.questionAnswers,
      });
    } catch (error) {
      console.error("Error in createWithCreditDeduction:", error);
      console.error("Error stack:", error?.stack);
      // Re-throw HTTP exceptions as-is
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      // Wrap other errors in BadRequestException with more details
      const errorMessage = error?.message || "Failed to create proposal";
      console.error("Wrapping error as BadRequestException:", errorMessage);
      throw new BadRequestException(errorMessage);
    }
  }

  @Get()
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("status") status?: string,
    @Query("orderId") orderId?: string,
    @Query("userId") userId?: string
  ) {
    return this.orderProposalsService.findAll(
      parseInt(page),
      parseInt(limit),
      status,
      orderId ? parseInt(orderId) : undefined,
      userId ? parseInt(userId) : undefined
    );
  }

  @Get("search")
  async searchProposals(
    @Query("q") query: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    if (!query) {
      return {
        proposals: [],
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

    return this.orderProposalsService.searchProposals(
      query,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("order/:orderId")
  async getProposalsByOrder(
    @Param("orderId") orderId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.orderProposalsService.getProposalsByOrder(
      +orderId,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("user/:userId")
  async getProposalsByUser(
    @Param("userId") userId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.orderProposalsService.getProposalsByUser(
      +userId,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("status/:status")
  async getProposalsByStatus(
    @Param("status") status: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.orderProposalsService.getProposalsByStatus(
      status,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.orderProposalsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body()
    updateOrderProposalDto: {
      price?: number;
      message?: string;
      status?: string;
    }
  ) {
    return this.orderProposalsService.update(+id, updateOrderProposalDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.orderProposalsService.remove(+id);
  }
}
