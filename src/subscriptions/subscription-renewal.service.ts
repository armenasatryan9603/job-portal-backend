import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get subscriptions expiring soon (for notifications)
   * This can be called manually or from user actions
   */
  async getExpiringSubscriptions(daysAhead: number = 7) {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.userSubscription.findMany({
      where: {
        status: "active",
        endDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        Plan: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Mark expired subscriptions as expired
   * Can be called manually or from user actions
   */
  async markExpiredSubscriptions() {
    const now = new Date();

    const result = await this.prisma.userSubscription.updateMany({
      where: {
        status: "active",
        endDate: {
          lt: now,
        },
      },
      data: {
        status: "expired",
      },
    });

    this.logger.log(`Marked ${result.count} subscriptions as expired`);
    return result;
  }
}
