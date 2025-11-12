import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { User } from '@prisma/client';

@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  private readonly logger = new Logger(ReferralsController.name);

  constructor(private readonly referralsService: ReferralsService) {}

  /**
   * Generate or get user's referral code
   */
  @Get('code')
  async getReferralCode(@GetUser() user: any): Promise<{ code: string }> {
    try {
      const userId = user?.userId || user?.id;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }
      const code = await this.referralsService.generateReferralCode(userId);
      return { code };
    } catch (error) {
      this.logger.error('Error getting referral code:', error);
      throw error;
    }
  }

  /**
   * Apply referral code during signup
   */
  @Post('apply-code')
  async applyReferralCode(
    @Body() body: { referralCode: string; userId: number },
  ): Promise<{
    success: boolean;
    referrerId?: number;
    rewardAmount?: number;
    bonusAmount?: number;
  }> {
    try {
      const { referralCode, userId } = body;

      if (!referralCode || !userId) {
        throw new BadRequestException('Referral code and user ID are required');
      }

      return await this.referralsService.applyReferralCode(
        referralCode,
        userId,
      );
    } catch (error) {
      this.logger.error('Error applying referral code:', error);
      throw error;
    }
  }

  /**
   * Get user's referral statistics
   */
  @Get('stats')
  async getReferralStats(@GetUser() user: any): Promise<{
    referralCode: string | null;
    totalReferrals: number;
    totalEarned: number;
    pendingRewards: number;
    referrals: Array<{
      id: number;
      referredUserName: string;
      rewardAmount: number;
      status: string;
      createdAt: Date;
    }>;
  }> {
    try {
      const userId = user?.userId || user?.id;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }
      return await this.referralsService.getReferralStats(userId);
    } catch (error) {
      this.logger.error('Error getting referral stats:', error);
      this.logger.error('Error details:', error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  /**
   * Get user's referral rewards history
   */
  @Get('rewards')
  async getReferralRewards(@GetUser() user: any): Promise<
    Array<{
      id: number;
      referredUserName: string;
      rewardAmount: number;
      bonusAmount: number;
      status: string;
      createdAt: Date;
      completedAt: Date | null;
    }>
  > {
    try {
      const userId = user?.userId || user?.id;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }
      return await this.referralsService.getReferralRewards(userId);
    } catch (error) {
      this.logger.error('Error getting referral rewards:', error);
      throw error;
    }
  }

  /**
   * Get referral link for sharing
   */
  @Get('share-link')
  async getShareLink(@GetUser() user: any): Promise<{
    referralCode: string;
    shareLink: string;
    message: string;
  }> {
    try {
      const userId = user?.userId || user?.id;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }
      const code = await this.referralsService.generateReferralCode(userId);

      // Generate shareable link (you can customize the domain)
      const baseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
      const shareLink = `${baseUrl}/signup?ref=${code}`;

      const message = `Join me on this amazing platform! Use my referral code: ${code} and we both get credits!`;

      return {
        referralCode: code,
        shareLink,
        message,
      };
    } catch (error) {
      this.logger.error('Error getting share link:', error);
      throw error;
    }
  }
}
