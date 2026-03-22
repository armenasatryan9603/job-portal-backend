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

  // ── Initiate payment ────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('refill/initiate')
  async initiate(
    @Request() req,
    @Body() body: {
      amount: number;
      currency?: string;
      cardId?: string;
      clientBrowserInfo?: {
        screenWidth: number;
        screenHeight: number;
        browserLanguage: string;
        browserTimeZoneOffset: number;
      };
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { currency: true },
    });
    const currency = body.currency || user?.currency || 'USD';

    const clientIp: string | undefined =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined;

    return this.creditService.initiatePayment(
      req.user.userId,
      body.amount,
      currency,
      body.cardId,
      clientIp,
      body.clientBrowserInfo,
    );
  }

  // ── 3DS challenge bridge ─────────────────────────────────────────────────────
  // The ACS endpoint (bank OTP page) requires a POST with `creq`.
  // expo-web-browser can only open URLs via GET, so we serve an auto-submitting
  // HTML form that forwards the browser to the ACS URL via POST.

  @Get('3ds/challenge')
  threeDsChallenge(@Query() query: any, @Res() res: Response) {
    const { acsUrl, cReq } = query;
    if (!acsUrl || !cReq) {
      return res.status(400).send('Missing acsUrl or cReq');
    }
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<form id="f" method="POST" action="${acsUrl}">
  <input type="hidden" name="creq" value="${cReq}">
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`;
    return res.setHeader('Content-Type', 'text/html').send(html);
  }

  // ── Payment callbacks ────────────────────────────────────────────────────────
  // FastBank redirects the user's browser here after payment.
  // We process the result then open the app via custom URL scheme.

  // Unified callback for binding payments (clean URL, no query params in returnUrl)
  @Get('refill/callback')
  async bindingPaymentCallback(@Query() query: any, @Res() res: Response) {
    const bankOrderId = query.orderId || query.mdOrder || query.orderID;
    try {
      await this.creditService.handleBindingCallback(bankOrderId);
      return res.setHeader('Content-Type', 'text/html').send(deepLinkPage('success'));
    } catch (error: any) {
      this.logger.error(`[refill/callback] binding payment failed: ${error.message}`);
      return res.setHeader('Content-Type', 'text/html').send(deepLinkPage('error', error.message));
    }
  }

  @Get('refill/callback/success')
  async paymentCallbackSuccess(@Query() query: any, @Res() res: Response) {
    const internalOrderId = query.internalOrderId;
    // FastBank appends its mdOrder UUID as orderId to the returnUrl
    const bankOrderId = query.orderId;
    const responseCode = query.responseCode || query.response_code || query.ResponseCode || query.resposneCode;

    try {
      await this.creditService.handlePaymentCallback(
        internalOrderId,
        bankOrderId,
        responseCode,
      );
      return res.setHeader('Content-Type', 'text/html').send(deepLinkPage('success'));
    } catch (error: any) {
      this.logger.error(`[callback/success] processing failed: ${error.message}`);
      return res.setHeader('Content-Type', 'text/html').send(deepLinkPage('error'));
    }
  }

  @Get('refill/callback/failure')
  async paymentCallbackFailure(@Query() query: any, @Res() res: Response) {
    this.logger.log(`[callback/failure] internalOrderId=${query.internalOrderId}`);
    return res.setHeader('Content-Type', 'text/html').send(deepLinkPage('error'));
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

//   @UseGuards(JwtAuthGuard)
//   @Post('payment/cancel')
//   async cancelPayment(
//     @Request() req,
//     @Body() body: { paymentID: string; orderID: string },
//   ) {
//     if (!body.paymentID || !body.orderID) {
//       throw new BadRequestException('paymentID and orderID are required');
//     }
//     return this.creditService.cancelPayment(body.paymentID, body.orderID);
//   }

//   @UseGuards(JwtAuthGuard)
//   @Post('payment/refund')
//   async refundPayment(
//     @Request() req,
//     @Body() body: { paymentID: string; orderID: string; amount?: number },
//   ) {
//     if (!body.paymentID || !body.orderID) {
//       throw new BadRequestException('paymentID and orderID are required');
//     }
//     return this.creditService.refundPayment(body.paymentID, body.orderID, body.amount);
//   }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deepLinkPage(status: 'success' | 'error', errorMsg?: string): string {
  const scheme = process.env.APP_DEEPLINK_SCHEME || 'jobportalmobile';
  let url = `${scheme}://profile/payment/payments?refillStatus=${status}`;
  if (status === 'error' && errorMsg) {
    url += `&errorDetail=${encodeURIComponent(errorMsg)}`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=${url}">
<script>window.location='${url}';</script>
</head><body></body></html>`;
}
