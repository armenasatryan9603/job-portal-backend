import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreditService } from './credit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('credit')
export class CreditController {
  constructor(private creditService: CreditService) {}

  // Step 1: Initiate payment
  @UseGuards(JwtAuthGuard)
  @Post('refill/initiate')
  async initiate(@Request() req, @Body() body: { amount: number }) {
    return this.creditService.initiatePayment(req.user.userId, body.amount);
  }

  // BackURL callback endpoint (called by AmeriaBank vPOS after payment)
  // Handles both GET (redirect) and POST requests
  @Get('refill/callback')
  async paymentCallback(@Query() query: any) {
    // Handle different parameter name formats (including typo "resposneCode")
    const orderID = query.orderID || query.orderId || query.order_id;
    const responseCode =
      query.responseCode ||
      query.response_code ||
      query.ResponseCode ||
      query.resposneCode;
    const paymentID =
      query.paymentID || query.paymentId || query.payment_id || query.PaymentID;
    const opaque = query.opaque || query.Opaque;

    return this.creditService.handlePaymentCallback(
      orderID,
      responseCode,
      paymentID,
      opaque,
    );
  }

  // Also support POST for flexibility
  @Post('refill/callback')
  async paymentCallbackPost(
    @Body()
    body: {
      orderID: string;
      responseCode: string;
      paymentID: string;
      opaque?: string;
    },
  ) {
    return this.creditService.handlePaymentCallback(
      body.orderID,
      body.responseCode,
      body.paymentID,
      body.opaque,
    );
  }

  // Legacy webhook endpoint (kept for backward compatibility)
  @Post('refill/webhook')
  async webhook(@Body() body: { orderId: string; paidAmount: number }) {
    return this.creditService.handleWebhook(body.orderId, body.paidAmount);
  }
}
