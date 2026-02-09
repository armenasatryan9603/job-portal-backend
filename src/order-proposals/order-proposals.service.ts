import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrderPricingService } from "../order-pricing/order-pricing.service";
import { CreditTransactionsService } from "../credit/credit-transactions.service";
import { ConfigService } from "../config/config.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

@Injectable()
export class OrderProposalsService {
  private readonly logger = new Logger(OrderProposalsService.name);

  constructor(
    private prisma: PrismaService,
    private orderPricingService: OrderPricingService,
    private creditTransactionsService: CreditTransactionsService,
    private configService: ConfigService,
    private subscriptionsService: SubscriptionsService
  ) {}

  /**
   * Helper method to log order changes
   */
  private async logOrderChange(
    orderId: number,
    fieldChanged: string,
    oldValue: string | null,
    newValue: string | null,
    changedBy: number,
    reason?: string
  ) {
    try {
      await this.prisma.orderChangeHistory.create({
        data: {
          orderId,
          fieldChanged,
          oldValue: oldValue || null,
          newValue: newValue || null,
          changedBy,
          reason: reason || null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log order change for order ${orderId}:`,
        error
      );
      // Don't throw error - change logging is non-critical
    }
  }

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
        `Order with ID ${createOrderProposalDto.orderId} not found`
      );
    }

    // Check if order is still open
    if (order.status !== "open") {
      throw new BadRequestException("Cannot create proposal for closed order");
    }

    // Check if user exists and is a specialist
    const user = await this.prisma.user.findUnique({
      where: { id: createOrderProposalDto.userId, role: "specialist" },
    });

    if (!user) {
      throw new BadRequestException(
        `Specialist user with ID ${createOrderProposalDto.userId} not found`
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
        "User already has a proposal for this order"
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
    questionAnswers?: Array<{ questionId: number; answer: string }>;
    peerIds?: number[];
    teamId?: number;
  }) {
    console.log("Starting createWithCreditDeduction:", {
      orderId: createOrderProposalDto.orderId,
      userId: createOrderProposalDto.userId,
      hasMessage: !!createOrderProposalDto.message,
    });

    try {
      // Use transaction with timeout and retry logic
      const maxRetries = 3;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Transaction attempt ${attempt}/${maxRetries}`);

          // Use transaction with increased timeout (30 seconds) and isolation level
          const result = await this.prisma.$transaction(
            async (tx) => {
              console.log("Transaction started");

              // Check if order exists and get questions
              console.log("Checking if order exists...");
              const order = await tx.order.findUnique({
                where: { id: createOrderProposalDto.orderId },
                include: {
                  questions: {
                    orderBy: { order: "asc" },
                  },
                },
              });

              if (!order) {
                throw new BadRequestException(
                  `Order with ID ${createOrderProposalDto.orderId} not found`
                );
              }
              console.log("Order found:", order.id, order.title);

              // Validate question answers if order has questions
              if (order.questions && order.questions.length > 0) {
                if (
                  !createOrderProposalDto.questionAnswers ||
                  createOrderProposalDto.questionAnswers.length === 0
                ) {
                  throw new BadRequestException(
                    "This order requires answers to all questions"
                  );
                }

                // Check that all questions are answered
                const answeredQuestionIds = new Set(
                  createOrderProposalDto.questionAnswers.map(
                    (qa) => qa.questionId
                  )
                );
                const requiredQuestionIds = new Set(
                  order.questions.map((q) => q.id)
                );

                // Check if all required questions are answered
                for (const question of order.questions) {
                  if (!answeredQuestionIds.has(question.id)) {
                    throw new BadRequestException(
                      `Missing answer for question: ${question.question}`
                    );
                  }
                }

                // Check if all answers are non-empty
                for (const qa of createOrderProposalDto.questionAnswers) {
                  if (!qa.answer || !qa.answer.trim()) {
                    const question = order.questions.find(
                      (q) => q.id === qa.questionId
                    );
                    throw new BadRequestException(
                      `Answer cannot be empty for question: ${question?.question || "Unknown"}`
                    );
                  }
                }
              }

              // Get dynamic pricing based on order budget
              console.log("Calculating credit cost...");

              // Determine if this is a group/team application
              // Check if teamId is provided first, then check for peerIds
              const peerIds = createOrderProposalDto.peerIds || [];
              const isTeamApplication =
                createOrderProposalDto.teamId !== undefined;
              const isGroupApplication =
                isTeamApplication || peerIds.length > 0;

              const applicationCost =
                await this.orderPricingService.getCreditCost(
                  order.budget || 0,
                  isTeamApplication
                );
              console.log(
                `Application cost (${isTeamApplication ? "team" : "individual"}):`,
                applicationCost
              );

              // Check if order is still open
              if (order.status !== "open") {
                throw new BadRequestException(
                  "Cannot create proposal for closed order"
                );
              }

              // Check if user exists
              console.log("Checking if user exists...");
              const user = await tx.user.findUnique({
                where: { id: createOrderProposalDto.userId },
              });

              if (!user) {
                throw new BadRequestException(
                  `User with ID ${createOrderProposalDto.userId} not found`
                );
              }
              console.log("User found:", user.id, user.name);

              // Check if user has an active subscription with unlimitedApplications feature
              const activeSubscription = await this.subscriptionsService.getUserActiveSubscription(
                createOrderProposalDto.userId
              );

              let shouldDeductCredits = true;
              if (
                activeSubscription &&
                this.subscriptionsService.hasFeature(
                  activeSubscription,
                  "unlimitedApplications"
                )
              ) {
                // User has active subscription with unlimitedApplications feature - skip credit deduction
                console.log(
                  "User has active subscription with unlimitedApplications, skipping credit deduction"
                );
                shouldDeductCredits = false;
              } else {
                // No active subscription - check if user has sufficient credits
                console.log(
                  "Credit check - Balance:",
                  user.creditBalance,
                  "Required:",
                  applicationCost
                );
                if (user.creditBalance < applicationCost) {
                  throw new BadRequestException(
                    `Insufficient credit balance. Required: ${applicationCost} credits, Available: ${user.creditBalance} credits`
                  );
                }
              }

              // Check if user already has a proposal for this order
              console.log("Checking for existing proposal...");
              const existingProposal = await tx.orderProposal.findFirst({
                where: {
                  orderId: createOrderProposalDto.orderId,
                  userId: createOrderProposalDto.userId,
                },
              });

              if (existingProposal) {
                throw new BadRequestException(
                  "User already has a proposal for this order"
                );
              }
              console.log("No existing proposal found");

              // Handle peer applications
              // Note: peerIds and isGroupApplication are already defined above for pricing calculation

              if (isGroupApplication) {
                // Validate peer limit
                const maxPeers =
                  await this.configService.getMaxPeersPerApplication();
                if (peerIds.length > maxPeers) {
                  throw new BadRequestException(
                    `Maximum ${maxPeers} peers allowed per application. You provided ${peerIds.length} peers.`
                  );
                }

                // Validate all peers are unique and not the lead applicant
                const uniquePeerIds = [...new Set(peerIds)];
                if (uniquePeerIds.length !== peerIds.length) {
                  throw new BadRequestException(
                    "Duplicate peers are not allowed"
                  );
                }

                if (peerIds.includes(createOrderProposalDto.userId)) {
                  throw new BadRequestException("Cannot add self as peer");
                }

                // Validate all peers exist and are specialists
                const peers = await tx.user.findMany({
                  where: {
                    id: { in: peerIds },
                    role: "specialist",
                  },
                  select: { id: true, role: true },
                });

                if (peers.length !== peerIds.length) {
                  throw new BadRequestException(
                    "One or more peers not found or are not specialists"
                  );
                }

                // Check if any peer already has a proposal for this order (individually or in another group)
                const existingPeerProposals = await tx.orderProposal.findMany({
                  where: {
                    orderId: createOrderProposalDto.orderId,
                    userId: { in: peerIds },
                  },
                });

                if (existingPeerProposals.length > 0) {
                  const conflictingPeers = existingPeerProposals.map(
                    (p) => p.userId
                  );
                  throw new BadRequestException(
                    `One or more peers already have a proposal for this order: ${conflictingPeers.join(", ")}`
                  );
                }

                // Check if any peer is already a peer in another proposal for this order
                const existingProposalPeers = await tx.proposalPeer.findMany({
                  where: {
                    userId: { in: peerIds },
                    Proposal: {
                      orderId: createOrderProposalDto.orderId,
                    },
                    status: { not: "rejected" },
                  },
                });

                if (existingProposalPeers.length > 0) {
                  const conflictingPeers = existingProposalPeers.map(
                    (pp) => pp.userId
                  );
                  throw new BadRequestException(
                    `One or more peers are already part of another proposal for this order: ${conflictingPeers.join(", ")}`
                  );
                }
              }

              // Deduct credits from user (only if no active subscription)
              let updatedUser;
              if (shouldDeductCredits) {
                console.log("Deducting credits from user...");
                updatedUser = await tx.user.update({
                  where: { id: createOrderProposalDto.userId },
                  data: { creditBalance: { decrement: applicationCost } },
                  select: { creditBalance: true },
                });
                console.log("Credits deducted successfully");

                // Log credit transaction
                await this.creditTransactionsService.logTransaction({
                  userId: createOrderProposalDto.userId,
                  amount: -applicationCost, // Negative for deduction
                  balanceAfter: updatedUser.creditBalance,
                  type: "order_application",
                  status: "completed",
                  description: `Applied to order #${createOrderProposalDto.orderId}`,
                  referenceId: createOrderProposalDto.orderId.toString(),
                  referenceType: "order",
                  metadata: {
                    orderId: createOrderProposalDto.orderId,
                    applicationCost,
                  },
                  tx,
                });
              } else {
                // Get user balance for logging (even though we're not deducting)
                updatedUser = await tx.user.findUnique({
                  where: { id: createOrderProposalDto.userId },
                  select: { creditBalance: true },
                });
              }

              // Format message with questions and answers
              let formattedMessage = createOrderProposalDto.message || "";

              if (
                order.questions &&
                order.questions.length > 0 &&
                createOrderProposalDto.questionAnswers &&
                createOrderProposalDto.questionAnswers.length > 0
              ) {
                // Create a map of questionId to answer for quick lookup
                const answerMap = new Map(
                  createOrderProposalDto.questionAnswers.map((qa) => [
                    qa.questionId,
                    qa.answer.trim(),
                  ])
                );

                // Format questions and answers into the message
                const qaSection = order.questions
                  .map((question) => {
                    const answer = answerMap.get(question.id);
                    return `question: ${question.question}\nanswer: ${answer || ""}`;
                  })
                  .join("\n\n");

                // Append Q&A section to the message
                if (formattedMessage.trim()) {
                  formattedMessage = `${formattedMessage}\n\n---\n\n${qaSection}`;
                } else {
                  formattedMessage = qaSection;
                }
              }

              // Create the proposal
              console.log("Creating proposal...");
              const proposal = await tx.orderProposal.create({
                data: {
                  orderId: createOrderProposalDto.orderId,
                  userId: createOrderProposalDto.userId,
                  leadUserId: isGroupApplication
                    ? createOrderProposalDto.userId
                    : null,
                  teamId: createOrderProposalDto.teamId || null,
                  isGroupApplication,
                  message: formattedMessage,
                  price: createOrderProposalDto.price,
                  ProposalPeers: isGroupApplication
                    ? {
                        create: peerIds.map((peerId) => ({
                          userId: peerId,
                          status: "pending",
                        })),
                      }
                    : undefined,
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
                  ProposalPeers: {
                    include: {
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
                  },
                },
              });
              console.log(
                "Proposal created successfully with ID:",
                proposal.id,
                isGroupApplication ? `with ${peerIds.length} peers` : ""
              );

              // Note: Conversation creation is handled by the frontend after proposal creation
              // This prevents race conditions and duplicate conversation creation
              console.log(
                "Transaction completed successfully. Conversation will be created by frontend if needed."
              );

              return proposal;
            },
            {
              maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
              timeout: 30000, // Maximum time the transaction can run (30 seconds)
            }
          );

          console.log("createWithCreditDeduction completed successfully");
          return result;
        } catch (error) {
          lastError = error;

          // If it's a transaction timeout error, retry
          if (error?.code === "P2028" && attempt < maxRetries) {
            const waitTime = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
            console.warn(
              `Transaction timeout (attempt ${attempt}/${maxRetries}). Retrying in ${waitTime}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          // If it's not a timeout or we've exhausted retries, throw immediately
          throw error;
        }
      }

      // If we get here, all retries failed
      throw lastError;
    } catch (error) {
      console.error("Error in createWithCreditDeduction service:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });

      // Re-throw HTTP exceptions as-is
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle Prisma errors
      if (error?.code === "P2002") {
        throw new BadRequestException(
          "A proposal already exists for this order"
        );
      }

      if (error?.code === "P2003") {
        throw new BadRequestException("Invalid order or user reference");
      }

      // Wrap other errors
      throw new BadRequestException(
        error?.message || "Failed to create proposal. Please try again."
      );
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    orderId?: number,
    userId?: number,
    startDate?: string,
    endDate?: string
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

    // Filter by date range (for createdAt - applied filter mode)
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate + "T23:59:59.999Z"), // Include entire end date
      };
    }

    // For scheduled filter mode, we need to filter by Order.availableDates
    // This is handled separately in the frontend by filtering orders

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
        orderBy: { createdAt: "desc" },
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
    }
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
      "pending",
      "accepted",
      "rejected",
      "cancelled",
      "specialist-canceled",
    ];
    if (
      updateOrderProposalDto.status &&
      !validStatuses.includes(updateOrderProposalDto.status)
    ) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    // If accepting a proposal, reject all other proposals for the same order
    if (updateOrderProposalDto.status === "accepted") {
      await this.prisma.orderProposal.updateMany({
        where: {
          orderId: existingProposal.orderId,
          id: { not: id },
          status: "pending",
        },
        data: { status: "rejected" },
      });

      // Get the order to check current status
      const order = await this.prisma.order.findUnique({
        where: { id: existingProposal.orderId },
      });

      // Update the order status to in_progress
      await this.prisma.order.update({
        where: { id: existingProposal.orderId },
        data: { status: "in_progress" },
      });

      // Log status change if status actually changed
      if (order && order.status !== "in_progress") {
        await this.logOrderChange(
          existingProposal.orderId,
          "status",
          order.status,
          "in_progress",
          existingProposal.userId,
          "Proposal accepted"
        );
      }
    }

    // If canceling a proposal, close the order to allow feedback
    if (updateOrderProposalDto.status === "specialist-canceled") {
      // Get the order to check current status
      const order = await this.prisma.order.findUnique({
        where: { id: existingProposal.orderId },
      });

      await this.prisma.order.update({
        where: { id: existingProposal.orderId },
        data: { status: "closed" },
      });

      // Log status change if status actually changed
      if (order && order.status !== "closed") {
        await this.logOrderChange(
          existingProposal.orderId,
          "status",
          order.status,
          "closed",
          existingProposal.userId,
          "Proposal canceled by specialist"
        );
      }
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
    if (existingProposal.status === "accepted") {
      throw new BadRequestException("Cannot delete accepted proposal");
    }

    return this.prisma.orderProposal.delete({
      where: { id },
    });
  }

  async getProposalsByOrder(
    orderId: number,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findAll(page, limit, undefined, orderId);
  }

  async getProposalsByUser(
    userId: number,
    page: number = 1,
    limit: number = 10,
    startDate?: string,
    endDate?: string
  ) {
    return this.findAll(page, limit, undefined, undefined, userId, startDate, endDate);
  }

  async getProposalsByStatus(
    status: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findAll(page, limit, status);
  }

  async searchProposals(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      this.prisma.orderProposal.findMany({
        where: {
          OR: [
            { message: { contains: query, mode: "insensitive" } },
            {
              Order: {
                title: { contains: query, mode: "insensitive" },
              },
            },
            {
              Order: {
                description: { contains: query, mode: "insensitive" },
              },
            },
            {
              User: {
                name: { contains: query, mode: "insensitive" },
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
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.orderProposal.count({
        where: {
          OR: [
            { message: { contains: query, mode: "insensitive" } },
            {
              Order: {
                title: { contains: query, mode: "insensitive" },
              },
            },
            {
              Order: {
                description: { contains: query, mode: "insensitive" },
              },
            },
            {
              User: {
                name: { contains: query, mode: "insensitive" },
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
