import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreditService } from "../credit/credit.service";
import { CreditTransactionsService } from "../credit/credit-transactions.service";
import { ExchangeRateService } from "../exchange-rate/exchange-rate.service";
import { CreateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { UpdateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { PurchaseSubscriptionDto } from "./dto/user-subscription.dto";

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly BASE_CURRENCY = "USD"; // Credits are always stored in USD

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
    private creditTransactionsService: CreditTransactionsService,
    private exchangeRateService: ExchangeRateService
  ) {}

  /**
   * Transform subscription plan for language
   */
  private transformPlanForLanguage(plan: any, language: string = "en") {
    if (!plan) {
      return plan;
    }

    const languageMap = {
      en: {
        name: "nameEn",
        description: "descriptionEn",
      },
      ru: {
        name: "nameRu",
        description: "descriptionRu",
      },
      hy: {
        name: "nameHy",
        description: "descriptionHy",
      },
    };

    const langFields =
      languageMap[language as keyof typeof languageMap] || languageMap["en"];

    return {
      ...plan,
      name: plan[langFields.name] || plan.name || "",
      description: plan[langFields.description] || plan.description || null,
    };
  }

  /**
   * Get all active subscription plans
   */
  async getAllPlans(language: string = "en") {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });

    return plans.map((plan) => this.transformPlanForLanguage(plan, language));
  }

  /**
   * Get a specific subscription plan by ID
   */
  async getPlanById(planId: number, language: string = "en") {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(
        `Subscription plan with ID ${planId} not found`
      );
    }

    return this.transformPlanForLanguage(plan, language);
  }

  /**
   * Create a new subscription plan (admin only)
   */
  async createPlan(createPlanDto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: createPlanDto.name,
        nameEn: createPlanDto.nameEn,
        nameRu: createPlanDto.nameRu,
        nameHy: createPlanDto.nameHy,
        description: createPlanDto.description,
        descriptionEn: createPlanDto.descriptionEn,
        descriptionRu: createPlanDto.descriptionRu,
        descriptionHy: createPlanDto.descriptionHy,
        price: createPlanDto.price,
        currency: createPlanDto.currency || "AMD",
        durationDays: createPlanDto.durationDays,
        isRecurring: createPlanDto.isRecurring || false,
        features: createPlanDto.features || {},
        isActive:
          createPlanDto.isActive !== undefined ? createPlanDto.isActive : true,
      },
    });
  }

  /**
   * Update a subscription plan (admin only)
   */
  async updatePlan(planId: number, updatePlanDto: UpdateSubscriptionPlanDto) {
    const plan = await this.getPlanById(planId);

    return this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(updatePlanDto.name !== undefined && { name: updatePlanDto.name }),
        ...(updatePlanDto.nameEn !== undefined && {
          nameEn: updatePlanDto.nameEn,
        }),
        ...(updatePlanDto.nameRu !== undefined && {
          nameRu: updatePlanDto.nameRu,
        }),
        ...(updatePlanDto.nameHy !== undefined && {
          nameHy: updatePlanDto.nameHy,
        }),
        ...(updatePlanDto.description !== undefined && {
          description: updatePlanDto.description,
        }),
        ...(updatePlanDto.descriptionEn !== undefined && {
          descriptionEn: updatePlanDto.descriptionEn,
        }),
        ...(updatePlanDto.descriptionRu !== undefined && {
          descriptionRu: updatePlanDto.descriptionRu,
        }),
        ...(updatePlanDto.descriptionHy !== undefined && {
          descriptionHy: updatePlanDto.descriptionHy,
        }),
        ...(updatePlanDto.price !== undefined && {
          price: updatePlanDto.price,
        }),
        ...(updatePlanDto.currency !== undefined && {
          currency: updatePlanDto.currency,
        }),
        ...(updatePlanDto.durationDays !== undefined && {
          durationDays: updatePlanDto.durationDays,
        }),
        ...(updatePlanDto.isRecurring !== undefined && {
          isRecurring: updatePlanDto.isRecurring,
        }),
        ...(updatePlanDto.features !== undefined && {
          features: updatePlanDto.features,
        }),
        ...(updatePlanDto.isActive !== undefined && {
          isActive: updatePlanDto.isActive,
        }),
      },
    });
  }

  /**
   * Get user's active subscription
   */
  async getUserActiveSubscription(userId: number, language: string = "en") {
    const now = new Date();
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: "active",
        endDate: { gt: now },
      },
      include: {
        Plan: true,
      },
      orderBy: {
        endDate: "desc",
      },
    });

    if (!subscription) {
      return null;
    }

    return {
      ...subscription,
      Plan: subscription.Plan
        ? this.transformPlanForLanguage(subscription.Plan, language)
        : null,
    };
  }

  /**
   * Check if user has an active subscription
   */
  async isSubscriptionActive(userId: number): Promise<boolean> {
    const subscription = await this.getUserActiveSubscription(userId, "en");
    return subscription !== null;
  }

  /**
   * Get user's subscription history
   */
  async getUserSubscriptions(userId: number) {
    return this.prisma.userSubscription.findMany({
      where: { userId },
      include: {
        Plan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Initiate subscription purchase
   * Note: Manual renewal only - users must manually renew when subscription expires
   */
  async purchaseSubscription(
    userId: number,
    purchaseDto: PurchaseSubscriptionDto
  ) {
    try {
      // Get the plan (use raw plan data, not transformed for language)
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: purchaseDto.planId },
      });

      if (!plan) {
        throw new NotFoundException(
          `Subscription plan with ID ${purchaseDto.planId} not found`
        );
      }

      if (!plan.isActive) {
        throw new BadRequestException(
          "This subscription plan is not available"
        );
      }

      // Check if user already has an active subscription
      // Allow renewal if subscription is expiring soon (within 7 days) or expired
      // Use default language "en" for internal checks
      const activeSubscription = await this.getUserActiveSubscription(
        userId,
        "en"
      );
      if (activeSubscription) {
        const daysRemaining = Math.ceil(
          (new Date(activeSubscription.endDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        );

        // Allow purchase if subscription expires in 7 days or less, or if it's the same plan
        if (
          daysRemaining > 7 &&
          activeSubscription.planId !== purchaseDto.planId
        ) {
          throw new BadRequestException(
            "You already have an active subscription. Please cancel it first or wait for it to expire."
          );
        }
        // If same plan and expiring soon, allow renewal (will create new subscription)
      }

      // Get user's credit balance
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true, currency: true },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Convert subscription price to USD (base currency for credits)
      const planCurrency = plan.currency || "USD";
      let subscriptionPriceUSD = plan.price;
      let exchangeRate = 1;
      let originalAmount = plan.price;

      if (planCurrency.toUpperCase() !== this.BASE_CURRENCY) {
        try {
          exchangeRate = await this.exchangeRateService.getExchangeRate(
            planCurrency.toUpperCase(),
            this.BASE_CURRENCY
          );
          subscriptionPriceUSD = plan.price * exchangeRate;
          subscriptionPriceUSD = Math.round(subscriptionPriceUSD * 100) / 100; // Round to 2 decimals
          this.logger.log(
            `Currency conversion: ${plan.price} ${planCurrency} = ${subscriptionPriceUSD} ${this.BASE_CURRENCY} (rate: ${exchangeRate})`
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to convert subscription price: ${error.message}. Using price as-is.`
          );
          // If conversion fails, assume price is already in base currency
          exchangeRate = 1;
        }
      }

      // Check if user has enough credits
      if (user.creditBalance < subscriptionPriceUSD) {
        throw new BadRequestException({
          code: "INSUFFICIENT_CREDITS",
          message: "Insufficient credits to purchase this subscription",
          required: subscriptionPriceUSD,
          available: user.creditBalance,
        });
      }

      // Purchase subscription with credits
      return await this.purchaseWithCredits(
        userId,
        plan,
        subscriptionPriceUSD,
        originalAmount,
        planCurrency,
        exchangeRate
      );
    } catch (error) {
      this.logger.error(
        `Error in purchaseSubscription: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Purchase subscription using credits
   */
  private async purchaseWithCredits(
    userId: number,
    plan: any,
    priceUSD: number,
    originalAmount: number,
    originalCurrency: string,
    exchangeRate: number
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Deduct credits
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: priceUSD } },
        select: { creditBalance: true },
      });

      // Log credit transaction
      await this.creditTransactionsService.logTransaction({
        userId,
        amount: -priceUSD, // Negative amount for deduction
        balanceAfter: updatedUser.creditBalance,
        type: "subscription",
        status: "completed",
        description: `Subscription purchase: ${plan.nameEn || plan.nameRu || plan.nameHy || plan.name || "Plan"} - ${originalAmount} ${originalCurrency} = ${priceUSD} ${this.BASE_CURRENCY} credits`,
        referenceId: plan.id.toString(),
        referenceType: "subscription",
        currency: originalCurrency,
        baseCurrency: this.BASE_CURRENCY,
        exchangeRate,
        originalAmount,
        convertedAmount: priceUSD,
        metadata: {
          planId: plan.id,
          planName: plan.nameEn || plan.nameRu || plan.nameHy || plan.name,
          durationDays: plan.durationDays,
        },
        tx,
      });

      // Create subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.durationDays);

      const subscription = await tx.userSubscription.create({
        data: {
          userId,
          planId: plan.id,
          status: "active",
          startDate,
          endDate,
          autoRenew: false, // Always false - manual renewal only
          paymentId: null, // No payment gateway ID for credit purchases
        },
        include: {
          Plan: true,
        },
      });

      // Create subscription transaction
      const transaction = await tx.subscriptionTransaction.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          amount: originalAmount,
          currency: originalCurrency,
          paymentId: null, // No payment gateway ID for credit purchases
          status: "completed",
          type: "initial",
        },
      });

      this.logger.log(
        `Subscription purchased with credits: user ${userId}, plan ${plan.id}, subscription ${subscription.id}, credits deducted: ${priceUSD} ${this.BASE_CURRENCY}`
      );

      return {
        success: true,
        subscription,
        planId: plan.id,
        planName: plan.nameEn || plan.nameRu || plan.nameHy || plan.name || "",
        amount: originalAmount,
        currency: originalCurrency,
        creditsDeducted: priceUSD,
        creditsRemaining: updatedUser.creditBalance,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Handle subscription payment callback (kept for backward compatibility, but no longer used for new purchases)
   */
  async handleSubscriptionPaymentCallback(
    orderID: string,
    responseCode: string,
    paymentID: string,
    opaque?: string
  ) {
    try {
      // Extract userId and planId from orderID (format: userId-planId-timestamp-random)
      const parts = orderID.split("-");
      if (parts.length < 2) {
        throw new Error(`Invalid orderID format: ${orderID}`);
      }

      const userId = parseInt(parts[0], 10);
      const planId = parseInt(parts[1], 10);

      if (isNaN(userId) || isNaN(planId)) {
        throw new Error(`Invalid userId or planId in orderID: ${orderID}`);
      }

      // Get payment details
      const paymentDetails =
        await this.creditService.getPaymentDetails(paymentID);

      // Check payment status
      if (paymentDetails.PaymentState === "payment_approved") {
        // Payment approved - create subscription
        const plan = await this.getPlanById(planId);
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.durationDays);

        // Create subscription
        // Note: autoRenew is kept for backward compatibility but not used for automatic renewals
        // Users will need to manually renew when subscription expires
        const subscription = await this.prisma.userSubscription.create({
          data: {
            userId,
            planId,
            status: "active",
            startDate,
            endDate,
            autoRenew: false, // Always false - manual renewal only
            paymentId: paymentID,
          },
          include: {
            Plan: true,
          },
        });

        // Find transaction by paymentId and update it
        // First, try to find existing pending transaction
        const existingTransaction =
          await this.prisma.subscriptionTransaction.findFirst({
            where: {
              paymentId: paymentID,
              userId,
              status: "pending",
            },
          });

        if (existingTransaction) {
          // Update existing transaction
          await this.prisma.subscriptionTransaction.update({
            where: { id: existingTransaction.id },
            data: {
              subscriptionId: subscription.id,
              status: "completed",
            },
          });
        } else {
          // Create new transaction if not found
          await this.prisma.subscriptionTransaction.create({
            data: {
              userId,
              subscriptionId: subscription.id,
              amount: plan.price,
              currency: plan.currency,
              paymentId: paymentID,
              status: "completed",
              type: "initial",
            },
          });
        }

        this.logger.log(
          `Subscription created: user ${userId}, plan ${planId}, subscription ${subscription.id}`
        );

        return {
          message: "Subscription activated successfully",
          subscription,
          paymentDetails,
        };
      } else {
        // Payment failed
        await this.prisma.subscriptionTransaction.updateMany({
          where: {
            paymentId: paymentID,
            userId,
          },
          data: {
            status: "failed",
          },
        });

        throw new Error(
          `Payment failed: ${paymentDetails.Description || paymentDetails.TrxnDescription || "Unknown error"}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling subscription payment callback: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: number, subscriptionId: number) {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    if (subscription.status !== "active") {
      throw new BadRequestException(
        "Only active subscriptions can be cancelled"
      );
    }

    // Update subscription to cancelled and disable auto-renew
    return this.prisma.userSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: "cancelled",
        autoRenew: false,
      },
    });
  }

  /**
   * Renew subscription manually (purchase same plan again)
   * This extends the subscription or creates a new one if expired
   */
  async renewSubscription(userId: number, subscriptionId: number) {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
      include: {
        Plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    // Check if plan is still active
    if (!subscription.Plan.isActive) {
      throw new BadRequestException(
        "This subscription plan is no longer available"
      );
    }

    // If subscription is still active, user needs to wait for it to expire or cancel first
    const now = new Date();
    if (subscription.status === "active" && subscription.endDate > now) {
      throw new BadRequestException(
        "Your subscription is still active. Please wait for it to expire or cancel it first before renewing."
      );
    }

    // Purchase the same plan again
    return this.purchaseSubscription(userId, {
      planId: subscription.planId,
    });
  }

  /**
   * Get all subscriptions (admin only)
   */
  async getAllSubscriptions(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [subscriptions, total] = await Promise.all([
      this.prisma.userSubscription.findMany({
        skip,
        take: limit,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          Plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      this.prisma.userSubscription.count(),
    ]);

    return {
      subscriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
