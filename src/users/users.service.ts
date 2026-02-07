import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PusherService } from "../pusher/pusher.service";
import * as bcrypt from "bcrypt";
import { UserLanguage, isValidUserLanguage } from "../types/user-languages";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private pusherService: PusherService
  ) {}

  async findAll(page: number = 1, limit: number = 10, role?: string) {
    const skip = (page - 1) * limit;
    const where = role
      ? { role, deletedAt: null }
      : { deletedAt: null };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
          bio: true,
          creditBalance: true,
          verified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
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
    if (!id || isNaN(id) || id <= 0) {
      throw new NotFoundException("Invalid user ID");
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        creditBalance: true,
        verified: true,
        createdAt: true,
        experienceYears: true,
        priceMin: true,
        priceMax: true,
        location: true,
        languages: true,
        currency: true,
        rateUnit: true,
        Orders: {
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {},
        },
        Reviews: {
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            Order: true,
          },
        },
        Portfolio: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(
    id: number,
    updateData: {
      name?: string;
      email?: string;
      phone?: string;
      bio?: string;
      avatarUrl?: string;
      role?: string;
      verified?: boolean;
      languages?: UserLanguage[];
    }
  ) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email is being updated and if it's already taken
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });

      if (emailExists) {
        throw new BadRequestException("Email already exists");
      }
    }

    // Validate languages if provided
    if (updateData.languages !== undefined) {
      if (!Array.isArray(updateData.languages)) {
        throw new BadRequestException("Languages must be an array");
      }

      // Validate each language object
      for (const lang of updateData.languages) {
        if (!isValidUserLanguage(lang)) {
          throw new BadRequestException(
            `Invalid language: ${JSON.stringify(lang)}`
          );
        }
      }

      // Check for duplicate language codes
      const languageCodes = updateData.languages.map((lang) => lang.code);
      const uniqueCodes = new Set(languageCodes);
      if (languageCodes.length !== uniqueCodes.size) {
        throw new BadRequestException(
          "Duplicate language codes are not allowed"
        );
      }
    }

    // Prepare update data
    const dataToUpdate: any = { ...updateData };

    return this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        bio: true,
        creditBalance: true,
        verified: true,
        languages: true,
        createdAt: true,
      },
    });
  }

  async remove(id: number) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if user is already soft-deleted
    if (existingUser.deletedAt) {
      throw new BadRequestException("User is already deleted");
    }

    // Use a transaction to ensure all deletions happen atomically
    // Increase timeout to 60 seconds for large deletions with notifications
    return await this.prisma.$transaction(
      async (tx) => {
        // STEP 1: Handle permanent orders with active bookings
        const permanentOrders = await tx.order.findMany({
          where: {
            clientId: id,
            orderType: "permanent",
            deletedAt: null,
          },
          include: {
            Bookings: {
              where: {
                clientId: { not: id }, // Bookings from other users
                status: { in: ["pending", "confirmed"] }, // Active bookings
                scheduledDate: {
                  gte: new Date().toISOString().split("T")[0], // Future bookings only
                },
              },
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        // Cancel future bookings and notify affected users
        const today = new Date().toISOString().split("T")[0];
        for (const order of permanentOrders) {
          for (const booking of order.Bookings) {
            // Only cancel future bookings
            if (booking.scheduledDate >= today) {
              // Update booking status to cancelled
              await tx.booking.update({
                where: { id: booking.id },
                data: { status: "cancelled" },
              });

              // Notify the booking client
              try {
                const specialistName = existingUser.name || "The specialist";

                await this.notificationsService.createNotificationWithPush(
                  booking.clientId,
                  "booking_cancelled",
                  "bookingCancelled",
                  "bookingCancelledAccountDeletion",
                  {
                    bookingId: booking.id,
                    orderId: order.id,
                    scheduledDate: booking.scheduledDate,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                    reason: "account_deletion",
                  },
                  {
                    date: booking.scheduledDate,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                  }
                );

                // Send real-time Pusher notification
                await this.pusherService.trigger(
                  `user-${booking.clientId}`,
                  "booking-cancelled",
                  {
                    bookingId: booking.id,
                    orderId: order.id,
                    cancellerName: specialistName,
                    scheduledDate: booking.scheduledDate,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                    reason: "account_deletion",
                  }
                );
              } catch (error) {
                this.logger.error(
                  `Failed to send cancellation notification for booking ${booking.id}:`,
                  error
                );
                // Continue with deletion even if notification fails
              }
            }
          }
        }

        // Delete lightweight items first (faster operations)
        // 1. Delete notifications
        await tx.notification.deleteMany({
          where: { userId: id },
        });

        // 2. Delete saved orders
        await tx.savedOrder.deleteMany({
          where: { userId: id },
        });

        // 3. Delete user services
        await tx.userCategory.deleteMany({
          where: { userId: id },
        });

        // 4. Delete cards
        await tx.card.deleteMany({
          where: { userId: id },
        });

        // 5. Delete portfolio items
        await tx.portfolio.deleteMany({
          where: { userId: id },
        });

        // 6. Delete credit transactions (keep for financial records - actually, we should keep these)
        // Commented out to preserve financial records
        // await tx.creditTransaction.deleteMany({
        //   where: { userId: id },
        // });

        // 7. Delete order change history entries
        await tx.orderChangeHistory.deleteMany({
          where: { changedBy: id },
        });

        // 8. Delete proposal peers
        await tx.proposalPeer.deleteMany({
          where: { userId: id },
        });

        // 9. Delete peer relationships
        await tx.peerRelationship.deleteMany({
          where: { OR: [{ userId: id }, { peerId: id }] },
        });

        // 10. Delete team memberships
        await tx.teamMember.deleteMany({
          where: { userId: id },
        });

        // 11. Handle teams created by user - delete teams if user is the only member, otherwise transfer ownership
        const teamsCreatedByUser = await tx.team.findMany({
          where: { createdBy: id },
          include: { Members: true },
        });

        for (const team of teamsCreatedByUser) {
          const activeMembers = team.Members.filter(
            (m) => m.isActive && m.userId !== id
          );
          if (activeMembers.length === 0) {
            // No other active members, delete the team
            await tx.team.delete({
              where: { id: team.id },
            });
          } else {
            // Transfer ownership to first active member
            const newOwner = activeMembers[0];
            await tx.team.update({
              where: { id: team.id },
              data: { createdBy: newOwner.userId },
            });
          }
        }

        // 12. Delete referral rewards (both as referrer and referred)
        await tx.referralReward.deleteMany({
          where: { OR: [{ referrerId: id }, { referredUserId: id }] },
        });

        // 13. Update referrals - set referredBy to null for users referred by this user
        await tx.user.updateMany({
          where: { referredBy: id },
          data: { referredBy: null },
        });

        // 14. Delete conversations and related data (cascade will handle participants and messages)
        const userConversations = await tx.conversationParticipant.findMany({
          where: { userId: id },
          select: { conversationId: true },
        });
        const conversationIds = userConversations.map(
          (cp) => cp.conversationId
        );
        if (conversationIds.length > 0) {
          await tx.conversation.deleteMany({
            where: { id: { in: conversationIds } },
          });
        }

        // 15. Delete order proposals made by the user (combine userId and leadUserId deletes)
        await tx.orderProposal.deleteMany({
          where: { OR: [{ userId: id }, { leadUserId: id }] },
        });

        // 16. Anonymize reviews where user is the specialist (set specialistId to null)
        await tx.review.updateMany({
          where: { specialistId: id },
          data: { specialistId: null },
        });

        // 17. Delete reviews where user is the reviewer
        await tx.review.deleteMany({
          where: { reviewerId: id },
        });

        // 18. Handle orders - soft delete permanent orders, hard delete one-time orders
        const oneTimeOrders = await tx.order.findMany({
          where: {
            clientId: id,
            orderType: "one_time",
            deletedAt: null,
          },
        });

        // Hard delete one-time orders (as before)
        if (oneTimeOrders.length > 0) {
          await tx.order.deleteMany({
            where: {
              clientId: id,
              orderType: "one_time",
            },
          });
        }

        // Soft delete permanent orders
        const permanentOrderIds = permanentOrders.map((o) => o.id);
        if (permanentOrderIds.length > 0) {
          await tx.order.updateMany({
            where: {
              id: { in: permanentOrderIds },
            },
            data: {
              deletedAt: new Date(),
            },
          });
        }

        // 19. Soft delete the user (anonymize sensitive data)
        return await tx.user.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            email: null,
            phone: null,
            name: "Deleted User",
            passwordHash: "", // Clear password
            fcmToken: null,
            avatarUrl: null,
            bannerUrl: null,
            bio: null,
            otpCode: null,
            otpExpiresAt: null,
          },
        });
      },
      {
        timeout: 60000, // 60 seconds timeout (increased for notifications)
      }
    );
  }

  async updatePassword(id: number, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id },
      data: { passwordHash: hashedPassword },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  async updateCreditBalance(id: number, amount: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const newBalance = user.creditBalance + amount;

    if (newBalance < 0) {
      throw new BadRequestException("Insufficient credit balance");
    }

    return this.prisma.user.update({
      where: { id },
      data: { creditBalance: newBalance },
      select: {
        id: true,
        name: true,
        email: true,
        creditBalance: true,
      },
    });
  }

  async searchUsers(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { bio: { contains: query, mode: "insensitive" } },
          ],
        },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
          bio: true,
          creditBalance: true,
          verified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { bio: { contains: query, mode: "insensitive" } },
          ],
        },
      }),
    ]);

    return {
      users,
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

  // Specialist-specific methods
  async createSpecialistProfile(
    userId: number,
    specialistData: {
      categoryId?: number;
      experienceYears?: number;
      priceMin?: number;
      priceMax?: number;
      location?: string;
      currency?: string;
      rateUnit?: string;
    }
  ) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException(`User with ID ${userId} not found`);
    }

    // Check if user already has specialist data
    if (
      user.experienceYears ||
      user.priceMin ||
      user.priceMax ||
      user.location
    ) {
      throw new BadRequestException("User already has specialist profile data");
    }

    // If categoryId is provided, check if category exists
    if (specialistData.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: specialistData.categoryId },
      });

      if (!category) {
        throw new BadRequestException(
          `Category with ID ${specialistData.categoryId} not found`
        );
      }
    }

    // Validate price range
    if (specialistData.priceMin && specialistData.priceMax) {
      if (specialistData.priceMin > specialistData.priceMax) {
        throw new BadRequestException(
          "Minimum price cannot be greater than maximum price"
        );
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: specialistData,
      include: {
        _count: {
          select: {
            Proposals: true,
          },
        },
      },
    });
  }

  async getSpecialists(
    page: number = 1,
    limit: number = 10,
    categoryId?: number,
    location?: string,
    currentUserId?: number
  ) {
    try {
      console.log("getSpecialists called with:", {
        page,
        limit,
        categoryId,
        location,
      });

      // Build where clause
      const whereClause: any = { role: "specialist", deletedAt: null };

      if (categoryId) {
        whereClause.UserCategories = {
          some: {
            categoryId: categoryId,
          },
        };
      }

      if (location) {
        whereClause.location = {
          contains: location,
          mode: "insensitive",
        };
      }

      // Get total count for pagination
      const total = await this.prisma.user.count({
        where: whereClause,
      });

      // Get specialists with proper structure
      const specialists = await this.prisma.user.findMany({
        where: whereClause,
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          bio: true,
          verified: true,
          experienceYears: true,
          priceMin: true,
          priceMax: true,
          location: true,
          currency: true,
          rateUnit: true,
          createdAt: true,
          UserCategories: {
            select: {
              Category: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  imageUrl: true,
                  parentId: true,
                  averagePrice: true,
                  minPrice: true,
                  maxPrice: true,
                  currency: true,
                  rateUnit: true,
                  completionRate: true,
                  isActive: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
          Reviews: {
            take: 5,
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
              orderId: true,
              reviewerId: true,
              specialistId: true,
              rating: true,
              comment: true,
              createdAt: true,
              Order: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                },
              },
            },
          },
          _count: {
            select: {
              Reviews: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      console.log("Found specialists:", specialists.length);

      // Check hired status for each specialist if currentUserId is provided
      // Removed isHired logic - will be checked per order in hiring dialog

      // Get all specialist IDs
      const specialistIds = specialists.map((s) => s.id);

      // Calculate average ratings and review counts for all specialists in one query
      const ratingAggregates = await Promise.all(
        specialistIds.map((specialistId) =>
          this.prisma.review.aggregate({
            where: { specialistId },
            _avg: { rating: true },
            _count: { rating: true },
          })
        )
      );

      // Create a map of specialistId -> { averageRating, reviewCount }
      const ratingMap = new Map(
        specialistIds.map((id, index) => [
          id,
          {
            averageRating:
              ratingAggregates[index]._avg.rating != null
                ? Math.round(ratingAggregates[index]._avg.rating * 10) / 10
                : 0,
            reviewCount: ratingAggregates[index]._count.rating,
          },
        ])
      );

      // Transform the data to match frontend expectations
      const transformedSpecialists = specialists.map((specialist) => {
        // Get the primary service (first one) for the specialist
        const primaryCategory = specialist.UserCategories?.[0]?.Category;

        // Get rating data from the map
        const ratingData = ratingMap.get(specialist.id) || {
          averageRating: 0,
          reviewCount: 0,
        };

        return {
          id: specialist.id,
          userId: specialist.id,
          categoryId: primaryCategory?.id,
          experienceYears: specialist.experienceYears,
          priceMin: specialist.priceMin,
          priceMax: specialist.priceMax,
          location: specialist.location,
          currency: specialist.currency,
          rateUnit: specialist.rateUnit,
          User: {
            id: specialist.id,
            name: specialist.name,
            email: specialist.email,
            phone: specialist.phone,
            avatarUrl: specialist.avatarUrl,
            bio: specialist.bio,
            verified: specialist.verified,
            createdAt: specialist.createdAt,
          },
          Category: primaryCategory,
          _count: {
            Proposals: 0, // This would need to be calculated separately if needed
          },
          averageRating: ratingData.averageRating,
          reviewCount: ratingData.reviewCount,
        };
      });

      return {
        data: transformedSpecialists,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      console.error("Error in getSpecialists:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  // User service management methods - temporarily commented out due to Prisma client issues
  /*
  async addUserService(userId: number, serviceId: number, notificationsEnabled: boolean = true) {
    // Implementation will be added once Prisma client is working
  }

  async removeUserService(userId: number, serviceId: number) {
    // Implementation will be added once Prisma client is working
  }

  async updateUserServiceNotifications(userId: number, serviceId: number, notificationsEnabled: boolean) {
    // Implementation will be added once Prisma client is working
  }

  async getUserServices(userId: number) {
    // Implementation will be added once Prisma client is working
  }
  */

  async getSpecialistById(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: "specialist", deletedAt: null },
      include: {
          UserCategories: {
            include: {
              Category: {
                include: {
                  CategoryTechnologies: {
                  include: {
                    Technology: true,
                  },
                },
              },
            },
          },
          take: 1,
        },
        Proposals: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            Order: {
              include: {
                Client: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            Proposals: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Specialist with ID ${id} not found`);
    }

    // Get reviews for this specialist
    const reviews = await this.prisma.review.findMany({
      where: { specialistId: user.id },
      include: {
        Reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Order: {
          select: {
            id: true,
            title: true,
            description: true,
            budget: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Calculate average rating
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : 0;

    // Transform the data to match frontend expectations
    const roundedAverageRating = Math.round(averageRating * 10) / 10;
    const reviewCountValue = reviews.length;

    // Get the first category from UserCategories
    const primaryUserCategory = user.UserCategories?.[0];
    const category = primaryUserCategory?.Category;

    // Transform CategoryTechnologies to technologies array format expected by frontend
    const technologies =
      category?.CategoryTechnologies?.map((st: any) => ({
        id: st.Technology.id,
        name: st.Technology.name,
        nameEn: st.Technology.nameEn,
        nameRu: st.Technology.nameRu,
        nameHy: st.Technology.nameHy,
      })) || [];

    return {
      id: user.id,
      userId: user.id,
      categoryId: category?.id,
      experienceYears: user.experienceYears,
      priceMin: user.priceMin,
      priceMax: user.priceMax,
      location: user.location,
      currency: user.currency,
      rateUnit: user.rateUnit,
      averageRating: roundedAverageRating,
      reviewCount: reviewCountValue,
      reviews: reviews,
      User: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
        verified: user.verified,
        experienceYears: user.experienceYears,
        priceMin: user.priceMin,
        priceMax: user.priceMax,
        location: user.location,
        createdAt: user.createdAt,
      },
      Category: category
        ? {
            id: category.id,
            name: category.name,
            nameEn: category.nameEn,
            nameRu: category.nameRu,
            nameHy: category.nameHy,
            description: category.description,
            descriptionEn: category.descriptionEn,
            descriptionRu: category.descriptionRu,
            descriptionHy: category.descriptionHy,
            completionRate: category.completionRate,
            technologies: technologies,
          }
        : null,
      _count: user._count,
    };
  }

  async updateSpecialistProfile(
    id: number,
    specialistData: {
      categoryId?: number;
      experienceYears?: number;
      priceMin?: number;
      priceMax?: number;
      location?: string;
    }
  ) {
    // Check if user exists and is a specialist
    const existingUser = await this.prisma.user.findUnique({
      where: { id, role: "specialist" },
    });

    if (!existingUser) {
      throw new NotFoundException(`Specialist with ID ${id} not found`);
    }

    // If categoryId is being updated, check if category exists
    if (specialistData.categoryId !== undefined) {
      if (specialistData.categoryId !== null) {
        const category = await this.prisma.category.findUnique({
          where: { id: specialistData.categoryId },
        });

        if (!category) {
          throw new BadRequestException(
            `Category with ID ${specialistData.categoryId} not found`
          );
        }
      }
    }

    // Validate price range
    const priceMin = specialistData.priceMin ?? existingUser.priceMin;
    const priceMax = specialistData.priceMax ?? existingUser.priceMax;

    if (priceMin && priceMax && priceMin > priceMax) {
      throw new BadRequestException(
        "Minimum price cannot be greater than maximum price"
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: specialistData,
      include: {
        _count: {
          select: {
            Proposals: true,
          },
        },
      },
    });
  }

  async searchSpecialists(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: "specialist",
          deletedAt: null,
          OR: [
            { location: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { bio: { contains: query, mode: "insensitive" } },
          ],
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              Proposals: true,
            },
          },
        },
        orderBy: { id: "desc" },
      }),
      this.prisma.user.count({
        where: {
          role: "specialist",
          OR: [
            { location: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { bio: { contains: query, mode: "insensitive" } },
          ],
        },
      }),
    ]);

    // Add basic rating info to each specialist
    const specialistsWithRatings = await Promise.all(
      users.map(async (user) => {
        const reviews = await this.prisma.review.findMany({
          where: { specialistId: user.id },
          select: { rating: true },
        });

        const averageRating =
          reviews.length > 0
            ? reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviews.length
            : 0;

        return {
          ...user,
          averageRating: Math.round(averageRating * 10) / 10,
          reviewCount: reviews.length,
        };
      })
    );

    return {
      specialists: specialistsWithRatings,
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

  async getSpecialistsByCategory(
    categoryId: number,
    page: number = 1,
    limit: number = 10
  ) {
    return this.getSpecialists(page, limit, categoryId);
  }

  async getSpecialistsByLocation(
    location: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.getSpecialists(page, limit, undefined, location);
  }

  // User service management methods
  async addUserCategory(
    userId: number,
    categoryId: number,
    notificationsEnabled: boolean = true
  ) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if category exists
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    // Check if user category already exists
    const existingUserCategory = await this.prisma.userCategory.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
    });

    if (existingUserCategory) {
      throw new BadRequestException("User category already exists");
    }

    // Create user category
    const userCategory = await this.prisma.userCategory.create({
      data: {
        userId,
        categoryId,
        notificationsEnabled,
      },
      include: {
        Category: true,
      },
    });

    return userCategory;
  }

  async removeUserCategory(userId: number, categoryId: number) {
    // Check if user category exists
    const userCategory = await this.prisma.userCategory.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
    });

    if (!userCategory) {
      throw new NotFoundException("User category not found");
    }

    // Delete user category
    await this.prisma.userCategory.delete({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
    });

    return { message: "User category removed successfully" };
  }

  async updateUserCategoryNotifications(
    userId: number,
    categoryId: number,
    notificationsEnabled: boolean
  ) {
    // Check if user category exists
    const userCategory = await this.prisma.userCategory.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
    });

    if (!userCategory) {
      throw new NotFoundException("User category not found");
    }

    // Update notifications setting
    const updatedUserCategory = await this.prisma.userCategory.update({
      where: {
        userId_categoryId: {
          userId,
          categoryId,
        },
      },
      data: {
        notificationsEnabled,
      },
      include: {
        Category: true,
      },
    });

    return updatedUserCategory;
  }

  async getUserCategories(userId: number) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get user categories with category details
    const userCategories = await this.prisma.userCategory.findMany({
      where: { userId },
      include: {
        Category: {
          select: {
            id: true,
            name: true,
            description: true,
            averagePrice: true,
            minPrice: true,
            maxPrice: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      userCategories: userCategories.map((uc) => ({
        id: uc.id,
        userId: uc.userId,
        categoryId: uc.categoryId,
        notificationsEnabled: uc.notificationsEnabled,
        createdAt: uc.createdAt,
        updatedAt: uc.updatedAt,
        Category: uc.Category,
      })),
    };
  }
}
