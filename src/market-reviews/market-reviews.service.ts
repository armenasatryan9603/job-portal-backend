import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class MarketReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a review for a market
   */
  async createReview(data: {
    marketId: number;
    reviewerId: number;
    rating: number;
    comment?: string;
  }) {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException("Rating must be between 1 and 5");
    }

    // Check if market exists
    const market = await this.prisma.market.findUnique({
      where: { id: data.marketId },
    });

    if (!market) {
      throw new NotFoundException(
        `Market with ID ${data.marketId} not found`
      );
    }

    // Check if market is active
    if (market.status !== "active") {
      throw new BadRequestException("Can only review active markets");
    }

    // Check if reviewer exists
    const reviewer = await this.prisma.user.findUnique({
      where: { id: data.reviewerId },
    });

    if (!reviewer) {
      throw new NotFoundException(
        `Reviewer with ID ${data.reviewerId} not found`
      );
    }

    // Check if reviewer already reviewed this market
    const existingReview = await this.prisma.marketReview.findFirst({
      where: {
        marketId: data.marketId,
        reviewerId: data.reviewerId,
      },
    });

    if (existingReview) {
      throw new BadRequestException(
        "You have already reviewed this market"
      );
    }

    return this.prisma.marketReview.create({
      data: {
        marketId: data.marketId,
        reviewerId: data.reviewerId,
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
          },
        },
        Reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Get reviews for a market
   */
  async getReviews(marketId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.marketReview.findMany({
        where: { marketId },
        skip,
        take: limit,
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
      }),
      this.prisma.marketReview.count({ where: { marketId } }),
    ]);

    return {
      reviews,
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
   * Get a single review
   */
  async getReview(id: number) {
    const review = await this.prisma.marketReview.findUnique({
      where: { id },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
          },
        },
        Reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  /**
   * Update a review
   */
  async updateReview(
    id: number,
    reviewerId: number,
    data: { rating?: number; comment?: string }
  ) {
    const review = await this.prisma.marketReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    // Check ownership
    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException(
        "You can only update your own reviews"
      );
    }

    // Validate rating if provided
    if (data.rating !== undefined) {
      if (data.rating < 1 || data.rating > 5) {
        throw new BadRequestException("Rating must be between 1 and 5");
      }
    }

    return this.prisma.marketReview.update({
      where: { id },
      data: {
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.comment !== undefined && { comment: data.comment }),
      },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
          },
        },
        Reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Delete a review
   */
  async deleteReview(id: number, reviewerId: number) {
    const review = await this.prisma.marketReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    // Check ownership
    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException(
        "You can only delete your own reviews"
      );
    }

    await this.prisma.marketReview.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Calculate average rating for a market
   */
  async getAverageRating(marketId: number) {
    const reviews = await this.prisma.marketReview.findMany({
      where: { marketId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return { averageRating: 0, totalReviews: 0 };
    }

    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = Math.round((sum / reviews.length) * 10) / 10;

    return {
      averageRating,
      totalReviews: reviews.length,
    };
  }
}
