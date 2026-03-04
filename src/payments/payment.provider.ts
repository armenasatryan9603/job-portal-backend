import axios, { AxiosInstance } from "axios";

export type PaymentStatus = "approved" | "declined" | "pending" | "error";

export interface InitCreditRefillParams {
  userId: number;
  amount: number;
  currency: string;
  saveCard: boolean;
  orderId: string;
  callbackUrl: string;
}

export interface InitCreditRefillResult {
  orderId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paymentUrl: string;
  raw: any;
}

export interface BindingPaymentParams {
  userId: number;
  amount: number;
  currency: string;
  bindingToken: string;
}

export interface BindingPaymentResult {
  success: boolean;
  message: string;
  providerPaymentId?: string;
  amountCharged: number;
  raw: any;
}

export interface PaymentDetailsResult {
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  raw: any;
}

export interface CancelPaymentResult {
  success: boolean;
  message: string;
  raw: any;
}

export interface RefundPaymentResult {
  success: boolean;
  message: string;
  raw: any;
}

export interface PaymentProvider {
  initCreditRefill(
    params: InitCreditRefillParams
  ): Promise<InitCreditRefillResult>;

  makeBindingPayment(
    params: BindingPaymentParams
  ): Promise<BindingPaymentResult>;

  getPaymentDetails(paymentId: string): Promise<PaymentDetailsResult>;

  cancelPayment(
    paymentId: string,
    orderId?: string
  ): Promise<CancelPaymentResult>;

  refundPayment(
    paymentId: string,
    orderId?: string,
    amount?: number
  ): Promise<RefundPaymentResult>;
}

export class FastBankPaymentProvider implements PaymentProvider {
  private readonly http: AxiosInstance;

  private readonly initUrl: string;
  private readonly statusUrl: string;
  private readonly bindingPaymentUrl: string;
  private readonly cancelUrl: string;
  private readonly refundUrl: string;

  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly merchantId?: string;

  constructor() {
    this.initUrl = process.env.FASTBANK_PAYMENT_INIT_URL || "";
    this.statusUrl = process.env.FASTBANK_PAYMENT_STATUS_URL || "";
    this.bindingPaymentUrl =
      process.env.FASTBANK_BINDING_PAYMENT_URL || this.initUrl;
    this.cancelUrl = process.env.FASTBANK_CANCEL_URL || "";
    this.refundUrl = process.env.FASTBANK_REFUND_URL || "";

    this.apiKey = process.env.FASTBANK_API_KEY;
    this.apiSecret = process.env.FASTBANK_API_SECRET;
    this.merchantId = process.env.FASTBANK_MERCHANT_ID;

    this.http = axios.create({
      timeout: 30000,
    });
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }
    if (this.apiSecret) {
      headers["X-Api-Secret"] = this.apiSecret;
    }
    if (this.merchantId) {
      headers["X-Merchant-Id"] = this.merchantId;
    }

