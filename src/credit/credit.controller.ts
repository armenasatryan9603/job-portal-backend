import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
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

  // Step 2: Webhook endpoint called by vPOS
  @Post('refill/webhook')
  async webhook(@Body() body: { orderId: string; paidAmount: number }) {
    return this.creditService.handleWebhook(body.orderId, body.paidAmount);
  }
}
