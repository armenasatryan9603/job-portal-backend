import { BindingPaymentParams, BindingPaymentResult, InitCreditRefillParams, InitCreditRefillResult, PaymentDetailsResult, PaymentProvider, PaymentStatus } from "./types";
import axios, { AxiosInstance } from "axios";

export class FastBankPaymentProvider implements PaymentProvider {
  private readonly http: AxiosInstance;

  private readonly initUrl: string;
  private readonly statusUrl: string;
  // private readonly bindingInitUrl: string;
  private readonly bindingPaymentUrl: string;
  // private readonly cancelUrl: string;
  // private readonly refundUrl: string;

  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  // private readonly merchantId?: string;

  constructor() {
    this.initUrl = process.env.FASTBANK_PAYMENT_INIT_URL || "";
    this.statusUrl = process.env.FASTBANK_PAYMENT_STATUS_URL || "";
    // this.bindingInitUrl =
    //   process.env.FASTBANK_BINDING_INIT_URL || this.initUrl;
    this.bindingPaymentUrl =
      process.env.FASTBANK_BINDING_PAYMENT_URL || this.initUrl;
      
    // this.cancelUrl = process.env.FASTBANK_CANCEL_URL || "";
    // this.refundUrl = process.env.FASTBANK_REFUND_URL || "";

    this.apiKey = process.env.FASTBANK_API_KEY;
    this.apiSecret = process.env.FASTBANK_API_SECRET;
    // this.merchantId = process.env.FASTBANK_MERCHANT_ID;

    this.http = axios.create({
      timeout: 30000,
    });
  }

