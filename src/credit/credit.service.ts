import { Injectable, Logger } from "@nestjs/common";

import { CreditTransactionsService } from "./credit-transactions.service";
import { ExchangeRateService } from "../exchange-rate/exchange-rate.service";
import { PrismaService } from "../prisma.service";
import axios from "axios";

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);
  private readonly BASE_CURRENCY = "USD"; // Credits are always stored in USD

  constructor(
    private prisma: PrismaService,
    private creditTransactionsService: CreditTransactionsService,
    private exchangeRateService: ExchangeRateService,
  ) {}

  private readonly vposUrl = process.env.AMERIABANK_VPOS_URL!;
  private readonly vposStatusUrl = process.env.AMERIABANK_VPOS_STATUS_URL!;

  private readonly credentials = {
    clientId: process.env.AMERIABANK_CLIENT_ID,
    username: process.env.AMERIABANK_USERNAME,
    password: process.env.AMERIABANK_PASSWORD,
  };

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
      // Get card with binding info using raw SQL to access bindingId and cardHolderId
      const cards = await this.prisma.$queryRaw<Array<{
        id: number;
        binding_id: string | null;
        card_holder_id: string | null;
      }>>`
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

      this.logger.log(
        `Card found: id=${card.id}, binding_id=${card.binding_id}, card_holder_id=${card.card_holder_id}`
      );

      if (!card.binding_id) {
        this.logger.error(`Card ${cardId} missing binding_id`);
        throw new Error(
          "Card does not have a binding ID. Please save the card during a payment first."
        );
      }

      if (!card.card_holder_id || card.card_holder_id.trim().length === 0) {
        this.logger.error(
          `Card ${cardId} has bindingId (${card.binding_id}) but missing cardHolderId`
        );
        throw new Error(
          "Card is missing required payment information. Please save the card again during a payment."
        );
      }

      // Use MakeBindingPayment for saved card payment (direct payment without redirect)
      // Note: MakeBindingPayment API uses CardHolderID to identify the binding
      // BindingID is stored in DB for reference but is NOT sent in the API request
      const isTestMode = this.vposUrl.includes("servicestest");
      
      try {
        return await this.makeBindingPayment(
          userId,
          amount,
          currency,
          card.binding_id, // Stored for reference/logging only
          card.card_holder_id // Used by API to identify the binding
        );
      } catch (error: any) {
        this.logger.error(
          `MakeBindingPayment failed: ${error.message}. Status: ${error.response?.status}`
        );
        
        // Provide clear error message for test environment limitations
        if (error.response?.status === 500 && isTestMode) {
          throw new Error(
            "The AmeriaBank test environment does not support MakeBindingPayment API. " +
            "Please use 'New Card' option for testing, or use production credentials for saved card payments."
          );
        }
        
        throw error;
      }
    }
    // Validate credentials and required environment variables
    if (
      !this.credentials.clientId ||
      !this.credentials.username ||
      !this.credentials.password
    ) {
      this.logger.error("AmeriaBank credentials not configured");
      throw new Error(
        "Payment gateway credentials not configured. Please contact support."
      );
    }

    if (!this.vposUrl || !this.vposStatusUrl) {
      this.logger.error("AmeriaBank vPOS URLs not configured");
      throw new Error(
        "Payment gateway URLs not configured. Please contact support."
      );
    }

    const isTestMode = this.vposUrl.includes("servicestest");

    let orderIdInt: number;
    let orderId: string;
    if (isTestMode) {
      // Ameriabank test requires OrderID in 30164001–30165000, amount 10 AMD
      orderIdInt =
        30164001 + Math.floor(Math.random() * (30165000 - 30164001 + 1));
      orderId = String(orderIdInt);
      
      // Validate OrderID is in correct range
      if (orderIdInt < 30164001 || orderIdInt > 30165000) {
        this.logger.error(
          `Generated OrderID ${orderIdInt} is outside test range 30164001-30165000`
        );
        throw new Error("OrderID generation failed: outside test range");
      }
      
      this.logger.log(`Test mode: Generated OrderID ${orderIdInt} in range 30164001-30165000`);
    } else {
      const timestamp = Date.now();
      const timestampSuffix = timestamp.toString().slice(-10);
      const randomSuffix = Math.floor(Math.random() * 100);
      const userIdStr = userId.toString().padStart(5, "0").slice(-5);
      const randomStr = randomSuffix.toString().padStart(1, "0").slice(-1);
      orderIdInt = parseInt(
        `${timestampSuffix}${userIdStr}${randomStr}`,
        10
      );
      orderId = `${userId}-${timestamp}-${randomSuffix}`;
      if (orderIdInt > Number.MAX_SAFE_INTEGER) {
        throw new Error("OrderID generation failed: number too large");
      }
    }

    // Get user's currency preference
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const userCurrency = (user?.currency || currency || "USD").toUpperCase();
    const normalizedCurrency = currency.toUpperCase();

    // Convert amount to base currency (USD) for credits
    let amountInBaseCurrency = amount;
    let exchangeRate: number | null = null;
    let originalAmount = amount;
    let convertedAmount = amount;
    const paymentAmount = isTestMode ? 10 : amount;

    if (!isTestMode && normalizedCurrency !== this.BASE_CURRENCY) {
      try {
        exchangeRate = await this.exchangeRateService.getExchangeRate(
          normalizedCurrency,
          this.BASE_CURRENCY
        );
        amountInBaseCurrency = amount * exchangeRate;
        convertedAmount = Math.round(amountInBaseCurrency * 100) / 100; // Round to 2 decimals
        this.logger.log(
          `Currency conversion: ${amount} ${normalizedCurrency} = ${convertedAmount} ${this.BASE_CURRENCY} (rate: ${exchangeRate})`
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to convert currency: ${error.message}. Using amount as-is.`
        );
        // If conversion fails, use amount as-is (assume it's already in base currency)
        exchangeRate = 1;
      }
    } else {
      if (isTestMode) {
        try {
          exchangeRate = await this.exchangeRateService.getExchangeRate(
            "AMD",
            this.BASE_CURRENCY
          );
          originalAmount = 10;
          convertedAmount = Math.round(10 * exchangeRate * 100) / 100;
        } catch (error: any) {
          this.logger.warn(
            `Failed to get exchange rate for AMD->USD in test mode: ${error.message}. Using default rate 1.`
          );
          exchangeRate = 1;
          originalAmount = 10;
          convertedAmount = 10;
        }
      } else {
        exchangeRate = 1;
      }
    }

    // Build callback URL
    const port = process.env.PORT || "8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
    const backUrl = `${backendUrl}/credit/refill/callback`;

    // Build payment request payload (test: amount 10 AMD, OrderID in 30164001–30165000)
    // Ensure Amount is a number (not string) and OrderID is integer
    // Note: AmeriaBank automatically creates binding when payment succeeds, no special flag needed
    const payload: any = {
      ClientID: this.credentials.clientId,
      Username: this.credentials.username,
      Password: this.credentials.password,
      Amount: Number(paymentAmount), // Ensure it's a number
      OrderID: Number(orderIdInt), // Ensure it's an integer
      Description: `Credit refill - ${paymentAmount} ${isTestMode ? "AMD" : normalizedCurrency}`,
      BackURL: backUrl,
    };

    // Add CardHolderID if saveCard is true (helps with binding)
    // CardHolderID is typically the user identifier - using userId as string
    if (saveCard) {
      payload.CardHolderID = userId.toString();
      this.logger.log(
        `saveCard is true - adding CardHolderID=${payload.CardHolderID} to InitPayment request`
      );
    } else {
      this.logger.log(
        `saveCard is false - CardHolderID will not be sent (binding will not be created)`
      );
    }
    
    // Validate payload before sending
    if (isNaN(payload.Amount) || payload.Amount <= 0) {
      throw new Error(`Invalid payment amount: ${paymentAmount}`);
    }
    if (isNaN(payload.OrderID) || payload.OrderID <= 0) {
      throw new Error(`Invalid OrderID: ${orderIdInt}`);
    }
    if (isTestMode && (payload.OrderID < 30164001 || payload.OrderID > 30165000)) {
      throw new Error(`OrderID ${payload.OrderID} is outside test range 30164001-30165000`);
    }

    this.logger.log(
      `Initiating payment: OrderID=${orderIdInt}, Amount=${paymentAmount}, URL=${this.vposUrl}, BackURL=${backUrl}, saveCard=${saveCard}, CardHolderID=${payload.CardHolderID || "not set"}`
    );
    this.logger.log(
      `InitPayment payload: ${JSON.stringify({ ...payload, Password: "***" })}`
    );

    // Initiate payment
    let response;
    try {
      response = await axios.post(this.vposUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      });
    } catch (error: any) {
      this.logger.error(
        `Axios error calling Ameriabank InitPayment: ${error.message}. URL: ${this.vposUrl}. Response: ${JSON.stringify(error.response?.data)}`
      );
      throw new Error(
        `Failed to initiate payment: ${error.message || "Network error"}`
      );
    }

    const responseData = response.data;
    this.logger.log(
      `Ameriabank InitPayment response: ${JSON.stringify(responseData)}`
    );

    // Check for errors
    if (responseData?.ResponseCode && responseData.ResponseCode !== 1) {
      const errorMessage =
        responseData.ResponseMessage ||
        `Payment gateway error: ${responseData.ResponseCode}`;
      this.logger.error(
        `Payment initiation failed. ResponseCode: ${responseData.ResponseCode}, ResponseMessage: ${errorMessage}, Full response: ${JSON.stringify(responseData)}`
      );
      throw new Error(errorMessage);
    }

    // Extract PaymentID and construct payment URL
    if (responseData?.ResponseCode === 1 && responseData?.PaymentID) {
      const baseDomain = this.vposUrl.includes("servicestest")
        ? "https://servicestest.ameriabank.am"
        : "https://services.ameriabank.am";
      const paymentUrl = `${baseDomain}/VPOS/Payments/Pay?id=${responseData.PaymentID}&lang=en`;

      // Store conversion metadata temporarily in SystemConfig for callback retrieval
      // We'll use a key format: credit_refill_{orderId}
      try {
        await this.prisma.systemConfig.upsert({
          where: { key: `credit_refill_${orderId}` },
          update: {
            value: JSON.stringify({
              userId,
              currency: isTestMode ? "AMD" : normalizedCurrency,
              originalAmount,
              convertedAmount,
              exchangeRate: exchangeRate ?? 1,
              baseCurrency: this.BASE_CURRENCY,
              saveCard, // Store saveCard flag for callback
            }),
          },
          create: {
            key: `credit_refill_${orderId}`,
            value: JSON.stringify({
              userId,
              currency: isTestMode ? "AMD" : normalizedCurrency,
              originalAmount,
              convertedAmount,
              exchangeRate: exchangeRate ?? 1,
              baseCurrency: this.BASE_CURRENCY,
              saveCard, // Store saveCard flag for callback
            }),
            description: `Temporary storage for credit refill conversion metadata`,
          },
        });
      } catch (dbError: any) {
        this.logger.error(
          `Failed to store payment metadata: ${dbError.message}. Payment will still proceed but callback may have issues.`
        );
        // Don't throw - payment was successful, metadata storage is secondary
      }

    return {
      orderId,
      paymentUrl,
      paymentHtml: null,
      paymentData: response.data,
      conversionInfo: {
        currency: normalizedCurrency,
        originalAmount,
        convertedAmount,
        exchangeRate,
        baseCurrency: this.BASE_CURRENCY,
      },
      saveCard, // Return saveCard flag for client
    };
    }

    // Fallback error
    this.logger.error(
      `Payment initiated but PaymentID not found. ResponseCode: ${responseData?.ResponseCode}`
    );
    throw new Error(
      "Payment initiated but payment URL could not be generated. Please contact support."
    );
  }

  async handlePaymentCallback(
    orderID: string,
    responseCode: string,
    paymentID: string,
    opaque?: string
  ) {
    this.logger.log(
      `Payment callback received - OrderID: ${orderID}, PaymentID: ${paymentID}, ResponseCode: ${responseCode}`
    );

    // Validate required parameters
    if (!orderID || !paymentID) {
      this.logger.error(
        `Payment callback missing required parameters - OrderID: ${orderID}, PaymentID: ${paymentID}`
      );
      throw new Error("Payment callback missing required parameters");
    }

    // Handle responseCode "01" (duplicate order) - still verify via GetPaymentDetails
    if (responseCode && responseCode !== "00" && responseCode !== "01") {
      throw new Error(`Payment failed with code: ${responseCode}`);
    }

    // Get payment details to finalize transaction
    const paymentDetails = await this.getPaymentDetails(paymentID);

    // Check payment status
    if (paymentDetails.PaymentState === "payment_approved") {
      // Payment approved - proceed
    } else if (
      paymentDetails.PaymentState === "payment_declined" ||
      paymentDetails.OrderStatus === "6"
    ) {
      const errorMsg =
        paymentDetails.Description ||
        paymentDetails.TrxnDescription ||
        `Payment declined. ResponseCode: ${paymentDetails.ResponseCode}`;

      const isTestMode = this.vposUrl.includes("servicestest");
      const fullErrorMsg = isTestMode
        ? `${errorMsg} (Test mode: Use an approved test card for successful payments.)`
        : errorMsg;

      throw new Error(fullErrorMsg);
    } else if (
      paymentDetails.ResponseCode &&
      paymentDetails.ResponseCode !== "00" &&
      paymentDetails.ResponseCode !== "0125"
    ) {
      const errorMsg =
        paymentDetails.Description ||
        paymentDetails.TrxnDescription ||
        `Payment error. ResponseCode: ${paymentDetails.ResponseCode}`;
      throw new Error(errorMsg);
    }

    // Retrieve conversion metadata first (needed for test mode where orderID is numeric)
    const configKey = `credit_refill_${orderID}`;
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
        `Failed to retrieve conversion metadata for ${orderID}: ${error}`
      );
    }

    // Resolve userId: from metadata (test mode numeric orderID) or from orderID format userId-timestamp-random
    let userId: number;
    if (conversionMetadata?.userId != null) {
      userId = conversionMetadata.userId;
    } else if (orderID.includes("-")) {
      userId = parseInt(orderID.split("-")[0]);
    } else {
      const orderIdFromDetails = paymentDetails.OrderID?.toString() || "";
      if (orderIdFromDetails.includes("-")) {
        userId = parseInt(orderIdFromDetails.split("-")[0]);
      } else {
        throw new Error(`Cannot determine userId from orderID: ${orderID}`);
      }
    }

    if (isNaN(userId)) {
      throw new Error(`Invalid userId extracted from orderID: ${orderID}`);
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
      referenceId: paymentID,
      referenceType: "payment",
      currency: conversionMetadata?.currency || this.BASE_CURRENCY,
      baseCurrency: this.BASE_CURRENCY,
      exchangeRate: conversionMetadata?.exchangeRate || 1,
      originalAmount: conversionMetadata?.originalAmount || creditAmount,
      convertedAmount: creditAmount,
      metadata: {
        orderID,
        paymentID,
        responseCode,
        paymentState: paymentDetails.PaymentState,
        paymentAmount, // Amount paid in payment gateway currency
        conversionMetadata,
      },
    });

    // Extract and save BindingID if present (for card binding)
    // Check if saveCard was requested and fetch binding info if needed
    const saveCard = conversionMetadata?.saveCard === true;
    this.logger.log(
      `Checking for binding info. saveCard flag: ${saveCard}, PaymentID: ${paymentID}, OrderID: ${orderID}`
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

    // First, check if binding info is in the initial payment details response
    if (paymentDetails.BindingID && paymentDetails.CardHolderID) {
      bindingId = paymentDetails.BindingID;
      cardHolderId = paymentDetails.CardHolderID;
      cardNumber = paymentDetails.CardNumber || "";
      expDate = paymentDetails.ExpDate || "";
      this.logger.log(
        `✅ Binding info found in payment details: BindingID=${bindingId}, CardHolderID=${cardHolderId}`
      );
    } else if (saveCard && paymentID) {
      // If saveCard was true but binding info not in initial response, try fetching again
      this.logger.log(
        `saveCard was true (${saveCard}) but binding info not in initial response. PaymentDetails: ${JSON.stringify({
          BindingID: paymentDetails.BindingID,
          CardHolderID: paymentDetails.CardHolderID,
          CardNumber: paymentDetails.CardNumber ? "***" + paymentDetails.CardNumber.slice(-4) : null,
          ResponseCode: paymentDetails.ResponseCode,
          PaymentState: paymentDetails.PaymentState,
        })}`
      );
      
      // Try multiple times with delays - AmeriaBank might need time to process binding
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts && !bindingId) {
        attempts++;
        try {
          // Wait progressively longer: 2s, 4s, 6s
          const delay = attempts * 2000;
          this.logger.log(
            `Attempt ${attempts}/${maxAttempts}: Waiting ${delay}ms before fetching payment details...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          
          const paymentDetailsResponse = await this.getPaymentDetails(paymentID);
          this.logger.log(
            `GetPaymentDetails attempt ${attempts} response keys: ${Object.keys(paymentDetailsResponse || {}).join(", ")}`
          );
          this.logger.log(
            `GetPaymentDetails attempt ${attempts} BindingID: ${paymentDetailsResponse?.BindingID}, CardHolderID: ${paymentDetailsResponse?.CardHolderID}`
          );
          
          if (paymentDetailsResponse?.BindingID && paymentDetailsResponse?.CardHolderID) {
            bindingId = paymentDetailsResponse.BindingID;
            cardHolderId = paymentDetailsResponse.CardHolderID;
            cardNumber = paymentDetailsResponse.CardNumber || "";
            expDate = paymentDetailsResponse.ExpDate || "";
            this.logger.log(
              `✅ Binding info retrieved from GetPaymentDetails (attempt ${attempts}): BindingID=${bindingId}, CardHolderID=${cardHolderId}`
            );
            break;
          } else {
            this.logger.warn(
              `Attempt ${attempts}: GetPaymentDetails did not return binding info. Full response: ${JSON.stringify(paymentDetailsResponse)}`
            );
          }
        } catch (error: any) {
          this.logger.error(
            `Attempt ${attempts}: Failed to fetch payment details for binding: ${error.message}`
          );
        }
      }
      
      // If still no binding, try GetBindings API as fallback
      if (!bindingId && saveCard) {
        this.logger.log(
          `GetPaymentDetails didn't return binding. Trying GetBindings API as fallback...`
        );
        try {
          const bindings = await this.getBindings(userId);
          this.logger.log(`GetBindings returned ${bindings.length} bindings`);
          if (bindings.length > 0) {
            // Use the most recent binding (assuming it's the one we just created)
            const latestBinding = bindings[0];
            if (latestBinding.bindingId && latestBinding.cardHolderId) {
              bindingId = latestBinding.bindingId;
              cardHolderId = latestBinding.cardHolderId;
              cardNumber = latestBinding.cardNumber || "";
              expDate = latestBinding.expDate || "";
              this.logger.log(
                `✅ Binding info retrieved from GetBindings: BindingID=${bindingId}, CardHolderID=${cardHolderId}`
              );
            }
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to fetch bindings: ${error.message}. Payment still succeeded.`
          );
        }
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
            const paymentMethodId = `pm_ameriabank_${userId}_${Date.now()}`;
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
            const paymentMethodId = `pm_ameriabank_${userId}_${Date.now()}`;
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
        `⚠️ saveCard was true but no binding info was retrieved. PaymentID: ${paymentID}, OrderID: ${orderID}, bindingId=${bindingId}, cardHolderId=${cardHolderId}`
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
    // Validate credentials are not placeholders
    if (
      !this.credentials.username ||
      !this.credentials.password ||
      this.credentials.username.includes("your-ameriabank") ||
      this.credentials.password.includes("your-ameriabank")
    ) {
      this.logger.error(
        "Ameriabank credentials are not properly configured. Please check environment variables."
      );
      throw new Error(
        "Payment gateway credentials not configured. Please contact support."
      );
    }

    // Validate URL is correct (should be test URL for test environment)
    if (
      this.vposUrl.includes("servicestest") &&
      !this.vposStatusUrl.includes("servicestest")
    ) {
      this.logger.error(
        `Mismatch: InitPayment URL is test (${this.vposUrl}) but Status URL is production (${this.vposStatusUrl})`
      );
      throw new Error(
        "Payment gateway URL configuration mismatch. Please check environment variables."
      );
    }

    this.logger.log(
      `Getting payment details for PaymentID: ${paymentID}, using URL: ${this.vposStatusUrl}`
    );

    const payload = {
      PaymentID: paymentID,
      Username: this.credentials.username,
      Password: this.credentials.password,
    };

    try {
      const response = await axios.post(this.vposStatusUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      });

      // Log warning for non-success ResponseCode but still return data
      // Caller will check PaymentState to determine actual status
      if (response.data?.ResponseCode && response.data.ResponseCode !== "00") {
        this.logger.warn(
          `GetPaymentDetails ResponseCode: ${response.data.ResponseCode}`
        );
      }

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to get payment details for PaymentID ${paymentID}: ${error.message}`
      );
      if (error.response?.data) {
        // Return the error response data so caller can check it
        return error.response.data;
      }
      throw new Error(
        `Failed to retrieve payment details: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Initiate subscription payment
   * Similar to initiatePayment but for subscriptions with different callback URL
   */
  async initiateSubscriptionPayment(
    userId: number,
    amount: number,
    planId: number,
  ) {
    // Validate credentials and required environment variables
    if (
      !this.credentials.clientId ||
      !this.credentials.username ||
      !this.credentials.password
    ) {
      this.logger.error("AmeriaBank credentials not configured");
      throw new Error(
        "Payment gateway credentials not configured. Please contact support."
      );
    }

    if (!this.vposUrl || !this.vposStatusUrl) {
      this.logger.error("AmeriaBank vPOS URLs not configured");
      throw new Error(
        "Payment gateway URLs not configured. Please contact support."
      );
    }

    // Check if in test mode and adjust amount if needed
    const isTestMode = this.vposUrl.includes("servicestest");
    let paymentAmount = amount;
    if (isTestMode && amount !== 10) {
      this.logger.warn(
        `Test mode detected: Overriding amount from ${amount} to 10 AMD (test mode requirement)`
      );
      paymentAmount = 10;
    }

    // Generate unique OrderID (integer, max 15 digits to stay within JavaScript safe integer)
    // Format: 6 (timestamp) + 5 (userId) + 3 (planId) + 1 (random) = 15 digits (safe)
    const timestamp = Date.now();
    const timestampSuffix = timestamp.toString().slice(-6); // Reduced to 6 to ensure safe integer range
    const randomSuffix = Math.floor(Math.random() * 100);
    const userIdStr = userId.toString().padStart(5, "0").slice(-5);
    const planIdStr = planId.toString().padStart(3, "0").slice(-3);
    const randomStr = randomSuffix.toString().padStart(1, "0").slice(-1);
    const orderIdInt = parseInt(
      `${timestampSuffix}${userIdStr}${planIdStr}${randomStr}`,
      10
    );
    // Format: userId-planId-timestamp-random (for callback parsing)
    const orderId = `${userId}-${planId}-${timestamp}-${randomSuffix}`;

    if (orderIdInt > Number.MAX_SAFE_INTEGER) {
      throw new Error("OrderID generation failed: number too large");
    }

    // Build callback URL for subscriptions
    const port = process.env.PORT || "8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
    const backUrl = `${backendUrl}/subscriptions/callback`;

    // Build payment request payload
    const payload = {
      ClientID: this.credentials.clientId,
      Username: this.credentials.username,
      Password: this.credentials.password,
      Amount: paymentAmount, // Use adjusted amount for test mode
      OrderID: orderIdInt,
      Description: `Subscription purchase - ${paymentAmount} ${process.env.CURRENCY || "AMD"}`,
      BackURL: backUrl,
    };

    // Initiate payment
    const response = await axios.post(this.vposUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    const responseData = response.data;

    // Check for errors
    if (responseData?.ResponseCode && responseData.ResponseCode !== 1) {
      const errorMessage =
        responseData.ResponseMessage ||
        `Payment gateway error: ${responseData.ResponseCode}`;
      this.logger.error(`Payment initiation failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Extract PaymentID and construct payment URL
    if (responseData?.ResponseCode === 1 && responseData?.PaymentID) {
      const baseDomain = this.vposUrl.includes("servicestest")
        ? "https://servicestest.ameriabank.am"
        : "https://services.ameriabank.am";
      const paymentUrl = `${baseDomain}/VPOS/Payments/Pay?id=${responseData.PaymentID}&lang=en`;

      return {
        orderId,
        paymentId: responseData.PaymentID,
        paymentUrl,
        paymentHtml: null,
        paymentData: response.data,
      };
    }

    // Fallback error
    this.logger.error(
      `Payment initiated but PaymentID not found. ResponseCode: ${responseData?.ResponseCode}`
    );
    throw new Error(
      "Payment initiated but payment URL could not be generated. Please contact support."
    );
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
    // Validate credentials
    if (
      !this.credentials.clientId ||
      !this.credentials.username ||
      !this.credentials.password
    ) {
      this.logger.error("AmeriaBank credentials not configured");
      throw new Error(
        "Payment gateway credentials not configured. Please contact support."
      );
    }

    if (!this.vposUrl || !this.vposStatusUrl) {
      this.logger.error("AmeriaBank vPOS URLs not configured");
      throw new Error(
        "Payment gateway URLs not configured. Please contact support."
      );
    }

    const isTestMode = this.vposUrl.includes("servicestest");

    // Generate OrderID
    let orderIdInt: number;
    let orderId: string;
    if (isTestMode) {
      orderIdInt =
        30164001 + Math.floor(Math.random() * (30165000 - 30164001 + 1));
      orderId = String(orderIdInt);
    } else {
      const timestamp = Date.now();
      const timestampSuffix = timestamp.toString().slice(-10);
      const randomSuffix = Math.floor(Math.random() * 100);
      const userIdStr = userId.toString().padStart(5, "0").slice(-5);
      const randomStr = randomSuffix.toString().padStart(1, "0").slice(-1);
      orderIdInt = parseInt(
        `${timestampSuffix}${userIdStr}${randomStr}`,
        10
      );
      orderId = `${userId}-${timestamp}-${randomSuffix}`;
    }

    // Get user's currency preference
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const normalizedCurrency = (currency || user?.currency || "USD").toUpperCase();

    // Convert amount to base currency (USD) for credits
    let amountInBaseCurrency = amount;
    let exchangeRate: number | null = null;
    let originalAmount = amount;
    let convertedAmount = amount;
    const paymentAmount = isTestMode ? 10 : amount;

    if (!isTestMode && normalizedCurrency !== this.BASE_CURRENCY) {
      try {
        exchangeRate = await this.exchangeRateService.getExchangeRate(
          normalizedCurrency,
          this.BASE_CURRENCY
        );
        amountInBaseCurrency = amount * exchangeRate;
        convertedAmount = Math.round(amountInBaseCurrency * 100) / 100;
      } catch (error: any) {
        this.logger.error(
          `Failed to convert currency: ${error.message}. Using amount as-is.`
        );
        exchangeRate = 1;
      }
    } else {
      exchangeRate = 1;
    }

    // Build callback URL
    const port = process.env.PORT || "8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
    const backUrl = `${backendUrl}/credit/refill/callback`;

    // Build MakeBindingPayment request payload
    const makeBindingPaymentUrl = this.vposUrl.replace(
      "/InitPayment",
      "/MakeBindingPayment"
    );

    // Validate required fields
    if (!cardHolderId || cardHolderId.trim().length === 0) {
      this.logger.error(
        `CardHolderID is missing or empty. BindingID: ${bindingId}, OrderID: ${orderIdInt}`
      );
      throw new Error(
        "Card holder ID is missing. Please save the card again during a payment."
      );
    }

    // Ensure CardHolderID is a string (should match what was sent during InitPayment)
    const cardHolderIdStr = String(cardHolderId).trim();
    
    // Build MakeBindingPayment payload
    // Note: BindingID is NOT a request parameter - API uses CardHolderID to identify the binding
    const payload = {
      ClientID: this.credentials.clientId,
      Username: this.credentials.username,
      Password: this.credentials.password,
      CardHolderID: cardHolderIdStr,
      Amount: Number(paymentAmount),
      OrderID: Number(orderIdInt),
      BackURL: backUrl,
      PaymentType: "1",
      Description: `Credit refill - ${paymentAmount} ${isTestMode ? "AMD" : normalizedCurrency}`,
      Currency: isTestMode ? "AMD" : normalizedCurrency,
    };

    this.logger.log(
      `Making binding payment: OrderID=${orderIdInt}, Amount=${paymentAmount}, CardHolderID=${cardHolderIdStr}`
    );
    this.logger.log(`MakeBindingPayment URL: ${makeBindingPaymentUrl}`);
    this.logger.log(`MakeBindingPayment payload: ${JSON.stringify({ ...payload, Password: '***' })}`);

    try {
      const response = await axios.post(makeBindingPaymentUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      });

      const responseData = response.data;
      this.logger.log(
        `MakeBindingPayment response: ${JSON.stringify(responseData)}`
      );

      // Check for errors first
      if (responseData?.ResponseCode && responseData.ResponseCode !== "00" && responseData.ResponseCode !== 1) {
        const errorMsg =
          responseData?.TrxnDescription ||
          responseData?.Description ||
          responseData?.ResponseMessage ||
          `Payment failed. ResponseCode: ${responseData.ResponseCode}`;
        this.logger.error(`Binding payment failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Check payment status - accept multiple success indicators
      const isSuccess = 
        (responseData?.ResponseCode === "00" || responseData?.ResponseCode === 1) &&
        (responseData?.PaymentState === "payment_approved" || 
         responseData?.PaymentState === "approved" ||
         responseData?.Status === "approved" ||
         responseData?.Success === true);

      if (isSuccess) {
        // Payment approved - add credits
        const creditAmount = exchangeRate
          ? convertedAmount
          : responseData.DepositedAmount || responseData.Amount;

        // Update user credits
        const updatedUser = await this.prisma.user.update({
          where: { id: userId },
          data: { creditBalance: { increment: creditAmount } },
          select: { creditBalance: true },
        });

        // Log transaction
        await this.creditTransactionsService.logTransaction({
          userId,
          amount: creditAmount,
          balanceAfter: updatedUser.creditBalance,
          type: "refill",
          status: "completed",
          description: exchangeRate
            ? `Credit refill: ${originalAmount} ${normalizedCurrency} = ${creditAmount} ${this.BASE_CURRENCY} (saved card)`
            : `Credit refill of ${creditAmount} ${this.BASE_CURRENCY} (saved card)`,
          referenceId: responseData.PaymentID,
          referenceType: "payment",
          currency: normalizedCurrency,
          baseCurrency: this.BASE_CURRENCY,
          exchangeRate: exchangeRate || 1,
          originalAmount: originalAmount,
          convertedAmount: creditAmount,
          metadata: {
            orderID: orderId,
            paymentID: responseData.PaymentID,
            bindingID: bindingId,
            paymentState: responseData.PaymentState,
            paymentAmount,
          },
        });

        this.logger.log(
          `Binding payment successful: user ${userId}, amount ${creditAmount} ${this.BASE_CURRENCY}`
        );

        return {
          success: true,
          message: "Payment successful",
          orderId,
          paymentId: responseData.PaymentID,
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
      } else {
        // Payment failed or pending
        const responseCode = responseData?.ResponseCode;
        const paymentState = responseData?.PaymentState || responseData?.Status;
        
        // Check if payment is pending (might need to check status later)
        if (paymentState === "pending" || paymentState === "processing") {
          this.logger.warn(
            `Binding payment is pending. OrderID: ${orderId}, PaymentID: ${responseData?.PaymentID}`
          );
          // For pending payments, we might need to poll GetPaymentDetails
          // For now, treat as failure and let user retry
          throw new Error(
            "Payment is pending. Please try again in a moment or use 'New Card' option."
          );
        }
        
        // Payment failed
        const errorMsg =
          responseData?.TrxnDescription ||
          responseData?.Description ||
          responseData?.ResponseMessage ||
          responseData?.Message ||
          `Payment failed. ResponseCode: ${responseCode}, PaymentState: ${paymentState}`;
        this.logger.error(`Binding payment failed: ${errorMsg}. Full response: ${JSON.stringify(responseData)}`);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      this.logger.error(
        `MakeBindingPayment error: ${error.message}. OrderID: ${orderId}, CardHolderID: ${cardHolderId}`
      );
      
      if (error.response) {
        this.logger.error(`AmeriaBank API response status: ${error.response.status}`);
        this.logger.error(`AmeriaBank API response data: ${JSON.stringify(error.response.data)}`);
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error("Unable to connect to payment gateway. Please try again later.");
      }
      
      // Handle 500 errors (common in test environment)
      if (error.response?.status === 500) {
        const errorData = error.response.data;
        const errorMessage = errorData?.Message || errorData?.message || errorData?.TrxnDescription || 
          errorData?.error || "Payment gateway returned an error.";
        
        this.logger.error(
          `Binding payment failed with 500 error. CardHolderID: ${cardHolderId}, Error: ${errorMessage}`
        );
        
        throw new Error(errorMessage);
      }
      
      throw new Error(`Payment failed: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Get card bindings from AmeriaBank
   * Note: This API is not available in test environment (returns 500)
   */
  async getBindings(userId: number) {
    // Validate credentials
    if (
      !this.credentials.clientId ||
      !this.credentials.username ||
      !this.credentials.password
    ) {
      this.logger.error("AmeriaBank credentials not configured");
      throw new Error(
        "Payment gateway credentials not configured. Please contact support."
      );
    }

    const getBindingsUrl = this.vposUrl.replace(
      "/InitPayment",
      "/GetBindings"
    );

    const payload = {
      ClientID: this.credentials.clientId,
      Username: this.credentials.username,
      Password: this.credentials.password,
      PaymentType: "1", // Standard payment type
    };

    this.logger.log(`Getting bindings for user ${userId}`);

    try {
      const response = await axios.post(getBindingsUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      });

      const responseData = response.data;
      this.logger.log(
        `GetBindings response: ${JSON.stringify(responseData)}`
      );

      if (responseData?.ResponseCode === "00" && responseData?.CardBindingFileds) {
        return responseData.CardBindingFileds.map((binding: any) => ({
          bindingId: binding.BindingID,
          cardHolderId: binding.CardHolderID,
          cardNumber: binding.CardNumber || "****",
          expDate: binding.ExpDate,
          maskedCardNumber: binding.CardNumber
            ? `****${binding.CardNumber.slice(-4)}`
            : "****",
        }));
      } else {
        this.logger.warn(
          `GetBindings returned non-success code: ${responseData?.ResponseCode}`
        );
        return [];
      }
    } catch (error: any) {
      this.logger.error(`GetBindings error: ${error.message}`);
      throw new Error(
        `Failed to retrieve bindings: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Cancel a payment using Ameriabank VPOS CancelPayment API
   */
  async cancelPayment(paymentID: string, orderID: string) {
    // Validate credentials
    if (
      !this.credentials.clientId ||
      !this.credentials.username ||
      !this.credentials.password
    ) {
      this.logger.error("AmeriaBank credentials not configured");
      throw new Error(
        "Payment gateway credentials not configured. Please contact support."
      );
    }

    const cancelPaymentUrl = this.vposUrl.replace(
      "/InitPayment",
      "/CancelPayment"
    );

    const payload = {
      PaymentID: paymentID,
      OrderID: orderID,
      Username: this.credentials.username,
      Password: this.credentials.password,
    };

    this.logger.log(
      `Canceling payment: PaymentID=${paymentID}, OrderID=${orderID}`
    );
    this.logger.log(
      `CancelPayment payload: ${JSON.stringify({ ...payload, Password: "***" })}`
    );

    try {
      const response = await axios.post(cancelPaymentUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      });

      const responseData = response.data;
      this.logger.log(
        `CancelPayment response: ${JSON.stringify(responseData)}`
      );

      if (responseData?.ResponseCode && responseData.ResponseCode !== "00" && responseData.ResponseCode !== 1) {
        const errorMsg =
          responseData?.TrxnDescription ||
          responseData?.Description ||
          responseData?.ResponseMessage ||
          `Cancel failed. ResponseCode: ${responseData.ResponseCode}`;
        this.logger.error(`Cancel payment failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      this.logger.log(
        `Payment canceled successfully: PaymentID=${paymentID}, OrderID=${orderID}`
      );

      return {
        success: true,
        message: "Payment canceled successfully",
        response: responseData,
      };
    } catch (error: any) {
      this.logger.error(
        `CancelPayment error: ${error.message}. PaymentID: ${paymentID}, OrderID: ${orderID}`
      );
      
      if (error.response) {
        this.logger.error(`AmeriaBank API response status: ${error.response.status}`);
        this.logger.error(`AmeriaBank API response data: ${JSON.stringify(error.response.data)}`);
        const errorData = error.response.data;
        throw new Error(
          errorData?.Message ||
          errorData?.TrxnDescription ||
          errorData?.Description ||
          errorData?.ResponseMessage ||
          error.message
        );
      }
      
      throw new Error(`Failed to cancel payment: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Refund a payment using Ameriabank VPOS RefundPayment API
   * Supports both full refund (omit amount) and partial refund (provide amount)
   */
  async refundPayment(paymentID: string, orderID: string, amount?: number) {
    // Validate credentials
    if (
      !this.credentials.clientId ||
      !this.credentials.username ||
      !this.credentials.password
    ) {
      this.logger.error("AmeriaBank credentials not configured");
      throw new Error(
        "Payment gateway credentials not configured. Please contact support."
      );
    }

    const refundPaymentUrl = this.vposUrl.replace(
      "/InitPayment",
      "/RefundPayment"
    );

    const payload: any = {
      PaymentID: paymentID,
      OrderID: orderID,
      Username: this.credentials.username,
      Password: this.credentials.password,
    };

    // Add amount if partial refund is requested
    if (amount !== undefined && amount !== null) {
      if (amount <= 0) {
        throw new Error("Refund amount must be greater than 0");
      }
      payload.Amount = Number(amount);
    }

    this.logger.log(
      `Refunding payment: PaymentID=${paymentID}, OrderID=${orderID}, Amount=${amount !== undefined ? amount : "full"}`
    );
    this.logger.log(
      `RefundPayment payload: ${JSON.stringify({ ...payload, Password: "***" })}`
    );

    try {
      const response = await axios.post(refundPaymentUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      });

      const responseData = response.data;
      this.logger.log(
        `RefundPayment response: ${JSON.stringify(responseData)}`
      );

      if (responseData?.ResponseCode && responseData.ResponseCode !== "00" && responseData.ResponseCode !== 1) {
        const errorMsg =
          responseData?.TrxnDescription ||
          responseData?.Description ||
          responseData?.ResponseMessage ||
          `Refund failed. ResponseCode: ${responseData.ResponseCode}`;
        this.logger.error(`Refund payment failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      this.logger.log(
        `Payment refunded successfully: PaymentID=${paymentID}, OrderID=${orderID}, Amount=${amount !== undefined ? amount : "full"}`
      );

      return {
        success: true,
        message: amount !== undefined ? `Payment refunded successfully (partial: ${amount})` : "Payment refunded successfully (full)",
        response: responseData,
      };
    } catch (error: any) {
      this.logger.error(
        `RefundPayment error: ${error.message}. PaymentID: ${paymentID}, OrderID: ${orderID}`
      );
      
      if (error.response) {
        this.logger.error(`AmeriaBank API response status: ${error.response.status}`);
        this.logger.error(`AmeriaBank API response data: ${JSON.stringify(error.response.data)}`);
        const errorData = error.response.data;
        throw new Error(
          errorData?.Message ||
          errorData?.TrxnDescription ||
          errorData?.Description ||
          errorData?.ResponseMessage ||
          error.message
        );
      }
      
      throw new Error(`Failed to refund payment: ${error.message || "Unknown error"}`);
    }
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
