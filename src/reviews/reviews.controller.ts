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
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body()
    createReviewDto: {
      orderId: number;
      reviewerId: number;
      specialistId?: number;
      rating: number;
      comment?: string;
    },
  ) {
    return this.reviewsService.create(createReviewDto);
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('orderId') orderId?: string,
    @Query('reviewerId') reviewerId?: string,
    @Query('specialistId') specialistId?: string,
  ) {
    return this.reviewsService.findAll(
      parseInt(page),
      parseInt(limit),
      orderId ? parseInt(orderId) : undefined,
      reviewerId ? parseInt(reviewerId) : undefined,
      specialistId ? parseInt(specialistId) : undefined,
    );
  }

  @Get('search')
  async searchReviews(
    @Query('q') query: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    if (!query) {
      return {
        reviews: [],
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

    return this.reviewsService.searchReviews(
      query,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('order/:orderId')
  async getReviewsByOrder(
    @Param('orderId') orderId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.reviewsService.getReviewsByOrder(
      +orderId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('reviewer/:reviewerId')
  async getReviewsByReviewer(
    @Param('reviewerId') reviewerId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.reviewsService.getReviewsByReviewer(
      +reviewerId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('specialist/:specialistId')
  async getReviewsBySpecialist(
    @Param('specialistId') specialistId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.reviewsService.getReviewsBySpecialist(
      +specialistId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('rating/average')
  async getAverageRating(@Query('specialistId') specialistId?: string) {
    return this.reviewsService.getAverageRating(
      specialistId ? parseInt(specialistId) : undefined,
    );
  }

  @Get('rating/distribution')
  async getRatingDistribution(@Query('specialistId') specialistId?: string) {
    return this.reviewsService.getRatingDistribution(
      specialistId ? parseInt(specialistId) : undefined,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    updateReviewDto: {
      rating?: number;
      comment?: string;
    },
  ) {
    return this.reviewsService.update(+id, updateReviewDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reviewsService.remove(+id);
  }

  @Post('feedback')
  @UseGuards(JwtAuthGuard)
  async submitFeedback(
    @Body()
    feedbackDto: {
      orderId: number;
      specialistId?: number;
      rating: number;
      comment?: string;
      feedbackType: 'completed' | 'canceled';
      reasonIds?: number[]; // Array of reason IDs for negative feedback
    },
    @Request() req,
  ) {
    const reviewerId = req.user.userId;
    return this.reviewsService.submitFeedback({
      ...feedbackDto,
      reviewerId,
    });
  }
}
