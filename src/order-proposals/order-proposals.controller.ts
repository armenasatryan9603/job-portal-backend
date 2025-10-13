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
  Request,
} from '@nestjs/common';
import { OrderProposalsService } from './order-proposals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('order-proposals')
export class OrderProposalsController {
  constructor(private readonly orderProposalsService: OrderProposalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body()
    createOrderProposalDto: {
      orderId: number;
      userId: number;
      price?: number;
      message?: string;
    },
  ) {
    return this.orderProposalsService.create(createOrderProposalDto);
  }

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  async createWithCreditDeduction(
    @Request() req,
    @Body()
    createOrderProposalDto: {
      orderId: number;
      message?: string;
    },
  ) {
    try {
      // Get userId from JWT token
      const userId = req.user?.userId;

      if (!userId) {
        throw new Error('User ID not found in authentication token');
      }

      return this.orderProposalsService.createWithCreditDeduction({
        orderId: createOrderProposalDto.orderId,
        message: createOrderProposalDto.message,
        userId: userId,
      });
    } catch (error) {
      console.error('Error in createWithCreditDeduction:', error);
      throw error;
    }
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.orderProposalsService.findAll(
      parseInt(page),
      parseInt(limit),
      status,
      orderId ? parseInt(orderId) : undefined,
      userId ? parseInt(userId) : undefined,
    );
  }

  @Get('search')
  async searchProposals(
    @Query('q') query: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    if (!query) {
      return {
        proposals: [],
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

    return this.orderProposalsService.searchProposals(
      query,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('order/:orderId')
  async getProposalsByOrder(
    @Param('orderId') orderId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.orderProposalsService.getProposalsByOrder(
      +orderId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('user/:userId')
  async getProposalsByUser(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.orderProposalsService.getProposalsByUser(
      +userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('status/:status')
  async getProposalsByStatus(
    @Param('status') status: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.orderProposalsService.getProposalsByStatus(
      status,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orderProposalsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    updateOrderProposalDto: {
      price?: number;
      message?: string;
      status?: string;
    },
  ) {
    return this.orderProposalsService.update(+id, updateOrderProposalDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.orderProposalsService.remove(+id);
  }
}
