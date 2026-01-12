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
    @Query("language") language: string = "en"
  ) {
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
    if (!query) {
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
      query,
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
