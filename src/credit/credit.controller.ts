import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { CreditService } from './credit.service';
import { CreditTransactionsService } from './credit-transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';

@Controller('credit')
export class CreditController {
  private readonly logger = new Logger(CreditController.name);

  constructor(
    private creditService: CreditService,
    private creditTransactionsService: CreditTransactionsService,
    private prisma: PrismaService,
  ) {}

  private get appScheme(): string {
    return process.env.APP_DEEPLINK_SCHEME || 'jobportalmobile';
  }

  // ── Initiate payment ────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('refill/initiate')
  async initiate(
    @Request() req,
    @Body() body: { amount: number; currency?: string; cardId?: string; saveCard?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { currency: true },
    });
    const currency = body.currency || user?.currency || 'USD';

    return this.creditService.initiatePayment(
      req.user.userId,
      body.amount,
      currency,
      body.cardId,
      body.saveCard ?? false,
    );
  }

  // ── Callbacks (called by FastBank after payment) ─────────────────────────────
  // FastBank redirects the user's browser to these URLs.
  // We process the result and immediately deep-link back into the app.

  @Get('refill/callback/success')
  async paymentCallbackSuccess(@Query() query: any, @Res() res: Response) {
    // internalOrderId is our own ID embedded in the returnUrl.
    // orderId / orderID is FastBank's mdOrder UUID appended automatically.
    const internalOrderId = query.internalOrderId;
    const bankOrderId = Array.isArray(query.orderId) ? query.orderId[query.orderId.length - 1] : (query.orderId || query.orderID || query.order_id);
    const paymentID = query.paymentID || query.paymentId || query.payment_id || query.PaymentID;
    const responseCode = query.responseCode || query.response_code || query.ResponseCode || query.resposneCode;

    this.logger.log(`[callback/success] internalOrderId=${internalOrderId} bankOrderId=${bankOrderId} paymentID=${paymentID}`);

    try {
      await this.creditService.handlePaymentCallback(internalOrderId || bankOrderId, responseCode, paymentID, query.opaque);
      return res.redirect(302, `${this.appScheme}://refill?status=success`);
    } catch (error: any) {
      this.logger.error(`[callback/success] processing failed: ${error.message}`);
      return res.redirect(302, `${this.appScheme}://refill?status=error`);
    }
  }

  @Get('refill/callback/failure')
  async paymentCallbackFailure(@Query() query: any, @Res() res: Response) {
    const internalOrderId = query.internalOrderId;
    this.logger.log(`[callback/failure] internalOrderId=${internalOrderId}`);
    return res.redirect(302, `${this.appScheme}://refill?status=error`);
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getTransactions(
    @Request() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.creditTransactionsService.getTransactionsForUser(
      req.user.userId,
      Number.parseInt(page, 10) || 1,
      Number.parseInt(limit, 10) || 20,
    );
  }

  // ── Payment management ───────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('payment/cancel')
  async cancelPayment(
    @Request() req,
    @Body() body: { paymentID: string; orderID: string },
  ) {
    if (!body.paymentID || !body.orderID) {
      throw new BadRequestException('paymentID and orderID are required');
    }
    return this.creditService.cancelPayment(body.paymentID, body.orderID);
  }

  @UseGuards(JwtAuthGuard)
  @Post('payment/refund')
  async refundPayment(
    @Request() req,
    @Body() body: { paymentID: string; orderID: string; amount?: number },
  ) {
    if (!body.paymentID || !body.orderID) {
      throw new BadRequestException('paymentID and orderID are required');
    }
    return this.creditService.refundPayment(body.paymentID, body.orderID, body.amount);
  }
}
