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
} from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body()
    createCategoryDto: {
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
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("parentId") parentId?: string,
    @Query("language") language: string = "en",
    @Query("q") searchQuery?: string
  ) {
    const trimmedQ = searchQuery?.trim();
    if (trimmedQ) {
      return this.categoriesService.searchCategories(
        trimmedQ,
        parseInt(page),
        parseInt(limit),
        language
      );
    }
    return this.categoriesService.findAll(
      parseInt(page),
      parseInt(limit),
      parentId ? parseInt(parentId) : undefined,
      language
    );
  }

  @Get("root")
  async getRootCategories(@Query("language") language: string = "en") {
    return this.categoriesService.getRootCategories(language);
  }

  @Get("parent/:parentId")
  async getChildCategories(
    @Param("parentId") parentId: string,
    @Query("language") language: string = "en"
  ) {
    return this.categoriesService.getChildCategories(+parentId, language);
  }

  @Get("search")
  async searchCategories(
    @Query("q") query: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("language") language: string = "en"
  ) {
    const trimmedQuery = typeof query === "string" ? query.trim() : "";
    if (!trimmedQuery) {
      return {
        categories: [],
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

    return this.categoriesService.searchCategories(
      trimmedQuery,
      parseInt(page),
      parseInt(limit),
      language
    );
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @Query("language") language: string = "en"
  ) {
    return this.categoriesService.findOne(+id, language);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body()
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
    return this.categoriesService.update(+id, updateCategoryDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string) {
    return this.categoriesService.remove(+id);
  }
}
