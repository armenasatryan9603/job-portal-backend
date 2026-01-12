import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../prisma.service";
import { CreditTransactionsService } from "./credit-transactions.service";
import { ExchangeRateService } from "../exchange-rate/exchange-rate.service";

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

    // Generate unique OrderID (integer, max 16 digits for JavaScript safe integer)
    const timestamp = Date.now();
    const timestampSuffix = timestamp.toString().slice(-10);
    const randomSuffix = Math.floor(Math.random() * 100);
    const userIdStr = userId.toString().padStart(5, "0").slice(-5);
    const randomStr = randomSuffix.toString().padStart(1, "0").slice(-1);
    const orderIdInt = parseInt(
      `${timestampSuffix}${userIdStr}${randomStr}`,
      10
    );
    const orderId = `${userId}-${timestamp}-${randomSuffix}`;

    if (orderIdInt > Number.MAX_SAFE_INTEGER) {
      throw new Error("OrderID generation failed: number too large");
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

    if (normalizedCurrency !== this.BASE_CURRENCY) {
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
      exchangeRate = 1;
    }

    // Build callback URL
    // Use BACKEND_URL if set, otherwise construct from PORT (for local development)
    const port = process.env.PORT || "8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
    const backUrl = `${backendUrl}/credit/refill/callback`;

    // Store conversion metadata in orderId format for retrieval in callback
    // Format: userId-timestamp-random|currency|originalAmount|convertedAmount|exchangeRate
    const orderIdWithMetadata = `${orderId}|${normalizedCurrency}|${originalAmount}|${convertedAmount}|${exchangeRate}`;

    // Build payment request payload
    // Note: Payment gateway processes in its default currency (likely AMD for Ameriabank)
    // We send the amount in user's currency, gateway will handle conversion
    const payload = {
      ClientID: this.credentials.clientId,
      Username: this.credentials.username,
      Password: this.credentials.password,
      Amount: amount, // Amount in user's currency
      OrderID: orderIdInt,
      Description: `Credit refill - ${amount} ${normalizedCurrency}`,
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

      // Store conversion metadata temporarily in SystemConfig for callback retrieval
      // We'll use a key format: credit_refill_{orderId}
      await this.prisma.systemConfig.upsert({
        where: { key: `credit_refill_${orderId}` },
        update: {
          value: JSON.stringify({
            userId,
            currency: normalizedCurrency,
            originalAmount,
            convertedAmount,
            exchangeRate,
            baseCurrency: this.BASE_CURRENCY,
          }),
        },
        create: {
          key: `credit_refill_${orderId}`,
          value: JSON.stringify({
            userId,
            currency: normalizedCurrency,
            originalAmount,
            convertedAmount,
            exchangeRate,
            baseCurrency: this.BASE_CURRENCY,
          }),
          description: `Temporary storage for credit refill conversion metadata`,
        },
      });

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
    // Validate required parameters
    if (!orderID || !paymentID) {
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

    // Extract userId from orderID (format: userId-timestamp-random)
    let userId: number;
    if (orderID.includes("-")) {
      userId = parseInt(orderID.split("-")[0]);
    } else {
      // Fallback: try paymentDetails.OrderID
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

    // Retrieve conversion metadata from SystemConfig
    let conversionMetadata: {
      currency: string;
      originalAmount: number;
      convertedAmount: number;
      exchangeRate: number;
      baseCurrency: string;
    } | null = null;

    try {
      const configKey = `credit_refill_${orderID}`;
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: configKey },
      });

      if (config) {
        conversionMetadata = JSON.parse(config.value);
        // Clean up temporary storage
        await this.prisma.systemConfig.delete({
          where: { key: configKey },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to retrieve conversion metadata for ${orderID}: ${error}`
      );
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
    const payload = {
      PaymentID: paymentID,
      Username: this.credentials.username,
      Password: this.credentials.password,
    };

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
