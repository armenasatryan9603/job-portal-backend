export type PaymentStatus = "approved" | "declined" | "pending" | "error";

export interface InitCreditRefillParams {
  userId: number;
  amount: number;
  currency: string;
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
  // 3DS challenge fields — present when the bank requires OTP verification
  requires3ds?: boolean;
  challengeUrl?: string;
  cReq?: string;
  orderNumber?: string;
}

export interface PaymentDetailsResult {
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  raw: any;
}

// export interface CancelPaymentResult {
//   success: boolean;
//   message: string;
//   raw: any;
// }

// export interface RefundPaymentResult {
//   success: boolean;
//   message: string;
//   raw: any;
// }

export interface PaymentProvider {
  initCreditRefill(
    params: InitCreditRefillParams
  ): Promise<InitCreditRefillResult>;

  makeBindingPayment(
    params: BindingPaymentParams
  ): Promise<BindingPaymentResult>;

  getPaymentDetails(paymentId: string, apiKey?: string): Promise<PaymentDetailsResult>;

//   cancelPayment(
//     paymentId: string,
//     orderId?: string
//   ): Promise<CancelPaymentResult>;

//   refundPayment(
//     paymentId: string,
//     orderId?: string,
//     amount?: number
//   ): Promise<RefundPaymentResult>;
}
