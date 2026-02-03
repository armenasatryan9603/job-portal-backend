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
    saveCard: boolean = false
  ) {
    // If cardId is provided, use saved card payment (no webview)
    if (cardId) {
      // Get card with binding info
      const card = (await this.prisma.card.findFirst({
        where: {
          id: parseInt(cardId, 10),
          userId,
          isActive: true,
        },
      })) as any;

      if (!card || !card.bindingId || !card.cardHolderId) {
        throw new Error(
          "Card not found or not configured for saved payments. Please use a different card or add a new one."
        );
      }

      // Use MakeBindingPayment for saved card
      return this.makeBindingPayment(
        userId,
        amount,
        currency,
        card.bindingId,
        card.cardHolderId
      );
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
      `Initiating payment: OrderID=${orderIdInt}, Amount=${paymentAmount}, URL=${this.vposUrl}, BackURL=${backUrl}`
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
    let bindingId: string | null = null;
    let cardHolderId: string | null = null;
    let cardNumber = "";
    let expDate = "";

    // First, check if binding info is in the callback response
    if (paymentDetails.BindingID && paymentDetails.CardHolderID) {
      bindingId = paymentDetails.BindingID;
      cardHolderId = paymentDetails.CardHolderID;
      cardNumber = paymentDetails.CardNumber || "";
      expDate = paymentDetails.ExpDate || "";
      this.logger.log(
        `Binding info found in callback response: BindingID=${bindingId}, CardHolderID=${cardHolderId}`
      );
    } else if (saveCard && paymentID) {
      // If saveCard was true but binding info not in callback, fetch it via GetPaymentDetails
      this.logger.log(
        `saveCard was true but binding info not in callback. Fetching payment details for PaymentID: ${paymentID}`
      );
      try {
        // Wait a bit for AmeriaBank to process the binding
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        const paymentDetailsResponse = await this.getPaymentDetails(paymentID);
        if (paymentDetailsResponse?.BindingID && paymentDetailsResponse?.CardHolderID) {
          bindingId = paymentDetailsResponse.BindingID;
          cardHolderId = paymentDetailsResponse.CardHolderID;
          cardNumber = paymentDetailsResponse.CardNumber || "";
          expDate = paymentDetailsResponse.ExpDate || "";
          this.logger.log(
            `Binding info retrieved from GetPaymentDetails: BindingID=${bindingId}, CardHolderID=${cardHolderId}`
          );
        } else {
          this.logger.warn(
            `saveCard was true but GetPaymentDetails did not return binding info. Response: ${JSON.stringify(paymentDetailsResponse)}`
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to fetch payment details for binding: ${error.message}. Payment still succeeded.`
        );
      }
    }

    // Save binding info if we have it
    if (bindingId && cardHolderId) {
      try {
        const last4 = cardNumber.length >= 4 ? cardNumber.slice(-4) : null;
        
        // Try to find existing card without bindingId for this user
        let card = await this.prisma.card.findFirst({
          where: {
            userId,
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
        });
        
        // Filter out cards that already have bindingId
        if (card && (card as any).bindingId) {
          card = null;
        }

        if (card) {
          // Update existing card with binding info
          await this.prisma.card.update({
            where: { id: card.id },
            data: {
              bindingId: bindingId as any,
              cardHolderId: cardHolderId as any,
              // Update last4 if we have it and it's different
              ...(last4 && last4 !== (card as any).last4 ? { last4 } : {}),
            } as any,
          });
          this.logger.log(
            `Updated card ${card.id} with BindingID ${bindingId} for user ${userId}`
          );
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

          card = await this.prisma.card.create({
            data: {
              userId,
              paymentMethodId: `pm_ameriabank_${userId}_${Date.now()}`,
              brand,
              last4: last4!,
              expMonth: expMonth || 12,
              expYear: (expYear || new Date().getFullYear() + 1),
              bindingId: bindingId as any,
              cardHolderId: cardHolderId as any,
              isDefault,
              isActive: true,
            } as any,
          });
          this.logger.log(
            `Created new card ${card.id} with BindingID ${bindingId} for user ${userId}`
          );
        } else {
          this.logger.warn(
            `BindingID ${bindingId} received but no card details available to create card record`
          );
        }
      } catch (error: any) {
        // Don't fail the payment if binding save fails
        this.logger.error(
          `Failed to save binding: ${error.message}. Payment still succeeded.`
        );
      }
    } else if (saveCard) {
      this.logger.warn(
        `saveCard was true but no binding info was retrieved. PaymentID: ${paymentID}, OrderID: ${orderID}`
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
    bindingId: string,
    cardHolderId: string
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

    const payload = {
      ClientID: this.credentials.clientId,
      Username: this.credentials.username,
      Password: this.credentials.password,
      CardHolderID: cardHolderId,
      Amount: Number(paymentAmount),
      OrderID: Number(orderIdInt),
      BackURL: backUrl,
      PaymentType: "1", // Standard payment type
      Description: `Credit refill - ${paymentAmount} ${isTestMode ? "AMD" : normalizedCurrency}`,
      Currency: isTestMode ? "AMD" : normalizedCurrency,
    };

    this.logger.log(
      `Making binding payment: OrderID=${orderIdInt}, Amount=${paymentAmount}, BindingID=${bindingId}, CardHolderID=${cardHolderId}`
    );

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

      // Check payment status
      if (
        responseData?.ResponseCode === "00" &&
        responseData?.PaymentState === "payment_approved"
      ) {
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
        // Payment failed
        const errorMsg =
          responseData?.TrxnDescription ||
          responseData?.Description ||
          `Payment failed. ResponseCode: ${responseData?.ResponseCode}`;
        this.logger.error(`Binding payment failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      this.logger.error(
        `MakeBindingPayment error: ${error.message}. OrderID: ${orderId}, BindingID: ${bindingId}`
      );
      throw new Error(
        `Payment failed: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get card bindings from AmeriaBank
   * Syncs saved cards from the payment gateway
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
