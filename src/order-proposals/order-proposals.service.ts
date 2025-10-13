import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderPricingService } from '../order-pricing/order-pricing.service';

@Injectable()
export class OrderProposalsService {
  constructor(
    private prisma: PrismaService,
    private orderPricingService: OrderPricingService,
  ) {}

  async create(createOrderProposalDto: {
    orderId: number;
    userId: number;
    price?: number;
    message?: string;
  }) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: createOrderProposalDto.orderId },
    });

    if (!order) {
      throw new BadRequestException(
        `Order with ID ${createOrderProposalDto.orderId} not found`,
      );
    }

    // Check if order is still open
    if (order.status !== 'open') {
      throw new BadRequestException('Cannot create proposal for closed order');
    }

    // Check if user exists and is a specialist
    const user = await this.prisma.user.findUnique({
      where: { id: createOrderProposalDto.userId, role: 'specialist' },
    });

    if (!user) {
      throw new BadRequestException(
        `Specialist user with ID ${createOrderProposalDto.userId} not found`,
      );
    }

    // Check if user already has a proposal for this order
    const existingProposal = await this.prisma.orderProposal.findFirst({
      where: {
        orderId: createOrderProposalDto.orderId,
        userId: createOrderProposalDto.userId,
      },
    });

    if (existingProposal) {
      throw new BadRequestException(
        'User already has a proposal for this order',
      );
    }

    return this.prisma.orderProposal.create({
      data: {
        orderId: createOrderProposalDto.orderId,
        userId: createOrderProposalDto.userId,
        message: createOrderProposalDto.message,
        price: createOrderProposalDto.price,
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
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
      },
    });
  }

  async createWithCreditDeduction(createOrderProposalDto: {
    orderId: number;
    userId: number;
    price?: number;
    message?: string;
  }) {
    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Check if order exists
      const order = await tx.order.findUnique({
        where: { id: createOrderProposalDto.orderId },
      });

      if (!order) {
        throw new BadRequestException(
          `Order with ID ${createOrderProposalDto.orderId} not found`,
        );
      }

      // Get dynamic pricing based on order budget
      const applicationCost = await this.orderPricingService.getCreditCost(
        order.budget || 0,
      );

      // Check if order is still open
      if (order.status !== 'open') {
        throw new BadRequestException(
          'Cannot create proposal for closed order',
        );
      }

      // Check if user exists
      const user = await tx.user.findUnique({
        where: { id: createOrderProposalDto.userId },
      });

      if (!user) {
        throw new BadRequestException(
          `User with ID ${createOrderProposalDto.userId} not found`,
        );
      }

      // Check if user has sufficient credits
      console.log(
        'User credit balance:',
        user.creditBalance,
        'Required:',
        applicationCost,
        'Order budget:',
        order.budget,
      );
      if (user.creditBalance < applicationCost) {
        throw new BadRequestException(
          `Insufficient credit balance. Required: ${applicationCost} credits, Available: ${user.creditBalance} credits`,
        );
      }

      // Check if user already has a proposal for this order
      const existingProposal = await tx.orderProposal.findFirst({
        where: {
          orderId: createOrderProposalDto.orderId,
          userId: createOrderProposalDto.userId,
        },
      });

      if (existingProposal) {
        throw new BadRequestException(
          'User already has a proposal for this order',
        );
      }

      // Deduct credits from user
      console.log('Deducting credits from user...');
      await tx.user.update({
        where: { id: createOrderProposalDto.userId },
        data: { creditBalance: { decrement: applicationCost } },
      });

      // Create the proposal
      console.log('Creating proposal...');
      const proposal = await tx.orderProposal.create({
        data: {
          orderId: createOrderProposalDto.orderId,
          userId: createOrderProposalDto.userId,
          message: createOrderProposalDto.message,
          price: createOrderProposalDto.price,
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
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              verified: true,
            },
          },
        },
      });

      // Create conversation between client and specialist
      console.log('Creating conversation...');

      // Check if conversation already exists between client and specialist
      const existingConversation = await tx.conversation.findFirst({
        where: {
          orderId: createOrderProposalDto.orderId,
          Participants: {
            some: {
              userId: order.clientId,
              isActive: true,
            },
          },
          AND: {
            Participants: {
              some: {
                userId: createOrderProposalDto.userId,
                isActive: true,
              },
            },
          },
        },
      });

      if (!existingConversation) {
        // Create new conversation
        await tx.conversation.create({
          data: {
            orderId: createOrderProposalDto.orderId,
            status: 'active',
            Participants: {
              create: [
                {
                  userId: order.clientId, // Client
                  isActive: true,
                },
                {
                  userId: createOrderProposalDto.userId, // Specialist
                  isActive: true,
                },
              ],
            },
            Messages: {
              create: {
                content:
                  createOrderProposalDto.message ||
                  'I am interested in this project',
                senderId: createOrderProposalDto.userId, // Specialist sends the message
                messageType: 'text',
              },
            },
          },
        });
        console.log('Conversation created successfully');
      } else {
        console.log('Conversation already exists');
      }

      console.log('Proposal created successfully:', proposal);
      return proposal;
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    orderId?: number,
    userId?: number,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (userId) {
      where.userId = userId;
    }

    const [proposals, total] = await Promise.all([
      this.prisma.orderProposal.findMany({
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
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              verified: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orderProposal.count({ where }),
    ]);

    return {
      proposals,
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
    const proposal = await this.prisma.orderProposal.findUnique({
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
        User: {
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

    if (!proposal) {
      throw new NotFoundException(`Order proposal with ID ${id} not found`);
    }

    return proposal;
  }

  async update(
    id: number,
    updateOrderProposalDto: {
      price?: number;
      message?: string;
      status?: string;
    },
  ) {
    // Check if proposal exists
    const existingProposal = await this.prisma.orderProposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException(`Order proposal with ID ${id} not found`);
    }

    // Validate status
    const validStatuses = [
      'pending',
      'accepted',
      'rejected',
      'cancelled',
      'specialist-canceled',
    ];
    if (
      updateOrderProposalDto.status &&
      !validStatuses.includes(updateOrderProposalDto.status)
    ) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    // If accepting a proposal, reject all other proposals for the same order
    if (updateOrderProposalDto.status === 'accepted') {
      await this.prisma.orderProposal.updateMany({
        where: {
          orderId: existingProposal.orderId,
          id: { not: id },
          status: 'pending',
        },
        data: { status: 'rejected' },
      });

      // Update the order status to in_progress
      await this.prisma.order.update({
        where: { id: existingProposal.orderId },
        data: { status: 'in_progress' },
      });
    }

    // If canceling a proposal, close the order to allow feedback
    if (updateOrderProposalDto.status === 'specialist-canceled') {
      await this.prisma.order.update({
        where: { id: existingProposal.orderId },
        data: { status: 'closed' },
      });
    }

    return this.prisma.orderProposal.update({
      where: { id },
      data: updateOrderProposalDto,
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
        User: {
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
    // Check if proposal exists
    const existingProposal = await this.prisma.orderProposal.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      throw new NotFoundException(`Order proposal with ID ${id} not found`);
    }

    // Check if proposal is accepted
    if (existingProposal.status === 'accepted') {
      throw new BadRequestException('Cannot delete accepted proposal');
    }

    return this.prisma.orderProposal.delete({
      where: { id },
    });
  }

  async getProposalsByOrder(
    orderId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll(page, limit, undefined, orderId);
  }

  async getProposalsByUser(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll(page, limit, undefined, undefined, userId);
  }

  async getProposalsByStatus(
    status: string,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll(page, limit, status);
  }

  async searchProposals(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      this.prisma.orderProposal.findMany({
        where: {
          OR: [
            { message: { contains: query, mode: 'insensitive' } },
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
              User: {
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
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              verified: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orderProposal.count({
        where: {
          OR: [
            { message: { contains: query, mode: 'insensitive' } },
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
              User: {
                name: { contains: query, mode: 'insensitive' },
              },
            },
          ],
        },
      }),
    ]);

    return {
      proposals,
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
}
