import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // Helper method to transform service data based on language
  private transformServiceForLanguage(service: any, language: string = 'en') {
    const languageMap = {
      en: { name: 'nameEn', description: 'descriptionEn' },
      ru: { name: 'nameRu', description: 'descriptionRu' },
      hy: { name: 'nameHy', description: 'descriptionHy' },
    };

    const langFields = languageMap[language] || languageMap['en'];

    return {
      ...service,
      name: service[langFields.name] || service.name,
      description: service[langFields.description] || service.description,
    };
  }

  async create(createServiceDto: {
    name: string;
    description?: string;
    parentId?: number;
    averagePrice?: number;
    minPrice?: number;
    maxPrice?: number;
    features?: string[];
    technologies?: string[];
    completionRate?: number;
    isActive?: boolean;
  }) {
    // If parentId is provided, check if parent exists
    if (createServiceDto.parentId) {
      const parent = await this.prisma.service.findUnique({
        where: { id: createServiceDto.parentId },
      });

      if (!parent) {
        throw new BadRequestException(
          `Parent service with ID ${createServiceDto.parentId} not found`,
        );
      }
    }

    return this.prisma.service.create({
      data: createServiceDto,
      include: {
        Parent: true,
        Children: true,
      },
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    parentId?: number,
    language: string = 'en',
  ) {
    const skip = (page - 1) * limit;
    const where = parentId !== undefined ? { parentId } : {};

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        include: {
          Parent: true,
          Children: true,
          _count: {
            select: {
              Orders: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    // Add computed fields to each service
    const servicesWithStats = await Promise.all(
      services.map(async (service) => {
        const [specialistCount, recentOrders] = await Promise.all([
          this.prisma.userService.count({
            where: { serviceId: service.id },
          }),
          this.prisma.order.count({
            where: {
              serviceId: service.id,
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          }),
        ]);

        return {
          ...service,
          specialistCount,
          recentOrders,
        };
      }),
    );

    // Transform services for the specified language
    const transformedServices = servicesWithStats.map((service) =>
      this.transformServiceForLanguage(service, language),
    );

    return {
      services: transformedServices,
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

  async findOne(id: number, language: string = 'en') {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        Parent: true,
        Children: true,
        Orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
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
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    // Add computed fields
    const specialistCount = await this.prisma.userService.count({
      where: { serviceId: id },
    });
    const recentOrders = await this.prisma.order.count({
      where: {
        serviceId: id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const serviceWithStats = {
      ...service,
      specialistCount,
      recentOrders,
    };

    return this.transformServiceForLanguage(serviceWithStats, language);
  }

  async update(
    id: number,
    updateServiceDto: {
      name?: string;
      description?: string;
      parentId?: number;
      averagePrice?: number;
      minPrice?: number;
      maxPrice?: number;
      features?: string[];
      technologies?: string[];
      completionRate?: number;
      isActive?: boolean;
    },
  ) {
    // Check if service exists
    const existingService = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    // If parentId is being updated, check if parent exists and prevent circular reference
    if (updateServiceDto.parentId !== undefined) {
      if (updateServiceDto.parentId === id) {
        throw new BadRequestException('Service cannot be its own parent');
      }

      if (updateServiceDto.parentId !== null) {
        const parent = await this.prisma.service.findUnique({
          where: { id: updateServiceDto.parentId },
        });

        if (!parent) {
          throw new BadRequestException(
            `Parent service with ID ${updateServiceDto.parentId} not found`,
          );
        }

        // Check for circular reference
        const isCircular = await this.checkCircularReference(
          id,
          updateServiceDto.parentId,
        );
        if (isCircular) {
          throw new BadRequestException(
            'Cannot set parent: would create circular reference',
          );
        }
      }
    }

    return this.prisma.service.update({
      where: { id },
      data: updateServiceDto,
      include: {
        Parent: true,
        Children: true,
      },
    });
  }

  async remove(id: number) {
    // Check if service exists
    const existingService = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    // Check if service has children
    const childrenCount = await this.prisma.service.count({
      where: { parentId: id },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        'Cannot delete service with child services. Please delete or reassign child services first.',
      );
    }

    // Check if service has specialist profiles or orders
    const [specialistCount, ordersCount] = await Promise.all([
      this.prisma.userService.count({ where: { serviceId: id } }),
      this.prisma.order.count({ where: { serviceId: id } }),
    ]);

    if (specialistCount > 0 || ordersCount > 0) {
      throw new BadRequestException(
        'Cannot delete service with associated specialist profiles or orders. Please reassign them first.',
      );
    }

    return this.prisma.service.delete({
      where: { id },
    });
  }

  async getRootServices(language: string = 'en') {
    const services = await this.prisma.service.findMany({
      where: { parentId: null, isActive: true },
      include: {
        Children: {
          where: { isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Add computed fields to each service
    const servicesWithStats = await Promise.all(
      services.map(async (service) => {
        const [specialistCount, recentOrders] = await Promise.all([
          this.prisma.userService.count({
            where: { serviceId: service.id },
          }),
          this.prisma.order.count({
            where: {
              serviceId: service.id,
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          }),
        ]);

        return {
          ...service,
          specialistCount,
          recentOrders,
        };
      }),
    );

    // Transform services for the specified language
    return servicesWithStats.map((service) =>
      this.transformServiceForLanguage(service, language),
    );
  }

  async getChildServices(parentId: number, language: string = 'en') {
    const services = await this.prisma.service.findMany({
      where: { parentId },
      include: {
        Parent: true,
      },
      orderBy: { name: 'asc' },
    });

    // Transform services for the specified language
    return services.map((service) =>
      this.transformServiceForLanguage(service, language),
    );
  }

  async searchServices(
    query: string,
    page: number = 1,
    limit: number = 10,
    language: string = 'en',
  ) {
    const skip = (page - 1) * limit;

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        skip,
        take: limit,
        include: {
          Parent: true,
          Children: true,
          _count: {
            select: {
              Orders: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.service.count({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    // Transform services for the specified language
    const transformedServices = services.map((service) =>
      this.transformServiceForLanguage(service, language),
    );

    return {
      services: transformedServices,
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

  private async checkCircularReference(
    serviceId: number,
    parentId: number,
  ): Promise<boolean> {
    let currentParentId = parentId;

    while (currentParentId !== null) {
      if (currentParentId === serviceId) {
        return true;
      }

      const parent = await this.prisma.service.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });

      if (!parent) {
        break;
      }

      currentParentId = Number(parent.parentId);
    }

    return false;
  }
}
