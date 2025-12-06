import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreditTransactionsService } from "../credit/credit-transactions.service";

@Injectable()
export class OrderPricingService {
  private readonly logger = new Logger(OrderPricingService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private creditTransactionsService: CreditTransactionsService
  ) {}

  /**
   * Get the credit cost based on order budget
   * @param orderBudget - The budget amount of the order
   * @param isTeamApplication - Whether this is a team application (default: false)
   * @returns Credit cost for the operation
   */
  async getCreditCost(orderBudget: number, isTeamApplication: boolean = false): Promise<number> {
    try {
      // Find pricing tier that matches the order budget
      const pricing = await this.prisma.orderPricing.findFirst({
        where: {
          minBudget: { lte: orderBudget },
          OR: [{ maxBudget: { gte: orderBudget } }, { maxBudget: null }],
          isActive: true,
        },
        orderBy: {
          minBudget: "desc", // Get the highest tier that applies
        },
      });

      if (pricing) {
        // Use team pricing if available and this is a team application
        const creditCost = isTeamApplication && pricing.teamCreditCost !== null
          ? pricing.teamCreditCost
          : pricing.creditCost;
        
        this.logger.log(
          `Found pricing for order budget $${orderBudget} (${isTeamApplication ? 'team' : 'individual'}): ${creditCost} credits`
        );
        return creditCost;
      }

      // Default fallback pricing (percentage of budget)
      const defaultPricing = this.getDefaultPricing(orderBudget, isTeamApplication);
      this.logger.warn(
        `No pricing found for order budget $${orderBudget} (${isTeamApplication ? 'team' : 'individual'}), using default: ${defaultPricing} credits`
      );
      return defaultPricing;
    } catch (error) {
      this.logger.error(
        `Error getting credit cost for order budget $${orderBudget}:`,
        error
      );
      // Return default pricing on error
      return this.getDefaultPricing(orderBudget, isTeamApplication);
    }
  }

