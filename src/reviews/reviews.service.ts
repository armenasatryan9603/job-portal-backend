import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(createReviewDto: {
    orderId: number;
    reviewerId: number;
    specialistId?: number;
    rating: number;
    comment?: string;
  }) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: createReviewDto.orderId },
    });

    if (!order) {
      throw new BadRequestException(
        `Order with ID ${createReviewDto.orderId} not found`,
      );
    }

    // Check if order is completed (or if it's a permanent order, allow reviews)
    // Permanent orders can't be completed, so we allow reviews for them regardless of status
    if (order.orderType !== 'permanent' && order.status !== 'completed') {
      throw new BadRequestException('Can only review completed orders');
    }

    // Check if reviewer exists
    const reviewer = await this.prisma.user.findUnique({
      where: { id: createReviewDto.reviewerId },
    });

    if (!reviewer) {
      throw new BadRequestException(
        `Reviewer with ID ${createReviewDto.reviewerId} not found`,
      );
    }

    // For permanent orders, allow any logged-in user to review
    // For one-time orders, only client or hired specialist can review
    const isClient = order.clientId === createReviewDto.reviewerId;
    const isHiredSpecialist = await this.isHiredSpecialist(
      order.id,
      createReviewDto.reviewerId,
    );

    if (order.orderType !== 'permanent') {
      // For one-time orders, restrict to client or hired specialist
      if (!isClient && !isHiredSpecialist) {
        throw new BadRequestException(
          'Only the client or hired specialist can review this order',
        );
      }
    }
    // For permanent orders, any logged-in user can review (no restriction)

    // Determine the specialist ID based on who is reviewing
    let specialistId = createReviewDto.specialistId;
    if (order.orderType === 'permanent') {
      // For permanent orders, specialistId is optional (can be undefined)
      // The review is about the order/service itself, not a specific specialist
    } else if (isClient && !specialistId) {
      // If client is reviewing a one-time order, get the hired specialist
      const acceptedProposal = await this.getAcceptedProposal(order.id);
      specialistId = acceptedProposal?.userId;
    } else if (isHiredSpecialist) {
      // If specialist is reviewing, they are reviewing the client
      specialistId = createReviewDto.reviewerId;
    }

    // Check if specialist exists (if we have a specialistId)
    if (specialistId) {
      const specialist = await this.prisma.user.findUnique({
        where: { id: specialistId },
      });

      if (!specialist) {
        throw new BadRequestException(
          `Specialist with ID ${specialistId} not found`,
        );
      }
    }

    // Validate rating
    if (createReviewDto.rating < 1 || createReviewDto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check if reviewer already reviewed this order
    const existingReview = await this.prisma.review.findFirst({
      where: {
        orderId: createReviewDto.orderId,
        reviewerId: createReviewDto.reviewerId,
      },
    });

    if (existingReview) {
      throw new BadRequestException('Reviewer already reviewed this order');
    }

    return this.prisma.review.create({
      data: {
        ...createReviewDto,
        specialistId,
      },
      include: {
        Order: {
          include: {
            Client: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
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

  async findAll(
    page: number = 1,
    limit: number = 10,
    orderId?: number,
    reviewerId?: number,
    specialistId?: number,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (orderId) {
      where.orderId = orderId;
    }

    if (reviewerId) {
      where.reviewerId = reviewerId;
    }

    if (specialistId) {
      where.specialistId = specialistId;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          Order: {
            include: {
              Client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
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

  async findOne(id: number) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        Order: {
          include: {
            Client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatarUrl: true,
                bio: true,
              },
            },
          },
        },
        Reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  async update(
    id: number,
    updateReviewDto: {
      rating?: number;
      comment?: string;
    },
  ) {
    // Check if review exists
    const existingReview = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!existingReview) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    // Validate rating
    if (updateReviewDto.rating !== undefined) {
      if (updateReviewDto.rating < 1 || updateReviewDto.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }
    }

    return this.prisma.review.update({
      where: { id },
      data: updateReviewDto,
      include: {
        Order: {
          include: {
            Client: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
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

  async remove(id: number) {
    // Check if review exists
    const existingReview = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!existingReview) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return this.prisma.review.delete({
      where: { id },
    });
  }

  async getReviewsByOrder(
    orderId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll(page, limit, orderId);
  }

  async getReviewsByReviewer(
    reviewerId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll(page, limit, undefined, reviewerId);
  }

  async getReviewsBySpecialist(
    specialistId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll(page, limit, undefined, undefined, specialistId);
  }

  async getAverageRating(specialistId?: number) {
    const where = specialistId ? { specialistId } : {};

    const result = await this.prisma.review.aggregate({
      where,
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return {
      averageRating: result._avg.rating || 0,
      totalReviews: result._count.rating,
    };
  }

  async getRatingDistribution(specialistId?: number) {
    const where = specialistId ? { specialistId } : {};

    const distribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: {
        rating: true,
      },
      orderBy: {
        rating: 'asc',
      },
    });

    return distribution.map((item) => ({
      rating: item.rating,
      count: item._count.rating,
    }));
  }

  async searchReviews(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          OR: [
            { comment: { contains: query, mode: 'insensitive' } },
            {
              Order: {
                title: { contains: query, mode: 'insensitive' },
              },
            },
            {
              Order: {
                description: { contains: query, mode: 'insensitive' },
              },
            },
            {
              Reviewer: {
                name: { contains: query, mode: 'insensitive' },
              },
            },
          ],
        },
        skip,
        take: limit,
        include: {
          Order: {
            include: {
              Client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({
        where: {
          OR: [
            { comment: { contains: query, mode: 'insensitive' } },
            {
              Order: {
                title: { contains: query, mode: 'insensitive' },
              },
            },
            {
              Order: {
                description: { contains: query, mode: 'insensitive' },
              },
            },
            {
              Reviewer: {
                name: { contains: query, mode: 'insensitive' },
              },
            },
          ],
        },
      }),
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
   * Submit feedback for an order (completed or canceled)
   */
  async submitFeedback(feedbackDto: {
    orderId: number;
    reviewerId: number;
    specialistId?: number;
    rating: number;
    comment?: string;
    feedbackType: 'completed' | 'canceled';
    reasonIds?: number[]; // Array of reason IDs for negative feedback
  }) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: feedbackDto.orderId },
      include: {
        Proposals: {
          where: {
            status: 'accepted',
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException(
        `Order with ID ${feedbackDto.orderId} not found`,
      );
    }

    // Check if order is in the correct status
    if (
      feedbackDto.feedbackType === 'completed' &&
      order.status !== 'completed'
    ) {
      throw new BadRequestException(
        'Can only provide feedback for completed orders',
      );
    }

    if (feedbackDto.feedbackType === 'canceled' && order.status !== 'closed') {
      throw new BadRequestException(
        'Can only provide feedback for canceled orders when order status is closed',
      );
    }

    // Check if reviewer exists and is the client
    const reviewer = await this.prisma.user.findUnique({
      where: { id: feedbackDto.reviewerId },
    });

    if (!reviewer) {
      throw new BadRequestException(
        `Reviewer with ID ${feedbackDto.reviewerId} not found`,
      );
    }

    // Check if reviewer is either the client or the hired specialist
    const isClient = order.clientId === feedbackDto.reviewerId;
    const isHiredSpecialist = await this.isHiredSpecialist(
      order.id,
      feedbackDto.reviewerId,
    );

    // Also check if user is a participant in a conversation for this order
    // This is a fallback for cases where proposal status might not be 'accepted' or 'specialist-canceled'
    const isConversationParticipant = await this.isConversationParticipant(
      order.id,
      feedbackDto.reviewerId,
    );

    if (!isClient && !isHiredSpecialist && !isConversationParticipant) {
      throw new BadRequestException(
        'Only the client or hired specialist can provide feedback for this order',
      );
    }

    // Determine the specialist ID based on who is providing feedback
    let specialistId = feedbackDto.specialistId;
    if (isClient && !specialistId) {
      // If client is providing feedback, get the hired specialist
      const acceptedProposal = await this.getAcceptedProposal(order.id);
      specialistId = acceptedProposal?.userId;
    } else if (isHiredSpecialist || isConversationParticipant) {
      // If specialist is providing feedback, they are providing feedback about the client
      // Set specialistId to the reviewer's ID (the specialist themselves)
      specialistId = feedbackDto.reviewerId;
    }

    // Check if specialist exists (if we have a specialistId)
    if (specialistId) {
      const specialist = await this.prisma.user.findUnique({
        where: { id: specialistId },
      });

      if (!specialist) {
        throw new BadRequestException(
          `Specialist with ID ${specialistId} not found`,
        );
      }
    }

    // Validate rating
    if (feedbackDto.rating < 1 || feedbackDto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check if reviewer already provided feedback for this order
    const existingFeedback = await this.prisma.review.findFirst({
      where: {
        orderId: feedbackDto.orderId,
        reviewerId: feedbackDto.reviewerId,
      },
    });

    if (existingFeedback) {
      throw new BadRequestException('Feedback already provided for this order');
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        orderId: feedbackDto.orderId,
        reviewerId: feedbackDto.reviewerId,
        specialistId: specialistId,
        rating: feedbackDto.rating,
        comment: feedbackDto.comment,
        feedbackType: feedbackDto.feedbackType,
      },
      include: {
        Order: {
          include: {
            Client: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
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
        Specialist: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // If reason IDs are provided, create ReviewReason records
    if (feedbackDto.reasonIds && feedbackDto.reasonIds.length > 0) {
      await this.prisma.reviewReason.createMany({
        data: feedbackDto.reasonIds.map((reasonId) => ({
          reviewId: review.id,
          reasonId,
        })),
      });
    }

    // Return the review with reasons included
    return this.prisma.review.findUnique({
      where: { id: review.id },
      include: {
        Order: {
          include: {
            Client: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
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
        Specialist: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        ReviewReasons: {
          include: {
            reason: true,
          },
        },
      },
    });
  }

  /**
   * Helper method to check if a user is the hired specialist for an order
   */
  private async isHiredSpecialist(
    orderId: number,
    userId: number,
  ): Promise<boolean> {
    const proposal = await this.prisma.orderProposal.findFirst({
      where: {
        orderId,
        userId,
        status: {
          in: ['accepted', 'specialist-canceled'],
        },
      },
    });
    return !!proposal;
  }

  /**
   * Helper method to get the accepted proposal for an order
   */
  private async getAcceptedProposal(orderId: number) {
    return this.prisma.orderProposal.findFirst({
      where: {
        orderId,
        status: 'accepted',
      },
    });
  }

  /**
   * Helper method to check if a user is a participant in a conversation for an order
   * This is used as a fallback when proposal status might not match expected values
   */
  private async isConversationParticipant(
    orderId: number,
    userId: number,
  ): Promise<boolean> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        orderId,
        Participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
    });
    return !!conversation;
  }
}
