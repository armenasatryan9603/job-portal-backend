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
    currency: string = "USD"
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
    const payload = {
      ClientID: this.credentials.clientId,
      Username: this.credentials.username,
      Password: this.credentials.password,
      Amount: Number(paymentAmount), // Ensure it's a number
      OrderID: Number(orderIdInt), // Ensure it's an integer
      Description: `Credit refill - ${paymentAmount} ${isTestMode ? "AMD" : normalizedCurrency}`,
      BackURL: backUrl,
    };
    
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
