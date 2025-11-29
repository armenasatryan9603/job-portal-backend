import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService
  ) {}

  /**
   * Generate a unique referral code for a user
   */
  async generateReferralCode(userId: number): Promise<string> {
    try {
      // Check if user already has a referral code
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      });

      if (existingUser?.referralCode) {
        return existingUser.referralCode;
      }

      // Generate unique code
      const code = await this.generateUniqueCode();

      // Update user with referral code
      await this.prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });

      this.logger.log(`Generated referral code ${code} for user ${userId}`);
      return code;
    } catch (error) {
      this.logger.error(
        `Error generating referral code for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Apply a referral code during signup
   */
  async applyReferralCode(
    referralCode: string,
    newUserId: number
  ): Promise<{
    success: boolean;
    referrerId?: number;
    rewardAmount?: number;
    bonusAmount?: number;
  }> {
    try {
      // Find the referrer by code
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode },
        select: { id: true, name: true },
      });

      if (!referrer) {
        throw new BadRequestException("Invalid referral code");
      }

      // Check if user is trying to refer themselves
      if (referrer.id === newUserId) {
        throw new BadRequestException("Cannot refer yourself");
      }

      // Check if user was already referred
      const existingReferral = await this.prisma.referralReward.findFirst({
        where: { referredUserId: newUserId },
      });

      if (existingReferral) {
        throw new BadRequestException("User has already been referred");
      }

      // Define reward amounts (configurable via environment variables)
      const referrerReward = parseFloat(
        process.env.REFERRAL_REWARD_AMOUNT || "10.0"
      ); // Credits for referrer
      const referredBonus = parseFloat(
        process.env.REFERRAL_BONUS_AMOUNT || "5.0"
      ); // Credits for referred user

      // Create referral reward record
      const referralReward = await this.prisma.referralReward.create({
        data: {
          referrerId: referrer.id,
          referredUserId: newUserId,
          rewardAmount: referrerReward,
          bonusAmount: referredBonus,
          status: "pending",
        },
      });

      // Update both users' credit balances and referral tracking
      await this.prisma.$transaction(async (tx) => {
        // Update referrer
        await tx.user.update({
          where: { id: referrer.id },
          data: {
            creditBalance: { increment: referrerReward },
            referralCredits: { increment: referrerReward },
          },
        });

        // Update referred user
        await tx.user.update({
          where: { id: newUserId },
          data: {
            referredBy: referrer.id,
            creditBalance: { increment: referredBonus },
          },
        });

        // Mark reward as completed
        await tx.referralReward.update({
          where: { id: referralReward.id },
          data: {
            status: "completed",
            completedAt: new Date(),
          },
        });

        // Notifications will be sent after transaction completes
      });

      // Send push notifications after transaction
      try {
        // Notification for referrer
        await this.notificationsService.createNotificationWithPush(
          referrer.id,
          "referral_reward",
          "notificationReferralRewardTitle",
          "notificationReferralRewardMessage",
          {
            referredUserId: newUserId,
            rewardAmount: referrerReward,
            referralCode: referralCode,
          },
          {
            rewardAmount: referrerReward,
          }
        );

        // Notification for referred user
        await this.notificationsService.createNotificationWithPush(
          newUserId,
          "referral_bonus",
          "notificationReferralBonusTitle",
          "notificationReferralBonusMessage",
          {
            referrerId: referrer.id,
            bonusAmount: referredBonus,
            referralCode: referralCode,
          },
          {
            bonusAmount: referredBonus,
          }
        );
      } catch (error) {
        this.logger.error("Failed to send referral notifications:", error);
      }

      this.logger.log(
        `Applied referral code ${referralCode}: Referrer ${referrer.id} got ${referrerReward} credits, User ${newUserId} got ${referredBonus} credits`
      );

      return {
        success: true,
        referrerId: referrer.id,
        rewardAmount: referrerReward,
        bonusAmount: referredBonus,
      };
    } catch (error) {
      this.logger.error(`Error applying referral code ${referralCode}:`, error);
      throw error;
    }
  }

  /**
   * Get user's referral statistics
   */
  async getReferralStats(userId: number): Promise<{
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
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          referralCode: true,
          referralCredits: true,
        },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      // Generate referral code if user doesn't have one
      let referralCode = user.referralCode;
      if (!referralCode) {
        referralCode = await this.generateReferralCode(userId);
      }

      // Get referral rewards
      const referralRewards = await this.prisma.referralReward.findMany({
        where: { referrerId: userId },
        include: {
          referredUser: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const totalReferrals = referralRewards.length;
      const totalEarned = referralRewards
        .filter((r) => r.status === "completed")
        .reduce((sum, r) => sum + r.rewardAmount, 0);
      const pendingRewards = referralRewards
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + r.rewardAmount, 0);

      return {
        referralCode: referralCode,
        totalReferrals,
        totalEarned,
        pendingRewards,
        referrals: referralRewards.map((reward) => ({
          id: reward.id,
          referredUserName: reward.referredUser?.name || "Unknown User",
          rewardAmount: reward.rewardAmount,
          status: reward.status,
          createdAt: reward.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error getting referral stats for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get user's referral rewards history
   */
  async getReferralRewards(userId: number): Promise<
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
      const rewards = await this.prisma.referralReward.findMany({
        where: { referrerId: userId },
        include: {
          referredUser: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return rewards.map((reward) => ({
        id: reward.id,
        referredUserName: reward.referredUser.name,
        rewardAmount: reward.rewardAmount,
        bonusAmount: reward.bonusAmount,
        status: reward.status,
        createdAt: reward.createdAt,
        completedAt: reward.completedAt,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting referral rewards for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate a unique referral code
   */
  private async generateUniqueCode(): Promise<string> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Generate code like "USER123" or "REF456"
      const randomNum = Math.floor(Math.random() * 1000);
      const code = `REF${randomNum.toString().padStart(3, "0")}`;

      // Check if code already exists
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }

      attempts++;
    }

    // Fallback to timestamp-based code
    const timestamp = Date.now().toString().slice(-6);
    return `REF${timestamp}`;
  }
}
