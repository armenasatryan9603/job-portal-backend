import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as bcrypt from "bcrypt";
import {
  UserLanguage,
  isValidUserLanguage,
} from "../types/user-languages";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 10, role?: string) {
    const skip = (page - 1) * limit;
    const where = role ? { role } : {};

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
      throw new BadRequestException("Invalid user ID");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
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
        throw new BadRequestException("Duplicate language codes are not allowed");
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

    // Check if user has any orders or reviews
    const [ordersCount, reviewsCount] = await Promise.all([
      this.prisma.order.count({ where: { clientId: id } }),
      this.prisma.review.count({ where: { reviewerId: id } }),
    ]);

    if (ordersCount > 0 || reviewsCount > 0) {
      throw new BadRequestException(
        "Cannot delete user with existing orders or reviews. Consider deactivating instead."
      );
    }

    return this.prisma.user.delete({
      where: { id },
    });
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
      serviceId?: number;
      experienceYears?: number;
      priceMin?: number;
      priceMax?: number;
      location?: string;
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

    // If serviceId is provided, check if service exists
    if (specialistData.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: specialistData.serviceId },
      });

      if (!service) {
        throw new BadRequestException(
          `Service with ID ${specialistData.serviceId} not found`
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
    serviceId?: number,
    location?: string,
    currentUserId?: number
  ) {
    try {
      console.log("getSpecialists called with:", {
        page,
        limit,
        serviceId,
        location,
      });

      // Build where clause
      const whereClause: any = { role: "specialist" };

      if (serviceId) {
        whereClause.UserServices = {
          some: {
            serviceId: serviceId,
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
          createdAt: true,
          UserServices: {
            include: {
              Service: true,
            },
          },
          Reviews: {
            take: 5,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              Order: true,
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

      // Transform the data to match frontend expectations
      const transformedSpecialists = specialists.map((specialist) => {
        // Get the primary service (first one) for the specialist
        const primaryService = specialist.UserServices?.[0]?.Service;

        return {
          id: specialist.id,
          userId: specialist.id,
          serviceId: primaryService?.id,
          experienceYears: specialist.experienceYears,
          priceMin: specialist.priceMin,
          priceMax: specialist.priceMax,
          location: specialist.location,
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
          Service: primaryService,
          _count: {
            Proposals: 0, // This would need to be calculated separately if needed
          },
          averageRating: 0, // This would need to be calculated from reviews
          reviewCount: specialist.Reviews?.length || 0,
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
    const user = await this.prisma.user.findUnique({
      where: { id, role: "specialist" },
      include: {
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
    return {
      id: user.id,
      User: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        verified: user.verified,
        experienceYears: user.experienceYears,
        priceMin: user.priceMin,
        priceMax: user.priceMax,
        location: user.location,
        createdAt: user.createdAt,
        Proposals: user.Proposals,
        _count: user._count,
        reviews,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount: reviews.length,
      },
    };
  }

  async updateSpecialistProfile(
    id: number,
    specialistData: {
      serviceId?: number;
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

    // If serviceId is being updated, check if service exists
    if (specialistData.serviceId !== undefined) {
      if (specialistData.serviceId !== null) {
        const service = await this.prisma.service.findUnique({
          where: { id: specialistData.serviceId },
        });

        if (!service) {
          throw new BadRequestException(
            `Service with ID ${specialistData.serviceId} not found`
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

  async getSpecialistsByService(
    serviceId: number,
    page: number = 1,
    limit: number = 10
  ) {
    return this.getSpecialists(page, limit, serviceId);
  }

  async getSpecialistsByLocation(
    location: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.getSpecialists(page, limit, undefined, location);
  }

  // User service management methods
  async addUserService(
    userId: number,
    serviceId: number,
    notificationsEnabled: boolean = true
  ) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if service exists
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    // Check if user service already exists
    const existingUserService = await this.prisma.userService.findUnique({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
    });

    if (existingUserService) {
      throw new BadRequestException("User service already exists");
    }

    // Create user service
    const userService = await this.prisma.userService.create({
      data: {
        userId,
        serviceId,
        notificationsEnabled,
      },
      include: {
        Service: true,
      },
    });

    return userService;
  }

  async removeUserService(userId: number, serviceId: number) {
    // Check if user service exists
    const userService = await this.prisma.userService.findUnique({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
    });

    if (!userService) {
      throw new NotFoundException("User service not found");
    }

    // Delete user service
    await this.prisma.userService.delete({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
    });

    return { message: "User service removed successfully" };
  }

  async updateUserServiceNotifications(
    userId: number,
    serviceId: number,
    notificationsEnabled: boolean
  ) {
    // Check if user service exists
    const userService = await this.prisma.userService.findUnique({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
    });

    if (!userService) {
      throw new NotFoundException("User service not found");
    }

    // Update notifications setting
    const updatedUserService = await this.prisma.userService.update({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
      data: {
        notificationsEnabled,
      },
      include: {
        Service: true,
      },
    });

    return updatedUserService;
  }

  async getUserServices(userId: number) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get user services with service details
    const userServices = await this.prisma.userService.findMany({
      where: { userId },
      include: {
        Service: {
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
      userServices: userServices.map((us) => ({
        id: us.id,
        userId: us.userId,
        serviceId: us.serviceId,
        notificationsEnabled: us.notificationsEnabled,
        createdAt: us.createdAt,
        updatedAt: us.updatedAt,
        Service: us.Service,
      })),
    };
  }
}
