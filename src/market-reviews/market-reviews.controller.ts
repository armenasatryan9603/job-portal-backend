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
import { MarketReviewsService } from "./market-reviews.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("market-reviews")
export class MarketReviewsController {
  constructor(private readonly marketReviewsService: MarketReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req,
    @Body()
    body: {
      marketId: number;
      rating: number;
      comment?: string;
    }
  ) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketReviewsService.createReview({
      marketId: body.marketId,
      reviewerId: req.user.userId,
      rating: body.rating,
      comment: body.comment,
    });
  }

  @Get("market/:marketId")
  async getReviewsByMarket(
    @Param("marketId") marketId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.marketReviewsService.getReviews(
      parseInt(marketId, 10),
      parseInt(page, 10),
      parseInt(limit, 10)
    );
  }

  @Get("market/:marketId/rating")
  async getAverageRating(@Param("marketId") marketId: string) {
    return this.marketReviewsService.getAverageRating(
      parseInt(marketId, 10)
    );
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.marketReviewsService.getReview(parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Request() req,
    @Body()
    body: {
      rating?: number;
      comment?: string;
    }
  ) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketReviewsService.updateReview(
      parseInt(id, 10),
      req.user.userId,
      body
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @Request() req) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketReviewsService.deleteReview(
      parseInt(id, 10),
      req.user.userId
    );
  }
}
