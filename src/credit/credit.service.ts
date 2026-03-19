import {
  FastBankPaymentProvider,
  PaymentProvider,
} from "../payments/payment.provider";
import { Injectable, Logger } from "@nestjs/common";

import { CreditTransactionsService } from "./credit-transactions.service";
import { ExchangeRateService } from "../exchange-rate/exchange-rate.service";
import { PrismaService } from "../prisma.service";
import { log } from "console";

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);
  private readonly BASE_CURRENCY = "USD"; // Credits are always stored in USD
  private readonly paymentProvider: PaymentProvider;

  constructor(
    private prisma: PrismaService,
    private creditTransactionsService: CreditTransactionsService,
    private exchangeRateService: ExchangeRateService,
  ) {
    this.paymentProvider = new FastBankPaymentProvider();
  }

  async initiatePayment(
    userId: number,
    amount: number,
    currency: string = "USD",
    cardId?: string,
    saveCard: boolean = false,
    isFallback: boolean = false // Prevent infinite recursion
  ) {
    // If cardId is provided, use saved card payment (no webview)
    if (cardId && !isFallback) {
      const cards = await this.prisma.$queryRaw<
        Array<{
          id: number;
          binding_id: string | null;
          card_holder_id: string | null;
        }>
      >`
        SELECT id, "binding_id", "card_holder_id" 
        FROM "Card" 
        WHERE id = ${parseInt(cardId, 10)} 
          AND "userId" = ${userId} 
          AND "isActive" = true
        LIMIT 1
      `;

      const card = cards.length > 0 ? cards[0] : null;

      if (!card) {
        this.logger.error(`Card ${cardId} not found for user ${userId}`);
        throw new Error(
          "Card not found. Please use a different card or add a new one."
        );
      }

      if (!card.binding_id) {
        this.logger.error(`Card ${cardId} missing binding token`);
        throw new Error(
          "Card does not have a saved payment token. Please save the card during a payment first."
        );
      }

      this.logger.log(
        `Using saved card for payment: id=${card.id}, binding_token=${card.binding_id}`
      );

      return this.makeBindingPayment(
        userId,
        amount,
        currency,
        card.binding_id,
        card.card_holder_id || ""
      );
    }

    // Get user's currency preference
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const normalizedCurrency = (currency || user?.currency || "USD").toUpperCase();

    // Convert amount to base currency (USD) for credits
    let exchangeRate: number | null = null;
    let originalAmount = amount;
    let convertedAmount = amount;

    if (normalizedCurrency !== this.BASE_CURRENCY) {
      try {
        exchangeRate = await this.exchangeRateService.getExchangeRate(
          normalizedCurrency,
          this.BASE_CURRENCY
        );
        convertedAmount =
          Math.round(amount * exchangeRate * 100) / 100;
        this.logger.log(
          `Currency conversion: ${amount} ${normalizedCurrency} = ${convertedAmount} ${this.BASE_CURRENCY} (rate: ${exchangeRate})`
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to convert currency: ${error.message}. Using amount as-is.`
        );
        exchangeRate = 1;
      }
    } else {
      exchangeRate = 1;
    }

    // Generate unique order ID
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const orderId = `${userId}-${timestamp}-${randomSuffix}`;

    // Build separate return/fail callback URLs
    const port = process.env.PORT || "8080";
    const backendUrl = (process.env.BACKEND_URL || `http://localhost:${port}`).replace(/\/$/, '');
    const returnUrl = `${backendUrl}/credit/refill/callback/success?internalOrderId=${encodeURIComponent(orderId)}`;
    const failUrl = `${backendUrl}/credit/refill/callback/failure?internalOrderId=${encodeURIComponent(orderId)}`;

    this.logger.log(
      `Initiating Fast Bank payment: orderId=${orderId}, amount=${amount}, currency=${normalizedCurrency}, returnUrl=${returnUrl}, saveCard=${saveCard}`
    );

    const initResult = await this.paymentProvider.initCreditRefill({
      userId,
      amount,
      currency: normalizedCurrency,
      saveCard,
      orderId,
      returnUrl,
      failUrl,
    });

    console.log('initResultinitResultinitResultinitResultinitResult', initResult);
    

    // Store conversion metadata temporarily in SystemConfig for callback retrieval
    const configKey = `credit_refill_${orderId}`;
    try {
      await this.prisma.systemConfig.upsert({
        where: { key: configKey },
        update: {
          value: JSON.stringify({
            userId,
            currency: normalizedCurrency,
            originalAmount,
            convertedAmount,
            exchangeRate: exchangeRate ?? 1,
            baseCurrency: this.BASE_CURRENCY,
            saveCard,
          }),
        },
        create: {
          key: configKey,
          value: JSON.stringify({
            userId,
            currency: normalizedCurrency,
            originalAmount,
            convertedAmount,
            exchangeRate: exchangeRate ?? 1,
            baseCurrency: this.BASE_CURRENCY,
            saveCard,
          }),
          description: `Temporary storage for credit refill conversion metadata`,
        },
      });
    } catch (dbError: any) {
      this.logger.error(
        `Failed to store payment metadata: ${dbError.message}. Payment will still proceed but callback may have issues.`
      );
    }

    return {
      orderId,
      paymentUrl: initResult.paymentUrl,
      paymentHtml: null,
      paymentData: initResult.raw,
      conversionInfo: {
        currency: normalizedCurrency,
        originalAmount,
        convertedAmount,
        exchangeRate,
        baseCurrency: this.BASE_CURRENCY,
      },
      saveCard,
    };
  }

  async handlePaymentCallback(
    internalOrderId: string,  // our own ID used to look up conversion metadata
    bankOrderId: string,      // FastBank's mdOrder UUID used to query payment status
    responseCode?: string,
  ) {
    this.logger.log(
      `Payment callback received - internalOrderId: ${internalOrderId}, bankOrderId: ${bankOrderId}, responseCode: ${responseCode}`
    );

    if (!internalOrderId || !bankOrderId) {
      this.logger.error(
        `Payment callback missing required parameters - internalOrderId: ${internalOrderId}, bankOrderId: ${bankOrderId}`
      );
      throw new Error("Payment callback missing required parameters");
    }

    // Verify payment status with FastBank using their mdOrder UUID
    const paymentResult = await this.getPaymentDetails(bankOrderId);
    const paymentDetails = paymentResult.raw ?? {};  // raw FastBank response fields

    this.logger.log(`[handlePaymentCallback] status=${paymentResult.status} raw=${JSON.stringify(paymentDetails)}`);

    if (paymentResult.status !== "approved") {
      const errorMsg =
        paymentDetails.Description ||
        paymentDetails.TrxnDescription ||
        `Payment failed or is not approved. State: ${paymentDetails.PaymentState} (mapped: ${paymentResult.status})`;
      throw new Error(errorMsg);
    }

    // Retrieve conversion metadata stored during payment initiation
    const configKey = `credit_refill_${internalOrderId}`;
    let conversionMetadata: {
      userId?: number;
      currency: string;
      originalAmount: number;
      convertedAmount: number;
      exchangeRate: number;
      baseCurrency: string;
      saveCard?: boolean;
    } | null = null;

    try {
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: configKey },
      });
      if (config) {
        conversionMetadata = JSON.parse(config.value);
        await this.prisma.systemConfig.delete({ where: { key: configKey } });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to retrieve conversion metadata for ${internalOrderId}: ${error}`
      );
    }

    // Resolve userId from our internalOrderId format: userId-timestamp-random
    let userId: number;
    if (conversionMetadata?.userId != null) {
      userId = conversionMetadata.userId;
    } else if (internalOrderId.includes("-")) {
      userId = parseInt(internalOrderId.split("-")[0]);
    } else {
      throw new Error(`Cannot determine userId from internalOrderId: ${internalOrderId}`);
    }

    if (isNaN(userId)) {
      throw new Error(`Invalid userId extracted from internalOrderId: ${internalOrderId}`);
    }

    // Verify user exists
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Determine amount to add to credits
    // If we have conversion metadata, use converted amount (in base currency)
    // Otherwise, use payment amount (assume it's already in base currency)
    const creditAmount = conversionMetadata
      ? conversionMetadata.convertedAmount
      : paymentDetails.DepositedAmount || paymentDetails.Amount;

    // Get payment amount in user's currency (for logging)
    const paymentAmount =
      paymentDetails.DepositedAmount || paymentDetails.Amount;

    if (!creditAmount || creditAmount <= 0) {
      this.logger.error(
        `Invalid credit amount: ${creditAmount}. PaymentDetails: ${JSON.stringify(paymentDetails)}`
      );
      throw new Error(
        `Invalid credit amount: ${creditAmount}. Payment may not have been completed.`
      );
    }

    // Update user credits and log transaction
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: creditAmount } },
      select: { creditBalance: true },
    });

    // Log credit transaction with currency metadata
    await this.creditTransactionsService.logTransaction({
      userId,
      amount: creditAmount, // Amount in base currency (USD)
      balanceAfter: updatedUser.creditBalance,
      type: "refill",
      status: "completed",
      description: conversionMetadata
        ? `Credit refill: ${conversionMetadata.originalAmount} ${conversionMetadata.currency} = ${creditAmount} ${this.BASE_CURRENCY}`
        : `Credit refill of ${creditAmount} ${this.BASE_CURRENCY}`,
      referenceId: bankOrderId,
      referenceType: "payment",
      currency: conversionMetadata?.currency || this.BASE_CURRENCY,
      baseCurrency: this.BASE_CURRENCY,
      exchangeRate: conversionMetadata?.exchangeRate || 1,
      originalAmount: conversionMetadata?.originalAmount || creditAmount,
      convertedAmount: creditAmount,
      metadata: {
        internalOrderId,
        bankOrderId,
        responseCode,
        paymentState: paymentDetails.PaymentState,
        mappedStatus: paymentResult.status,
        paymentAmount,
        conversionMetadata,
      },
    });

    // Extract and save BindingID if present (for card binding)
    // Check if saveCard was requested and fetch binding info if needed
    const saveCard = conversionMetadata?.saveCard === true;
    this.logger.log(
      `Checking for binding info. saveCard flag: ${saveCard}, bankOrderId: ${bankOrderId}, internalOrderId: ${internalOrderId}`
    );
    this.logger.log(
      `PaymentDetails keys: ${Object.keys(paymentDetails).join(", ")}`
    );
    this.logger.log(
      `PaymentDetails BindingID: ${paymentDetails.BindingID}, CardHolderID: ${paymentDetails.CardHolderID}`
    );

    let bindingId: string | null = null;
    let cardHolderId: string | null = null;
    let cardNumber = "";
    let expDate = "";

    // Try to infer binding information from payment details when saveCard was requested
    if (saveCard) {
      bindingId =
        paymentDetails.bindingId ||
        paymentDetails.BindingID ||
        paymentDetails.cardToken ||
        paymentDetails.card_token ||
        null;

      cardHolderId =
        paymentDetails.cardHolderId ||
        paymentDetails.CardHolderID ||
        null;

      cardNumber =
        paymentDetails.cardNumber ||
        paymentDetails.CardNumber ||
        "";

      expDate =
        paymentDetails.expiryDate ||
        paymentDetails.expirationDate ||
        paymentDetails.ExpDate ||
        "";

      if (bindingId && cardHolderId) {
        this.logger.log(
          `✅ Binding info found in payment details: BindingID=${bindingId}, CardHolderID=${cardHolderId}`
        );
      } else {
        this.logger.warn(
          `saveCard was true but no binding info could be inferred from payment details.`
        );
      }
    }

    // Save binding info if we have it
    if (bindingId && cardHolderId) {
      this.logger.log(
        `Attempting to save binding: bindingId=${bindingId}, cardHolderId=${cardHolderId}, userId=${userId}`
      );
      try {
        const last4 = cardNumber.length >= 4 ? cardNumber.slice(-4) : null;
        this.logger.log(`Card details: last4=${last4}, cardNumber length=${cardNumber.length}`);
        
        // Try to find existing card without bindingId for this user
        // Use Prisma findMany first, then check binding_id with raw query
        const allCards = await this.prisma.card.findMany({
          where: {
            userId,
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
        });
        
        this.logger.log(`Found ${allCards.length} active cards for user ${userId}`);
        
        // Filter cards without bindingId using raw query to check binding_id
        let cardToUpdate: typeof allCards[0] | null = null;
        for (const c of allCards) {
          try {
            const checkBinding = await this.prisma.$queryRaw<Array<{ binding_id: string | null }>>`
              SELECT "binding_id" FROM "Card" WHERE id = ${c.id}
            `;
            this.logger.log(`Card ${c.id} binding_id check: ${JSON.stringify(checkBinding)}`);
            if (checkBinding.length > 0 && !checkBinding[0].binding_id) {
              cardToUpdate = c;
              this.logger.log(`Found card ${c.id} without binding_id, will update it`);
              break;
            }
          } catch (error: any) {
            // If raw query fails (table/column doesn't exist), skip this card
            this.logger.warn(`Could not check binding_id for card ${c.id}: ${error.message || error}`);
            continue;
          }
        }
        
        const card = cardToUpdate;

        if (card) {
          // Update existing card with binding info using raw SQL to avoid TypeScript issues
          this.logger.log(
            `Updating card ${card.id} with bindingId=${bindingId}, cardHolderId=${cardHolderId}`
          );
          try {
            if (last4 && last4 !== card.last4) {
              const result = await this.prisma.$executeRaw`
                UPDATE "Card" 
                SET "binding_id" = ${bindingId}, 
                    "card_holder_id" = ${cardHolderId},
                    "last4" = ${last4}
                WHERE id = ${card.id}
              `;
              this.logger.log(`UPDATE result (with last4): ${JSON.stringify(result)}`);
            } else {
              const result = await this.prisma.$executeRaw`
                UPDATE "Card" 
                SET "binding_id" = ${bindingId}, 
                    "card_holder_id" = ${cardHolderId}
                WHERE id = ${card.id}
              `;
              this.logger.log(`UPDATE result: ${JSON.stringify(result)}`);
            }
            
            // Verify the update worked
            const verifyUpdate = await this.prisma.$queryRaw<Array<{ binding_id: string | null; card_holder_id: string | null }>>`
              SELECT "binding_id", "card_holder_id" FROM "Card" WHERE id = ${card.id}
            `;
            this.logger.log(`Verification after UPDATE: ${JSON.stringify(verifyUpdate)}`);
            
            this.logger.log(
              `✅ Successfully updated card ${card.id} with BindingID ${bindingId} for user ${userId}`
            );
          } catch (updateError: any) {
            this.logger.error(
              `❌ Failed to UPDATE card ${card.id}: ${updateError.message || updateError}. Stack: ${updateError.stack}`
            );
            throw updateError;
          }
        } else if (last4) {
          // Create new card record with binding info
          // Determine brand from card number
          let brand = "unknown";
          if (cardNumber.startsWith("4")) brand = "visa";
          else if (cardNumber.match(/^5[1-5]/) || cardNumber.match(/^2[2-7]/))
            brand = "mastercard";
          else if (cardNumber.match(/^3[47]/)) brand = "amex";
          else if (cardNumber.match(/^6(?:011|5)/)) brand = "discover";

          // Parse expiry date (format: MMYY or MM/YY)
          let expMonth: number | null = null;
          let expYear: number | null = null;
          if (expDate) {
            const cleanExp = expDate.replace(/\//g, "");
            if (cleanExp.length >= 4) {
              expMonth = parseInt(cleanExp.slice(0, 2), 10);
              const yearPart = cleanExp.slice(2, 4);
              const currentYear = new Date().getFullYear();
              const currentCentury = Math.floor(currentYear / 100) * 100;
              expYear = parseInt(yearPart, 10) + currentCentury;
              if (expYear < currentYear) expYear += 100; // Handle Y2K
            }
          }

          // Check if user has any cards
          const existingCount = await this.prisma.card.count({
            where: { userId, isActive: true },
          });
          const isDefault = existingCount === 0;

            // Create new card record with binding info using raw SQL
            const paymentMethodId = `pm_fastbank_${userId}_${Date.now()}`;
            const finalExpMonth = expMonth || 12;
            const finalExpYear = expYear || new Date().getFullYear() + 1;
            
            this.logger.log(
              `Creating new card with bindingId=${bindingId}, cardHolderId=${cardHolderId}, last4=${last4}`
            );
            
            try {
              const createdCard = await this.prisma.$queryRaw<Array<{
                id: number;
                userId: number;
                paymentMethodId: string;
                brand: string;
                last4: string;
                expMonth: number;
                expYear: number;
                holderName: string | null;
                isDefault: boolean;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                binding_id: string | null;
                card_holder_id: string | null;
              }>>`
                INSERT INTO "Card" (
                  "userId", "paymentMethodId", "brand", "last4", 
                  "expMonth", "expYear", "binding_id", "card_holder_id", 
                  "isDefault", "isActive", "createdAt", "updatedAt"
                )
                VALUES (
                  ${userId}, 
                  ${paymentMethodId}, 
                  ${brand}, 
                  ${last4}, 
                  ${finalExpMonth}, 
                  ${finalExpYear}, 
                  ${bindingId}, 
                  ${cardHolderId}, 
                  ${isDefault}, 
                  true, 
                  NOW(), 
                  NOW()
                )
                RETURNING *
              `;
              
              this.logger.log(`INSERT result: ${JSON.stringify(createdCard)}`);
              
              const newCard = createdCard.length > 0 ? createdCard[0] : null;
              if (newCard) {
                this.logger.log(
                  `✅ Successfully created new card ${newCard.id} with BindingID ${bindingId} for user ${userId}. binding_id=${newCard.binding_id}, card_holder_id=${newCard.card_holder_id}`
                );
              } else {
                this.logger.error(`❌ INSERT returned no rows`);
              }
            } catch (insertError: any) {
              this.logger.error(
                `❌ Failed to INSERT new card: ${insertError.message || insertError}. Stack: ${insertError.stack}`
              );
              throw insertError;
            }
        } else {
          // Even without card details, try to create a minimal card record with just binding info
          // This allows the binding to be saved for future use
          this.logger.warn(
            `BindingID ${bindingId} received but no card details (last4) available. Attempting to create minimal card record...`
          );
          
          try {
            const existingCount = await this.prisma.card.count({
              where: { userId, isActive: true },
            });
            const isDefault = existingCount === 0;

            // Create minimal card record with binding info using raw SQL
            const paymentMethodId = `pm_fastbank_${userId}_${Date.now()}`;
            const expYearValue = new Date().getFullYear() + 1;
            
            this.logger.log(
              `Creating minimal card with bindingId=${bindingId}, cardHolderId=${cardHolderId}`
            );
            
            try {
              const createdCard = await this.prisma.$queryRaw<Array<{
                id: number;
                userId: number;
                paymentMethodId: string;
                brand: string;
                last4: string;
                expMonth: number;
                expYear: number;
                holderName: string | null;
                isDefault: boolean;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                binding_id: string | null;
                card_holder_id: string | null;
              }>>`
                INSERT INTO "Card" (
                  "userId", "paymentMethodId", "brand", "last4", 
                  "expMonth", "expYear", "binding_id", "card_holder_id", 
                  "isDefault", "isActive", "createdAt", "updatedAt"
                )
                VALUES (
                  ${userId}, 
                  ${paymentMethodId}, 
                  'unknown', 
                  '****', 
                  12, 
                  ${expYearValue}, 
                  ${bindingId}, 
                  ${cardHolderId}, 
                  ${isDefault}, 
                  true, 
                  NOW(), 
                  NOW()
                )
                RETURNING *
              `;
              
              this.logger.log(`Minimal card INSERT result: ${JSON.stringify(createdCard)}`);
              
              const newCard = createdCard.length > 0 ? createdCard[0] : null;
              if (newCard) {
                this.logger.log(
                  `✅ Successfully created minimal card ${newCard.id} with BindingID ${bindingId}. binding_id=${newCard.binding_id}, card_holder_id=${newCard.card_holder_id}`
                );
              } else {
                this.logger.error(`❌ Minimal card INSERT returned no rows`);
              }
            } catch (insertError: any) {
              this.logger.error(
                `❌ Failed to INSERT minimal card: ${insertError.message || insertError}. Stack: ${insertError.stack}`
              );
            }
          } catch (createError: any) {
            this.logger.error(
              `Failed to create minimal card record: ${createError.message}`
            );
          }
        }
      } catch (error: any) {
        // Don't fail the payment if binding save fails
        this.logger.error(
          `❌ Failed to save binding: ${error.message || error}. Stack: ${error.stack}. Payment still succeeded.`
        );
        this.logger.error(
          `Binding save error details: bindingId=${bindingId}, cardHolderId=${cardHolderId}, userId=${userId}`
        );
      }
    } else if (saveCard) {
      this.logger.warn(
        `⚠️ saveCard was true but no binding info was retrieved. bankOrderId: ${bankOrderId}, internalOrderId: ${internalOrderId}, bindingId=${bindingId}, cardHolderId=${cardHolderId}`
      );
    } else {
      this.logger.log(
        `ℹ️ Not saving binding: saveCard=${saveCard}, bindingId=${bindingId}, cardHolderId=${cardHolderId}`
      );
    }

    this.logger.log(`Credits added: user ${userId}, amount ${creditAmount} ${this.BASE_CURRENCY}`);
    return {
      message: "Credits added successfully",
      paymentDetails,
    };
  }

  async getPaymentDetails(paymentID: string) {
    this.logger.log(`Getting payment details for PaymentID: ${paymentID}`);

    const result = await this.paymentProvider.getPaymentDetails(paymentID);

    this.logger.log(`9999999999999: ${result}`);
    const raw = result.raw || {};

    const paymentState =
      result.status === "approved"
        ? "payment_approved"
        : result.status === "declined"
        ? "payment_declined"
        : result.status === "pending"
        ? "payment_pending"
        : "payment_error";

    return {
      ...raw,
      PaymentState: raw.PaymentState || paymentState,
      Amount: raw.Amount ?? result.amount,
      DepositedAmount: raw.DepositedAmount ?? result.amount,
      Currency: raw.Currency ?? result.currency,
    };
  }

  /**
   * Make payment using saved card binding
   * Processes payment directly without webview
   */
  async makeBindingPayment(
    userId: number,
    amount: number,
    currency: string,
    bindingId: string, // Stored for reference/logging only, not sent in API request
    cardHolderId: string // Used by API to identify the binding
  ) {
    // Get user's currency preference
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const normalizedCurrency = (currency || user?.currency || "USD").toUpperCase();

    // Convert amount to base currency (USD) for credits
    let exchangeRate: number | null = null;
    let originalAmount = amount;
    let convertedAmount = amount;

    if (normalizedCurrency !== this.BASE_CURRENCY) {
      try {
        exchangeRate = await this.exchangeRateService.getExchangeRate(
          normalizedCurrency,
          this.BASE_CURRENCY
        );
        convertedAmount =
          Math.round(amount * exchangeRate * 100) / 100;
      } catch (error: any) {
        this.logger.error(
          `Failed to convert currency: ${error.message}. Using amount as-is.`
        );
        exchangeRate = 1;
      }
    } else {
      exchangeRate = 1;
    }

    // Build callback URL (for completeness, though binding payments are usually server-side)
    const port = process.env.PORT || "8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
    const backUrl = `${backendUrl}credit/refill/callback`;

    this.logger.log(
      `Making binding payment via Fast Bank: userId=${userId}, amount=${amount}, currency=${normalizedCurrency}, bindingToken=${bindingId}, backUrl=${backUrl}`
    );

    const providerResult = await this.paymentProvider.makeBindingPayment({
      userId,
      amount,
      currency: normalizedCurrency,
      bindingToken: bindingId,
    });

    if (!providerResult.success) {
      throw new Error(providerResult.message || "Payment failed");
    }

    const creditAmount = exchangeRate
      ? convertedAmount
      : providerResult.amountCharged;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: creditAmount } },
      select: { creditBalance: true },
    });

    await this.creditTransactionsService.logTransaction({
      userId,
      amount: creditAmount,
      balanceAfter: updatedUser.creditBalance,
      type: "refill",
      status: "completed",
      description: exchangeRate
        ? `Credit refill: ${originalAmount} ${normalizedCurrency} = ${creditAmount} ${this.BASE_CURRENCY} (saved card)`
        : `Credit refill of ${creditAmount} ${this.BASE_CURRENCY} (saved card)`,
      referenceId: providerResult.providerPaymentId || undefined,
      referenceType: "payment",
      currency: normalizedCurrency,
      baseCurrency: this.BASE_CURRENCY,
      exchangeRate: exchangeRate || 1,
      originalAmount,
      convertedAmount: creditAmount,
      metadata: {
        bindingID: bindingId,
        paymentAmount: amount,
        providerResponse: providerResult.raw,
        callbackUrl: backUrl,
        cardHolderId,
      },
    });

    this.logger.log(
      `Binding payment successful: user ${userId}, amount ${creditAmount} ${this.BASE_CURRENCY}`
    );

    return {
      success: true,
      message: providerResult.message || "Payment successful",
      orderId: undefined,
      paymentId: providerResult.providerPaymentId,
      amount: creditAmount,
      conversionInfo: exchangeRate
        ? {
            currency: normalizedCurrency,
            originalAmount,
            convertedAmount: creditAmount,
            exchangeRate,
            baseCurrency: this.BASE_CURRENCY,
          }
        : null,
    };
  }

  /**
   * Cancel a payment using Fast Bank
   */
  async cancelPayment(paymentID: string, orderID: string) {
    const result = await this.paymentProvider.cancelPayment(paymentID, orderID);

    if (!result.success) {
      throw new Error(result.message || "Payment cancel failed");
    }

    return {
      success: true,
      message: result.message || "Payment canceled successfully",
      response: result.raw,
    };
  }

  /**
   * Refund a payment using Fast Bank
   * Supports both full refund (omit amount) and partial refund (provide amount)
   */
  async refundPayment(paymentID: string, orderID: string, amount?: number) {
    let refundAmount: number | undefined = amount;

    if (refundAmount !== undefined && refundAmount !== null) {
      if (refundAmount <= 0) {
        throw new Error("Refund amount must be greater than 0");
      }
    } else {
      const paymentDetails = await this.getPaymentDetails(paymentID);
      refundAmount =
        paymentDetails.DepositedAmount || paymentDetails.Amount;
      if (!refundAmount || refundAmount <= 0) {
        throw new Error(
          "Could not determine original payment amount for full refund"
        );
      }
    }

    const result = await this.paymentProvider.refundPayment(
      paymentID,
      orderID,
      refundAmount
    );

    if (!result.success) {
      throw new Error(result.message || "Payment refund failed");
    }

    return {
      success: true,
      message:
        refundAmount !== undefined
          ? `Payment refunded successfully (amount: ${refundAmount})`
          : "Payment refunded successfully",
      response: result.raw,
    };
  }

  // Legacy webhook handler (kept for backward compatibility)
  async handleWebhook(orderId: string, paidAmount: number) {
    const userId = parseInt(orderId.split("-")[0]);

    await this.prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: paidAmount } },
    });

    this.logger.log(
      `Credits added via webhook: user ${userId}, amount ${paidAmount}`
    );
    return { message: "Credits added successfully" };
  }
}
