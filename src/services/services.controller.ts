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
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body()
    createServiceDto: {
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
    },
  ) {
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('parentId') parentId?: string,
    @Query('language') language: string = 'en',
  ) {
    return this.servicesService.findAll(
      parseInt(page),
      parseInt(limit),
      parentId ? parseInt(parentId) : undefined,
      language,
    );
  }

  @Get('root')
  async getRootServices(@Query('language') language: string = 'en') {
    return this.servicesService.getRootServices(language);
  }

  @Get('parent/:parentId')
  async getChildServices(
    @Param('parentId') parentId: string,
    @Query('language') language: string = 'en',
  ) {
    return this.servicesService.getChildServices(+parentId, language);
  }

  @Get('search')
  async searchServices(
    @Query('q') query: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('language') language: string = 'en',
  ) {
    if (!query) {
      return {
        services: [],
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

    return this.servicesService.searchServices(
      query,
      parseInt(page),
      parseInt(limit),
      language,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('language') language: string = 'en',
  ) {
    return this.servicesService.findOne(+id, language);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body()
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
    return this.servicesService.update(+id, updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    return this.servicesService.remove(+id);
  }
}