  /**
   * Get pricing configuration for order budget (including refund percentage)
   * @param orderBudget - The budget amount of the order
   * @param isTeamApplication - Whether this is a team application (default: false)
   * @returns Pricing configuration with credit cost and refund percentage
   */
  async getPricingConfig(orderBudget: number, isTeamApplication: boolean = false): Promise<{
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
          minBudget: "desc", // Get the highest tier that applies
        },
      });

      if (pricing) {
        // Use team pricing if available and this is a team application
        const creditCost = isTeamApplication && pricing.teamCreditCost !== null
          ? pricing.teamCreditCost
          : pricing.creditCost;
        
        const refundPercentage = isTeamApplication && pricing.teamRefundPercentage !== null
          ? pricing.teamRefundPercentage
          : pricing.refundPercentage;
        
        this.logger.log(
          `Found pricing config for order budget $${orderBudget} (${isTeamApplication ? 'team' : 'individual'}): ${creditCost} credits, ${refundPercentage * 100}% refund`
        );
        return {
          creditCost,
          refundPercentage,
        };
      }

      // Default fallback pricing
      const defaultPricing = this.getDefaultPricing(orderBudget, isTeamApplication);
      this.logger.warn(
        `No pricing found for order budget $${orderBudget} (${isTeamApplication ? 'team' : 'individual'}), using default: ${defaultPricing} credits, 50% refund`
      );
      return {
        creditCost: defaultPricing,
        refundPercentage: 0.5, // Default 50% refund
      };
    } catch (error) {
      this.logger.error(
        `Error getting pricing config for order budget $${orderBudget}:`,
        error
      );
      // Return default pricing on error
      const defaultPricing = this.getDefaultPricing(orderBudget, isTeamApplication);
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
      orderBy: { minBudget: "asc" },
    });
  }

  /**
   * Create or update pricing configuration
   */
  async setPricing(data: {
    minBudget: number;
    maxBudget?: number;
    creditCost: number;
    teamCreditCost?: number;
    refundPercentage?: number;
    teamRefundPercentage?: number;
    description?: string;
  }): Promise<any> {
    const {
      minBudget,
      maxBudget,
      creditCost,
      teamCreditCost,
      refundPercentage = 0.5,
      teamRefundPercentage = 0.5,
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
          teamCreditCost: teamCreditCost !== undefined ? teamCreditCost : existing.teamCreditCost,
          refundPercentage,
          teamRefundPercentage: teamRefundPercentage !== undefined ? teamRefundPercentage : existing.teamRefundPercentage,
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
          teamCreditCost,
          refundPercentage,
          teamRefundPercentage,
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
   * @param orderBudget - The budget amount of the order
   * @param isTeamApplication - Whether this is a team application (default: false)
   */
  private getDefaultPricing(orderBudget: number, isTeamApplication: boolean = false): number {
    // Default: 5% of order budget as credit cost for individual, 7% for team
    // Minimum 1 credit, maximum 100 credits
    const percentage = isTeamApplication ? 0.07 : 0.05; // 7% for teams, 5% for individuals
    const creditCost = Math.max(
      1,
      Math.min(100, Math.round(orderBudget * percentage))
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
    orderBudget: number
  ): Promise<void> {
    try {
      // Get all rejected proposals for this order (to check if they are team applications)
      const rejectedProposals = await this.prisma.orderProposal.findMany({
        where: {
          orderId: orderId,
          id: { not: selectedProposalId },
          status: { in: ["pending", "rejected"] },
        },
        include: {
          User: true,
        },
      });

      this.logger.log(
        `Processing refunds for ${rejectedProposals.length} rejected applicants on order ${orderId}`
      );

      // Process refunds in a transaction
      await this.prisma.$transaction(async (tx) => {
        for (const proposal of rejectedProposals) {
          // Check if this is a team application
          const isTeamApplication = proposal.teamId !== null && proposal.teamId !== undefined;
          
          // Get pricing configuration based on whether it's a team application
          const pricingConfig = await this.getPricingConfig(orderBudget, isTeamApplication);
          const refundAmount = Math.round(
            pricingConfig.creditCost * pricingConfig.refundPercentage
          );

          if (refundAmount <= 0) {
            this.logger.log(
              `No refund needed for proposal ${proposal.id} (refund amount: ${refundAmount})`
            );
            // Still update proposal status to rejected
            await tx.orderProposal.update({
              where: { id: proposal.id },
              data: { status: "rejected" },
            });
            continue;
          }

          // Only refund to lead applicant for team applications
          const refundUserId = isTeamApplication && proposal.leadUserId
            ? proposal.leadUserId
            : proposal.userId;

          // Refund credits to the user
          const updatedUser = await tx.user.update({
            where: { id: refundUserId },
            data: {
              creditBalance: { increment: refundAmount },
            },
            select: { creditBalance: true },
          });

          // Log credit transaction
          await this.creditTransactionsService.logTransaction({
            userId: refundUserId,
            amount: refundAmount,
            balanceAfter: updatedUser.creditBalance,
            type: "selection_refund",
            status: "completed",
            description: `Refund for not being selected for order #${orderId}`,
            referenceId: orderId.toString(),
            referenceType: "order",
            metadata: {
              orderId,
              proposalId: proposal.id,
              selectedProposalId,
              refundAmount,
              creditCost: pricingConfig.creditCost,
              refundPercentage: pricingConfig.refundPercentage,
              isTeamApplication,
              teamId: proposal.teamId,
            },
            tx,
          });

          // Update proposal status to rejected
          await tx.orderProposal.update({
            where: { id: proposal.id },
            data: { status: "rejected" },
          });

          // Create notification for rejected applicant (will be sent after transaction)
          // We'll send the push notification after the transaction completes

          this.logger.log(
            `Refunded ${refundAmount} credits to user ${refundUserId} for rejected proposal ${proposal.id} (${isTeamApplication ? 'team' : 'individual'})`
          );
        }
      });

      // Send push notifications for rejected applicants
      // Note: We need to recalculate refund amounts for notifications since they're per-proposal
      for (const proposal of rejectedProposals) {
        try {
          // Recalculate refund amount for this proposal (same logic as in transaction)
          const isTeamApplication = proposal.teamId !== null && proposal.teamId !== undefined;
          const pricingConfig = await this.getPricingConfig(orderBudget, isTeamApplication);
          const refundAmount = Math.round(
            pricingConfig.creditCost * pricingConfig.refundPercentage
          );

          // Only send notification to lead applicant for team applications
          const notificationUserId = isTeamApplication && proposal.leadUserId
            ? proposal.leadUserId
            : proposal.userId;

          await this.notificationsService.createNotificationWithPush(
            notificationUserId,
            "proposal_rejected",
            "notificationProposalRejectedTitle",
            "notificationProposalRejectedWithRefundMessage",
            {
              orderId: orderId,
              proposalId: proposal.id,
              refundAmount: refundAmount,
            },
            {
              refundAmount: refundAmount,
            }
          );
        } catch (error) {
          this.logger.error(
            `Failed to send notification to user ${proposal.userId}:`,
            error
          );
        }
      }

      this.logger.log(
        `Successfully processed refunds for ${rejectedProposals.length} rejected applicants`
      );
    } catch (error) {
      this.logger.error(
        `Error processing refunds for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Initialize default pricing configurations based on budget ranges
   */
  async initializeDefaultPricing(): Promise<void> {
    this.logger.log("Initializing default pricing configurations...");

    const defaultConfigs = [
      {
        minBudget: 0,
        maxBudget: 500,
        creditCost: 1,
        teamCreditCost: 1.5, // 50% more for teams
        refundPercentage: 0.5,
        teamRefundPercentage: 0.5,
        description: "Small orders ($0-$500)",
      },
      {
        minBudget: 500,
        maxBudget: 2000,
        creditCost: 5,
        teamCreditCost: 7.5, // 50% more for teams
        refundPercentage: 0.6,
        teamRefundPercentage: 0.6,
        description: "Medium orders ($500-$2000)",
      },
      {
        minBudget: 2000,
        maxBudget: 5000,
        creditCost: 10,
        teamCreditCost: 15, // 50% more for teams
        refundPercentage: 0.7,
        teamRefundPercentage: 0.7,
        description: "Large orders ($2000-$5000)",
      },
      {
        minBudget: 5000,
        maxBudget: undefined,
        creditCost: 20,
        teamCreditCost: 30, // 50% more for teams
        refundPercentage: 0.8,
        teamRefundPercentage: 0.8,
        description: "Premium orders ($5000+)",
      },
    ];

    for (const config of defaultConfigs) {
      try {
        await this.setPricing(config);
        this.logger.log(
          `Initialized pricing for budget range $${config.minBudget}-${config.maxBudget || "∞"}: ${config.creditCost} credits, ${config.refundPercentage * 100}% refund`
        );
      } catch (error) {
        this.logger.error(
          `Failed to initialize pricing for budget range $${config.minBudget}-${config.maxBudget || "∞"}:`,
          error
        );
      }
    }

    this.logger.log("Default pricing initialization completed");
  }
}