  private toForm(obj: Record<string, string | number | undefined>): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    }
    return params;
  }

  // private getAuthHeaders(): Record<string, string> {
  //   const headers: Record<string, string> = {
  //     "Content-Type": "application/json",
  //     Accept: "application/json",
  //   };

  //   if (this.apiKey) {
  //     headers["X-Api-Key"] = this.apiKey;
  //   }
  //   if (this.apiSecret) {
  //     headers["X-Api-Secret"] = this.apiSecret;
  //   }
  //   if (this.merchantId) {
  //     headers["X-Merchant-Id"] = this.merchantId;
  //   }

  //   return headers;
  // }

  private mapStatus(raw: any): PaymentStatus {
    const rawErrorCode = raw?.errorCode ?? raw?.ErrorCode;
    const errorCodeNum = rawErrorCode !== undefined ? Number(rawErrorCode) : undefined;

    const orderStatus: number | undefined =
      raw?.orderStatusCode ?? raw?.OrderStatus ?? raw?.orderStatus;

    if (errorCodeNum === 0 && orderStatus === 2) return "approved";
    if (errorCodeNum === 0) return "approved";
    if (errorCodeNum !== undefined && errorCodeNum !== 0) return "declined";
    if (orderStatus === 2) return "approved";
    if (orderStatus === 3 || orderStatus === 4 || orderStatus === 6) return "declined";
    if (orderStatus === 0 || orderStatus === 1 || orderStatus === 5) return "pending";

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
      clientId: process.env.FASTBANK_BINDING_API_KEY || '',
    };

    const response = await this.http.post(this.initUrl, this.toForm(body), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    const data = response.data || {};

    if (!data.formUrl || typeof data.formUrl !== "string") {
      const errCode = data.errorCode !== undefined ? data.errorCode : '';
      const errMsg = data.errorMessage || data.description || data.error || '';
      throw new Error(
        `Payment initiation failed${errCode !== '' ? ` (errorCode: ${errCode})` : ''}: ${errMsg || 'No payment URL returned'}`
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

  async makeBindingPayment(
    params: BindingPaymentParams
  ): Promise<BindingPaymentResult> {
    if (!this.initUrl) {
      throw new Error(
        "FASTBANK_PAYMENT_INIT_URL is not configured. Please set it in the environment."
      );
    }
    if (!this.bindingPaymentUrl) {
      throw new Error(
        "FASTBANK_BINDING_PAYMENT_URL is not configured. Please set it in the environment."
      );
    }

    // Step 1: register the order via register.do to obtain mdOrder
    const backendUrl = process.env.BACKEND_URL;
    const returnUrl = `${backendUrl}/credit/refill/callback`;

    const registerBody: Record<string, string | number> = {
      amount: params.amount,
      currency: '051',
      orderNumber: `binding-${params.userId}-${Date.now()}`,
      returnUrl,
      failUrl: returnUrl,
      userName: process.env.FASTBANK_BINDING_API_KEY || '',
      password: this.apiSecret || '',
      clientId: process.env.FASTBANK_BINDING_API_KEY || '',
    };

    const registerResponse = await this.http.post(this.initUrl, this.toForm(registerBody), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const registerData = registerResponse.data || {};

    const mdOrder = registerData.orderId;
    if (!mdOrder) {
      throw new Error(
        `Failed to register order for binding payment: ${registerData.errorMessage || JSON.stringify(registerData)}`
      );
    }

    // Step 2: charge the saved card via paymentOrderBinding.do
    const payBody: Record<string, string> = {
      userName: process.env.FASTBANK_BINDING_API_KEY || '',
      password: this.apiSecret || '',
      mdOrder,
      bindingId: params.bindingToken,
      clientBrowserInfo: JSON.stringify({
        userAgent: "HotworkApp/1.0",
        colorDepth: "24",
        screenHeight: params.clientBrowserInfo?.screenHeight ?? 720,
        screenWidth: params.clientBrowserInfo?.screenWidth ?? 1280,
        javaEnabled: false,
        browserLanguage: params.clientBrowserInfo?.browserLanguage ?? "en-US",
        browserTimeZoneOffset: params.clientBrowserInfo?.browserTimeZoneOffset ?? -180,
        browserAcceptHeader: "application/json, */*",
        browserIpAddress: params.clientIp ?? "1.2.3.4",
        javascriptEnabled: true,
      })
    };

    console.log('3333333333333333333333333333333333', payBody, this.bindingPaymentUrl);

    const response = await this.http.post(this.bindingPaymentUrl, this.toForm(payBody), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = response.data || {};
    const orderNumber = registerBody.orderNumber as string;

    // 3DS challenge — bank requires OTP verification before completing payment
    if (data.acsUrl) {
      return {
        success: false,
        message: data.info || 'Requires 3DS authentication',
        providerPaymentId: mdOrder,
        amountCharged: params.amount,
        raw: data,
        requires3ds: true,
        challengeUrl: data.acsUrl,
        cReq: data.cReq,
        orderNumber,
      };
    }

    return {
      success: Number(data.errorCode) === 0,
      message: data.info || (Number(data.errorCode) === 0 ? 'Payment successful' : 'Payment failed'),
      providerPaymentId: mdOrder,
      amountCharged: params.amount,
      raw: data,
      orderNumber,
    };
  }

  async getPaymentDetails(paymentId: string, apiKey?: string): Promise<PaymentDetailsResult> {
    if (!this.statusUrl) {
      throw new Error(
        "FASTBANK_PAYMENT_STATUS_URL is not configured. Please set it in the environment."
      );
    }

    const body: Record<string, string> = {
      orderId: paymentId,
      userName: apiKey || this.apiKey || '',
      password: this.apiSecret || '',
    };

    const response = await this.http.post(this.statusUrl, this.toForm(body), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = response.data || {};
    const status = this.mapStatus(data);

    // FastBank returns amounts in minor units (e.g. AMD tiyn).
    // depositAmount = actually captured; Amount = authorized.
    const amount = data.Amount ?? undefined;
    const currency = data.currency || undefined;
    
    return {
      status,
      amount,
      currency,
      raw: data,
    };
  }

  // async cancelPayment(
  //   paymentId: string,
  //   orderId?: string
  // ): Promise<CancelPaymentResult> {
  //   if (!this.cancelUrl) {
  //     throw new Error(
  //       "FASTBANK_CANCEL_URL is not configured. Please set it in the environment."
  //     );
  //   }

  //   const body: Record<string, any> = {
  //     paymentId,
  //   };

  //   if (orderId) {
  //     body.orderId = orderId;
  //   }

  //   const response = await this.http.post(this.cancelUrl, body, {
  //     headers: this.getAuthHeaders(),
  //   });

  //   const data = response.data || {};
  //   const status = this.mapStatus(data);

  //   const success =
  //     data.success === true ||
  //     status === "approved";

  //   const message =
  //     data.message ||
  //     data.description ||
  //     data.info ||
  //     (success ? "Payment canceled successfully" : "Payment cancel failed");

  //   return {
  //     success,
  //     message,
  //     raw: data,
  //   };
  // }

  // async refundPayment(
  //   paymentId: string,
  //   orderId?: string,
  //   amount?: number
  // ): Promise<RefundPaymentResult> {
  //   if (!this.refundUrl) {
  //     throw new Error(
  //       "FASTBANK_REFUND_URL is not configured. Please set it in the environment."
  //     );
  //   }

  //   const body: Record<string, any> = {
  //     paymentId,
  //   };

  //   if (orderId) {
  //     body.orderId = orderId;
  //   }
  //   if (amount !== undefined) {
  //     body.amount = amount;
  //   }

  //   const response = await this.http.post(this.refundUrl, body, {
  //     headers: this.getAuthHeaders(),
  //   });

  //   const data = response.data || {};
  //   const status = this.mapStatus(data);

  //   const success =
  //     data.success === true ||
  //     status === "approved";

  //   const message =
  //     data.message ||
  //     data.description ||
  //     data.info ||
  //     (success ? "Payment refunded successfully" : "Payment refund failed");

  //   return {
  //     success,
  //     message,
  //     raw: data,
  //   };
  // }
}

