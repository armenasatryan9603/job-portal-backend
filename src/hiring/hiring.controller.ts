import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { HiringService } from './hiring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('hiring')
export class HiringController {
  private readonly logger = new Logger(HiringController.name);

  constructor(private hiringService: HiringService) {}

  @Post('check-status')
  @UseGuards(JwtAuthGuard)
  async checkHiringStatus(
    @Request() req,
    @Body()
    checkData: {
      specialistId: number;
      orderId: number;
    },
  ) {
    try {
      this.logger.log(
        `Checking hiring status: Client ${req.user.userId} checking specialist ${checkData.specialistId} for order ${checkData.orderId}`,
      );

      const result = await this.hiringService.checkHiringStatus(
        checkData.specialistId,
        checkData.orderId,
        req.user.userId,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error checking hiring status: Client ${req.user.userId} failed to check specialist ${checkData.specialistId} for order ${checkData.orderId}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async hireSpecialist(
    @Request() req,
    @Body()
    hireData: {
      specialistId: number;
      message: string;
      orderId: number;
    },
  ) {
    try {
      // Log the hiring attempt
      this.logger.log(
        `Hiring attempt: Client ${req.user.userId} trying to hire specialist ${hireData.specialistId} for order ${hireData.orderId}`,
      );

      const result = await this.hiringService.hireSpecialist({
        ...hireData,
        clientId: req.user.userId,
      });

      // Log successful hiring
      this.logger.log(
        `Hiring successful: Client ${req.user.userId} hired specialist ${hireData.specialistId} for order ${hireData.orderId}`,
      );

      return result;
    } catch (error) {
      // Log the error
      this.logger.error(
        `Hiring failed: Client ${req.user.userId} failed to hire specialist ${hireData.specialistId} for order ${hireData.orderId}`,
        error.stack,
      );

      // Re-throw the error to let NestJS handle it
      throw error;
    }
  }

  @Post('team')
  @UseGuards(JwtAuthGuard)
  async hireTeam(
    @Request() req,
    @Body()
    hireData: {
      teamId: number;
      message: string;
      orderId: number;
    },
  ) {
    try {
      // Log the hiring attempt
      this.logger.log(
        `Hiring attempt: Client ${req.user.userId} trying to hire team ${hireData.teamId} for order ${hireData.orderId}`,
      );

      const result = await this.hiringService.hireTeam({
        ...hireData,
        clientId: req.user.userId,
      });

      // Log successful hiring
      this.logger.log(
        `Hiring successful: Client ${req.user.userId} hired team ${hireData.teamId} for order ${hireData.orderId}`,
      );

      return result;
    } catch (error) {
      // Log the error
      this.logger.error(
        `Hiring failed: Client ${req.user.userId} failed to hire team ${hireData.teamId} for order ${hireData.orderId}`,
        error.stack,
      );

      // Re-throw the error to let NestJS handle it
      throw error;
    }
  }
}
