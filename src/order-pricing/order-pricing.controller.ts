import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { OrderPricingService } from './order-pricing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('order-pricing')
export class OrderPricingController {
  private readonly logger = new Logger(OrderPricingController.name);

  constructor(private orderPricingService: OrderPricingService) {}

  @Get('cost')
  async getCreditCost(@Body() body: { orderBudget: number; isTeamApplication?: boolean }) {
    try {
      const cost = await this.orderPricingService.getCreditCost(
        body.orderBudget,
        body.isTeamApplication || false,
      );
      return {
        orderBudget: body.orderBudget,
        creditCost: cost,
        isTeamApplication: body.isTeamApplication || false,
      };
    } catch (error) {
      this.logger.error(
        `Error getting credit cost for order budget $${body.orderBudget}:`,
        error,
      );
      throw error;
    }
  }

  @Get()
  async getAllPricing() {
    try {
      return await this.orderPricingService.getAllPricing();
    } catch (error) {
      this.logger.error('Error getting all pricing:', error);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async setPricing(
    @Body()
    data: {
      minBudget: number;
      maxBudget?: number;
      creditCost: number;
      teamCreditCost?: number;
      refundPercentage?: number;
      teamRefundPercentage?: number;
      description?: string;
    },
  ) {
    try {
      return await this.orderPricingService.setPricing(data);
    } catch (error) {
      this.logger.error('Error setting pricing:', error);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updatePricing(
    @Param('id') id: string,
    @Body()
    data: {
      minBudget?: number;
      maxBudget?: number;
      creditCost?: number;
      teamCreditCost?: number;
      refundPercentage?: number;
      teamRefundPercentage?: number;
      description?: string;
    },
  ) {
    try {
      const pricingId = parseInt(id);
      // For now, we'll use setPricing which handles both create and update
      return await this.orderPricingService.setPricing({
        minBudget: data.minBudget || 0,
        maxBudget: data.maxBudget,
        creditCost: data.creditCost || 1.0,
        teamCreditCost: data.teamCreditCost,
        refundPercentage: data.refundPercentage,
        teamRefundPercentage: data.teamRefundPercentage,
        description: data.description,
      });
    } catch (error) {
      this.logger.error(`Error updating pricing ${id}:`, error);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deactivatePricing(@Param('id') id: string) {
    try {
      const pricingId = parseInt(id);
      return await this.orderPricingService.deactivatePricing(pricingId);
    } catch (error) {
      this.logger.error(`Error deactivating pricing ${id}:`, error);
      throw error;
    }
  }

  @Post('initialize-defaults')
  @UseGuards(JwtAuthGuard)
  async initializeDefaults() {
    try {
      await this.orderPricingService.initializeDefaultPricing();
      return {
        message: 'Default pricing configurations initialized successfully',
      };
    } catch (error) {
      this.logger.error('Error initializing default pricing:', error);
      throw error;
    }
  }
}
