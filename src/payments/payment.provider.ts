import axios, { AxiosInstance } from "axios";

export type PaymentStatus = "approved" | "declined" | "pending" | "error";

export interface InitCreditRefillParams {
  userId: number;
  amount: number;
  currency: string;
  saveCard: boolean;
  orderId: string;
  returnUrl: string;
  failUrl: string;
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
  private readonly bindingInitUrl: string;
  private readonly bindingPaymentUrl: string;
  private readonly cancelUrl: string;
  private readonly refundUrl: string;

  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly merchantId?: string;

  constructor() {
    this.initUrl = process.env.FASTBANK_PAYMENT_INIT_URL || "";
    this.statusUrl = process.env.FASTBANK_PAYMENT_STATUS_URL || "";
    this.bindingInitUrl =
      process.env.FASTBANK_BINDING_INIT_URL || this.initUrl;
    this.bindingPaymentUrl =
      process.env.FASTBANK_BINDING_PAYMENT_URL || this.initUrl;
      
    this.cancelUrl = process.env.FASTBANK_CANCEL_URL || "";
    this.refundUrl = process.env.FASTBANK_REFUND_URL || "";

    this.apiKey = process.env.FASTBANK_API_KEY;
    this.apiSecret = process.env.FASTBANK_API_SECRET;
    // this.merchantId = process.env.FASTBANK_MERCHANT_ID;

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

    const body: Record<string, string | number> = {
      amount: params.amount,
      currency: '051',
      orderNumber: params.orderId + Math.random().toString(36).substring(2, 15),
      returnUrl: params.returnUrl,
      failUrl: params.failUrl,
      userName: this.apiKey || '',
      password: this.apiSecret || '',
    };

    const response = await this.http.post(this.initUrl, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    const data = response.data || {};

    if (!data.formUrl || typeof data.formUrl !== "string") {
      throw new Error(
        "Fast Bank init response did not contain a redirect URL (expected one of redirectUrl, paymentUrl, url, checkoutUrl)."
      );
    }

    return {
      orderId: params.orderId,
      providerOrderId: data.orderId || data.OrderId || data.id,
      providerPaymentId:
        data.paymentId || data.PaymentId || data.paymentID || data.PaymentID,
      paymentUrl: data.formUrl,
      raw: data,
    };
  }

  /**
   * Create a FastBank binding using full card details (PAN, expiry, CVV).
   * NOTE: This requires the backend to handle PCI-sensitive data and must be
   * aligned with the actual FastBank / EPG binding API specification.
   */
  async createCardBindingFromDetails(params: {
    userId: number;
    cardNumber: string;
    expMonth: number;
    expYear: number;
    cvv: string;
  }): Promise<{
    bindingId: string;
    cardHolderId?: string;
    maskedPan?: string;
    expDate?: string;
    raw: any;
  }> {
    if (!this.bindingInitUrl) {
      throw new Error(
        "FASTBANK_BINDING_INIT_URL is not configured. Please set it in the environment."
      );
    }

    const body: Record<string, any> = {
      // These field names are placeholders; update them to match
      // the FastBank binding API you have from the acquirer.
      pan: params.cardNumber,
      expMonth: params.expMonth,
      expYear: params.expYear,
      cvv: params.cvv,
      customerId: params.userId.toString(),
      mode: "bind_only",
    };

    const response = await this.http.post(this.bindingInitUrl, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    const data = response.data || {};

    const bindingId =
      data.bindingId ||
      data.BindingID ||
      data.cardToken ||
      data.card_token;

    if (!bindingId || typeof bindingId !== "string") {
      throw new Error(
        "Fast Bank binding response did not contain a binding identifier (expected one of bindingId, BindingID, cardToken, card_token)."
      );
    }

    const cardHolderId =
      data.cardHolderId ||
      data.CardHolderID ||
      data.card_holder_id;

    const maskedPan =
      data.cardNumber ||
      data.CardNumber ||
      data.maskedPan;

    const expDate =
      data.expiryDate ||
      data.expirationDate ||
      data.ExpDate;

    return {
      bindingId,
      cardHolderId,
      maskedPan,
      expDate,
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

    console.log('444444444444444444444444444444444444444444444444444444444444444');
    

    // FastBank's getOrderStatus.do expects `orderId` (the mdOrder UUID)
    const body: Record<string, any> = {
      orderId: paymentId,
      userName: this.apiKey || '',
      password: this.apiSecret || '',
    };

    const response = await this.http.post(this.statusUrl, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