    return headers;
  }

  private mapStatus(raw: any): PaymentStatus {
    const status =
      raw?.status ||
      raw?.Status ||
      raw?.paymentStatus ||
      raw?.PaymentStatus ||
      raw?.state ||
      raw?.State;

    const normalized = typeof status === "string" ? status.toLowerCase() : "";

    if (normalized === "approved" || normalized === "success" || normalized === "succeeded") {
      return "approved";
    }

    if (normalized === "declined" || normalized === "failed" || normalized === "error") {
      return "declined";
    }

    if (normalized === "pending" || normalized === "processing") {
      return "pending";
    }

    return "error";
  }

  async initCreditRefill(
    params: InitCreditRefillParams
  ): Promise<InitCreditRefillResult> {
    if (!this.initUrl) {
      throw new Error(
        "FASTBANK_PAYMENT_INIT_URL is not configured. Please set it in the environment."
      );
    }

    const body: Record<string, any> = {
      amount: params.amount,
      currency: params.currency,
      orderId: params.orderId,
      callbackUrl: params.callbackUrl,
      customerId: params.userId.toString(),
      saveCard: params.saveCard,
    };

    const response = await this.http.post(this.initUrl, body, {
      headers: this.getAuthHeaders(),
    });

    const data = response.data || {};

    const paymentUrl =
      data.redirectUrl ||
      data.paymentUrl ||
      data.url ||
      data.checkoutUrl;

    if (!paymentUrl || typeof paymentUrl !== "string") {
      throw new Error(
        "Fast Bank init response did not contain a redirect URL (expected one of redirectUrl, paymentUrl, url, checkoutUrl)."
      );
    }

    return {
      orderId: params.orderId,
      providerOrderId: data.orderId || data.OrderId || data.id,
      providerPaymentId:
        data.paymentId || data.PaymentId || data.paymentID || data.PaymentID,
      paymentUrl,
      raw: data,
    };
  }

  async makeBindingPayment(
    params: BindingPaymentParams
  ): Promise<BindingPaymentResult> {
    if (!this.bindingPaymentUrl) {
      throw new Error(
        "FASTBANK_BINDING_PAYMENT_URL is not configured. Please set it in the environment."
      );
    }

    const body: Record<string, any> = {
      amount: params.amount,
      currency: params.currency,
      bindingToken: params.bindingToken,
      customerId: params.userId.toString(),
    };

    const response = await this.http.post(this.bindingPaymentUrl, body, {
      headers: this.getAuthHeaders(),
    });

    const data = response.data || {};
    const status = this.mapStatus(data);

    const success =
      data.success === true ||
      status === "approved";

    const amountCharged =
      data.amount ||
      data.chargedAmount ||
      data.totalAmount ||
      params.amount;

    const message =
      data.message ||
      data.description ||
      data.info ||
      (success ? "Payment successful" : "Payment failed");

    return {
      success,
      message,
      providerPaymentId:
        data.paymentId || data.PaymentId || data.paymentID || data.PaymentID,
      amountCharged,
      raw: data,
    };
  }

  async getPaymentDetails(paymentId: string): Promise<PaymentDetailsResult> {
    if (!this.statusUrl) {
      throw new Error(
        "FASTBANK_PAYMENT_STATUS_URL is not configured. Please set it in the environment."
      );
    }

    const body: Record<string, any> = {
      paymentId,
    };

    const response = await this.http.post(this.statusUrl, body, {
      headers: this.getAuthHeaders(),
    });

    const data = response.data || {};
    const status = this.mapStatus(data);

    const amount =
      data.amount || data.totalAmount || data.depositedAmount || undefined;
    const currency = data.currency || data.Currency || undefined;

    return {
      status,
      amount,
      currency,
      raw: data,
    };
  }

  async cancelPayment(
    paymentId: string,
    orderId?: string
  ): Promise<CancelPaymentResult> {
    if (!this.cancelUrl) {
      throw new Error(
        "FASTBANK_CANCEL_URL is not configured. Please set it in the environment."
      );
    }

    const body: Record<string, any> = {
      paymentId,
    };

    if (orderId) {
      body.orderId = orderId;
    }

    const response = await this.http.post(this.cancelUrl, body, {
      headers: this.getAuthHeaders(),
    });

    const data = response.data || {};
    const status = this.mapStatus(data);

    const success =
      data.success === true ||
      status === "approved";

    const message =
      data.message ||
      data.description ||
      data.info ||
      (success ? "Payment canceled successfully" : "Payment cancel failed");

    return {
      success,
      message,
      raw: data,
    };
  }

  async refundPayment(
    paymentId: string,
    orderId?: string,
    amount?: number
  ): Promise<RefundPaymentResult> {
    if (!this.refundUrl) {
      throw new Error(
        "FASTBANK_REFUND_URL is not configured. Please set it in the environment."
      );
    }

    const body: Record<string, any> = {
      paymentId,
    };

    if (orderId) {
      body.orderId = orderId;
    }
    if (amount !== undefined) {
      body.amount = amount;
    }

    const response = await this.http.post(this.refundUrl, body, {
      headers: this.getAuthHeaders(),
    });

    const data = response.data || {};
    const status = this.mapStatus(data);

    const success =
      data.success === true ||
      status === "approved";

    const message =
      data.message ||
      data.description ||
      data.info ||
      (success ? "Payment refunded successfully" : "Payment refund failed");

    return {
      success,
      message,
      raw: data,
    };
  }
}

