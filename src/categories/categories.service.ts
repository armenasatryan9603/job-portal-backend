import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Helper method to transform category data based on language
  private transformCategoryForLanguage(category: any, language: string = "en") {
    if (!category) {
      return category;
    }

    const languageMap = {
      en: {
        name: "nameEn",
        description: "descriptionEn",
      },
      ru: {
        name: "nameRu",
        description: "descriptionRu",
      },
      hy: {
        name: "nameHy",
        description: "descriptionHy",
      },
    };

    const langFields = languageMap[language] || languageMap["en"];

    // Helper to get language-specific name
    const getLocalizedName = (item: any, defaultName: string) => {
      if (!item) return defaultName;
      const nameField = langFields.name; // nameEn, nameRu, or nameHy
      return item[nameField] || item.name || defaultName;
    };

    // Helper to get language-specific description
    const getLocalizedDescription = (
      item: any,
      defaultDescription?: string
    ) => {
      if (!item) return defaultDescription;
      const descField = langFields.description; // descriptionEn, descriptionRu, or descriptionHy
      return item[descField] || item.description || defaultDescription;
    };

    // Transform features with language-specific names
    const features = category.CategoryFeatures
      ? category.CategoryFeatures.map((sf: any) => {
          const feature = sf?.Feature;
          if (!feature) return null;
          return {
            id: feature.id,
            name: getLocalizedName(feature, feature.name || ""),
            description: getLocalizedDescription(feature, feature.description),
          };
        }).filter((f: any) => f !== null)
      : [];

    // Transform technologies with language-specific names
    const technologies = category.CategoryTechnologies
      ? category.CategoryTechnologies.map((st: any) => {
          const technology = st?.Technology;
          if (!technology) return null;
          return {
            id: technology.id,
            name: getLocalizedName(technology, technology.name || ""),
            description: getLocalizedDescription(
              technology,
              technology.description
            ),
          };
        }).filter((t: any) => t !== null)
      : [];

    // Transform children recursively if they exist
    const children = category.Children
      ? category.Children.map((child: any) =>
          this.transformCategoryForLanguage(child, language)
        )
      : undefined;

    return {
      ...category,
      name: category[langFields.name] || category.name || "",
      description:
        category[langFields.description] || category.description || null,
      features,
      technologies,
      ...(children !== undefined && { Children: children }),
    };
  }

  async create(createCategoryDto: {
    name: string;
    description?: string;
    nameEn?: string;
    nameRu?: string;
    nameHy?: string;
    descriptionEn?: string;
    descriptionRu?: string;
    descriptionHy?: string;
    searchTag?: string;
    imageUrl?: string;
    parentId?: number;
    averagePrice?: number;
    minPrice?: number;
    maxPrice?: number;
    currency?: string;
    rateUnit?: string;
    features?: string[];
    featuresEn?: string[];
    featuresRu?: string[];
    featuresHy?: string[];
    technologies?: string[];
    technologiesEn?: string[];
    technologiesRu?: string[];
    technologiesHy?: string[];
    completionRate?: number;
    isActive?: boolean;
  }) {
    // If parentId is provided, check if parent exists
    if (createCategoryDto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: createCategoryDto.parentId },
      });

      if (!parent) {
        throw new BadRequestException(
          `Parent category with ID ${createCategoryDto.parentId} not found`
        );
      }
    }

    return this.prisma.category.create({
      data: createCategoryDto,
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
    language: string = "en"
  ) {
    try {
      const skip = (page - 1) * limit;
      const where = parentId !== undefined ? { parentId } : {};

      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          skip,
          take: limit,
          include: {
            Parent: true,
            Children: true,
            CategoryFeatures: {
              include: {
                Feature: true,
              },
            },
            CategoryTechnologies: {
              include: {
                Technology: true,
              },
            },
            _count: {
              select: {
                Orders: true,
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        this.prisma.category.count({ where }),
      ]);

      // Add computed fields to each category
      const categoriesWithStats = await Promise.all(
        categories.map(async (category) => {
          const [specialistCount, recentOrders] = await Promise.all([
            this.prisma.userCategory.count({
              where: { categoryId: category.id },
            }),
            this.prisma.order.count({
              where: {
                categoryId: category.id,
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
              },
            }),
          ]);

          return {
            ...category,
            specialistCount,
            recentOrders,
          };
        })
      );

      // Transform categories for the specified language
      const transformedCategories = categoriesWithStats.map((category) =>
        this.transformCategoryForLanguage(category, language)
      );

      return {
        categories: transformedCategories,
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
      throw new BadRequestException(
        `Failed to fetch categories: ${error.message}`
      );
    }
  }

  async findOne(id: number, language: string = "en") {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        Parent: true,
        Children: true,
        CategoryFeatures: {
          include: {
            Feature: true,
          },
        },
        CategoryTechnologies: {
          include: {
            Technology: true,
          },
        },
        Orders: {
          take: 10,
          orderBy: { createdAt: "desc" },
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

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Add computed fields
    const specialistCount = await this.prisma.userCategory.count({
      where: { categoryId: id },
    });
    const recentOrders = await this.prisma.order.count({
      where: {
        categoryId: id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const categoryWithStats = {
      ...category,
      specialistCount,
      recentOrders,
    };

    return this.transformCategoryForLanguage(categoryWithStats, language);
  }

  async update(
    id: number,
    updateCategoryDto: {
      name?: string;
      description?: string;
      nameEn?: string;
      nameRu?: string;
      nameHy?: string;
      descriptionEn?: string;
      descriptionRu?: string;
      descriptionHy?: string;
      searchTag?: string;
      imageUrl?: string;
      parentId?: number;
      averagePrice?: number;
      minPrice?: number;
      maxPrice?: number;
      currency?: string;
      rateUnit?: string;
      features?: string[];
      featuresEn?: string[];
      featuresRu?: string[];
      featuresHy?: string[];
      technologies?: string[];
      technologiesEn?: string[];
      technologiesRu?: string[];
      technologiesHy?: string[];
      completionRate?: number;
      isActive?: boolean;
    }
  ) {
    // Check if category exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // If parentId is being updated, check if parent exists and prevent circular reference
    if (updateCategoryDto.parentId !== undefined) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException("Category cannot be its own parent");
      }

      if (updateCategoryDto.parentId !== null) {
        const parent = await this.prisma.category.findUnique({
          where: { id: updateCategoryDto.parentId },
        });

        if (!parent) {
          throw new BadRequestException(
            `Parent category with ID ${updateCategoryDto.parentId} not found`
          );
        }

        // Check for circular reference
        const isCircular = await this.checkCircularReference(
          id,
          updateCategoryDto.parentId
        );
        if (isCircular) {
          throw new BadRequestException(
            "Cannot set parent: would create circular reference"
          );
        }
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
      include: {
        Parent: true,
        Children: true,
      },
    });
  }

  async remove(id: number) {
    // Check if category exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if category has children
    const childrenCount = await this.prisma.category.count({
      where: { parentId: id },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        "Cannot delete category with child categories. Please delete or reassign child categories first."
      );
    }

    // Check if category has specialist profiles or orders
    const [specialistCount, ordersCount] = await Promise.all([
      this.prisma.userCategory.count({ where: { categoryId: id } }),
      this.prisma.order.count({ where: { categoryId: id } }),
    ]);

    if (specialistCount > 0 || ordersCount > 0) {
      throw new BadRequestException(
        "Cannot delete category with associated specialist profiles or orders. Please reassign them first."
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async getRootCategories(language: string = "en") {
    try {
      const categories = await this.prisma.category.findMany({
        where: { parentId: null, isActive: true },
        include: {
          Children: {
            where: { isActive: true },
          },
          CategoryFeatures: {
            include: {
              Feature: true,
            },
          },
          CategoryTechnologies: {
            include: {
              Technology: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Add computed fields to each category
      const categoriesWithStats = await Promise.all(
        categories.map(async (category) => {
          const [specialistCount, recentOrders] = await Promise.all([
            this.prisma.userCategory.count({
              where: { categoryId: category.id },
            }),
            this.prisma.order.count({
              where: {
                categoryId: category.id,
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
              },
            }),
          ]);

          return {
            ...category,
            specialistCount,
            recentOrders,
          };
        })
      );

      // Transform categories for the specified language
      return categoriesWithStats.map((category) =>
        this.transformCategoryForLanguage(category, language)
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch root categories: ${error.message}`
      );
    }
  }

  async getChildCategories(parentId: number, language: string = "en") {
    const categories = await this.prisma.category.findMany({
      where: { parentId },
      include: {
        Parent: true,
        CategoryFeatures: {
          include: {
            Feature: true,
          },
        },
        CategoryTechnologies: {
          include: {
            Technology: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Transform categories for the specified language
    return categories.map((category) =>
      this.transformCategoryForLanguage(category, language)
    );
  }

  async searchCategories(
    query: string,
    page: number = 1,
    limit: number = 10,
    language: string = "en"
  ) {
    const skip = (page - 1) * limit;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        categories: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    // Search by searchTag only (case-insensitive contains)
    const searchConditions: Prisma.CategoryWhereInput = {
      isActive: true,
      searchTag: {
        not: null,
        contains: trimmedQuery,
        mode: Prisma.QueryMode.insensitive,
      },
    };

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where: searchConditions,
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
        orderBy: { name: "asc" },
      }),
      this.prisma.category.count({
        where: searchConditions,
      }),
    ]);

    // Transform categories for the specified language
    const transformedCategories = categories.map((category) =>
      this.transformCategoryForLanguage(category, language)
    );

    return {
      categories: transformedCategories,
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
    categoryId: number,
    parentId: number
  ): Promise<boolean> {
    let currentParentId = parentId;

    while (currentParentId !== null) {
      if (currentParentId === categoryId) {
        return true;
      }

      const parent = await this.prisma.category.findUnique({
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
