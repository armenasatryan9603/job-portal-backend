import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrderPricingService {
  private readonly logger = new Logger(OrderPricingService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Get the credit cost based on order budget
   * @param orderBudget - The budget amount of the order
   * @returns Credit cost for the operation
   */
  async getCreditCost(orderBudget: number): Promise<number> {
    try {
      // Find pricing tier that matches the order budget
      const pricing = await this.prisma.orderPricing.findFirst({
        where: {
          minBudget: { lte: orderBudget },
          OR: [{ maxBudget: { gte: orderBudget } }, { maxBudget: null }],
          isActive: true,
        },
        orderBy: {
          minBudget: 'desc', // Get the highest tier that applies
        },
      });

      if (pricing) {
        this.logger.log(
          `Found pricing for order budget $${orderBudget}: ${pricing.creditCost} credits`,
        );
        return pricing.creditCost;
      }

      // Default fallback pricing (percentage of budget)
      const defaultPricing = this.getDefaultPricing(orderBudget);
      this.logger.warn(
        `No pricing found for order budget $${orderBudget}, using default: ${defaultPricing} credits`,
      );
      return defaultPricing;
    } catch (error) {
      this.logger.error(
        `Error getting credit cost for order budget $${orderBudget}:`,
        error,
      );
      // Return default pricing on error
      return this.getDefaultPricing(orderBudget);
    }
  }

  /**
   * Get pricing configuration for order budget (including refund percentage)
   * @param orderBudget - The budget amount of the order
   * @returns Pricing configuration with credit cost and refund percentage
   */
  async getPricingConfig(orderBudget: number): Promise<{
    creditCost: number;
    refundPercentage: number;
  }> {
    try {
      // Find pricing tier that matches the order budget
      const pricing = await this.prisma.orderPricing.findFirst({
        where: {
          minBudget: { lte: orderBudget },
          OR: [{ maxBudget: { gte: orderBudget } }, { maxBudget: null }],
          isActive: true,
        },
        orderBy: {
          minBudget: 'desc', // Get the highest tier that applies
        },
      });

      if (pricing) {
        this.logger.log(
          `Found pricing config for order budget $${orderBudget}: ${pricing.creditCost} credits, ${pricing.refundPercentage * 100}% refund`,
        );
        return {
          creditCost: pricing.creditCost,
          refundPercentage: pricing.refundPercentage,
        };
      }

      // Default fallback pricing
      const defaultPricing = this.getDefaultPricing(orderBudget);
      this.logger.warn(
        `No pricing found for order budget $${orderBudget}, using default: ${defaultPricing} credits, 50% refund`,
      );
      return {
        creditCost: defaultPricing,
        refundPercentage: 0.5, // Default 50% refund
      };
    } catch (error) {
      this.logger.error(
        `Error getting pricing config for order budget $${orderBudget}:`,
        error,
      );
      // Return default pricing on error
      const defaultPricing = this.getDefaultPricing(orderBudget);
      return {
        creditCost: defaultPricing,
        refundPercentage: 0.5, // Default 50% refund
      };
    }
  }

  /**
   * Get all available pricing configurations
   */
  async getAllPricing(): Promise<any[]> {
    return this.prisma.orderPricing.findMany({
      where: { isActive: true },
      orderBy: { minBudget: 'asc' },
    });
  }

  /**
   * Create or update pricing configuration
   */
  async setPricing(data: {
    minBudget: number;
    maxBudget?: number;
    creditCost: number;
    refundPercentage?: number;
    description?: string;
  }): Promise<any> {
    const {
      minBudget,
      maxBudget,
      creditCost,
      refundPercentage = 0.5,
      description,
    } = data;

    // Check if pricing already exists for this budget range
    const existing = await this.prisma.orderPricing.findFirst({
      where: {
        minBudget: minBudget,
        maxBudget: maxBudget || null,
      },
    });

    if (existing) {
      // Update existing pricing
      return this.prisma.orderPricing.update({
        where: { id: existing.id },
        data: {
          creditCost,
          refundPercentage,
          description,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new pricing
      return this.prisma.orderPricing.create({
        data: {
          minBudget,
          maxBudget,
          creditCost,
          refundPercentage,
          description,
        },
      });
    }
  }

  /**
   * Deactivate pricing configuration
   */
  async deactivatePricing(id: number): Promise<any> {
    return this.prisma.orderPricing.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });
  }

  /**
   * Get default pricing based on order budget when no configuration exists
   */
  private getDefaultPricing(orderBudget: number): number {
    // Default: 5% of order budget as credit cost
    // Minimum 1 credit, maximum 100 credits
    const percentage = 0.05; // 5%
    const creditCost = Math.max(
      1,
      Math.min(100, Math.round(orderBudget * percentage)),
    );

    return creditCost;
  }

  /**
   * Process refunds for rejected applicants
   * @param orderId - The order ID
   * @param selectedProposalId - The ID of the selected proposal
   * @param orderBudget - The order budget for calculating refund percentage
   */
  async processRefundsForRejectedApplicants(
    orderId: number,
    selectedProposalId: number,
    orderBudget: number,
  ): Promise<void> {
    try {
      // Get pricing configuration for refund percentage
      const pricingConfig = await this.getPricingConfig(orderBudget);
      const refundAmount = Math.round(
        pricingConfig.creditCost * pricingConfig.refundPercentage,
      );

      if (refundAmount <= 0) {
        this.logger.log(
          `No refund needed for order ${orderId} (refund amount: ${refundAmount})`,
        );
        return;
      }

      // Get all rejected proposals for this order
      const rejectedProposals = await this.prisma.orderProposal.findMany({
        where: {
          orderId: orderId,
          id: { not: selectedProposalId },
          status: { in: ['pending', 'rejected'] },
        },
        include: {
          User: true,
        },
      });

      this.logger.log(
        `Processing refunds for ${rejectedProposals.length} rejected applicants on order ${orderId}`,
      );

      // Process refunds in a transaction
      await this.prisma.$transaction(async (tx) => {
        for (const proposal of rejectedProposals) {
          // Refund credits to the user
          await tx.user.update({
            where: { id: proposal.userId },
            data: {
              creditBalance: { increment: refundAmount },
            },
          });

          // Update proposal status to rejected
          await tx.orderProposal.update({
            where: { id: proposal.id },
            data: { status: 'rejected' },
          });

          // Create notification for rejected applicant (will be sent after transaction)
          // We'll send the push notification after the transaction completes

          this.logger.log(
            `Refunded ${refundAmount} credits to user ${proposal.userId} for rejected proposal ${proposal.id}`,
          );
        }
      });

      // Send push notifications for rejected applicants
      for (const proposal of rejectedProposals) {
        try {
          await this.notificationsService.createNotificationWithPush(
            proposal.userId,
            'proposal_rejected',
            'Application Update',
            `Unfortunately, you were not selected for this job. We've refunded ${refundAmount} credits to your account.`,
            {
              orderId: orderId,
              proposalId: proposal.id,
              refundAmount: refundAmount,
            },
          );
        } catch (error) {
          this.logger.error(
            `Failed to send notification to user ${proposal.userId}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Successfully processed refunds for ${rejectedProposals.length} rejected applicants`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing refunds for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Initialize default pricing configurations based on budget ranges
   */
  async initializeDefaultPricing(): Promise<void> {
    this.logger.log('Initializing default pricing configurations...');

    const defaultConfigs = [
      {
        minBudget: 0,
        maxBudget: 500,
        creditCost: 1,
        refundPercentage: 0.5,
        description: 'Small orders ($0-$500)',
      },
      {
        minBudget: 500,
        maxBudget: 2000,
        creditCost: 5,
        refundPercentage: 0.6,
        description: 'Medium orders ($500-$2000)',
      },
      {
        minBudget: 2000,
        maxBudget: 5000,
        creditCost: 10,
        refundPercentage: 0.7,
        description: 'Large orders ($2000-$5000)',
      },
      {
        minBudget: 5000,
        maxBudget: undefined,
        creditCost: 20,
        refundPercentage: 0.8,
        description: 'Premium orders ($5000+)',
      },
    ];

    for (const config of defaultConfigs) {
      try {
        await this.setPricing(config);
        this.logger.log(
          `Initialized pricing for budget range $${config.minBudget}-${config.maxBudget || '∞'}: ${config.creditCost} credits, ${config.refundPercentage * 100}% refund`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to initialize pricing for budget range $${config.minBudget}-${config.maxBudget || '∞'}:`,
          error,
        );
      }
    }

    this.logger.log('Default pricing initialization completed');
  }
}
