import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  UseGuards,
  Logger,
  Res,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreditService } from './credit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreditTransactionsService } from './credit-transactions.service';
import { PrismaService } from '../prisma.service';

@Controller('credit')
export class CreditController {
  private readonly logger = new Logger(CreditController.name);

  constructor(
    private creditService: CreditService,
    private creditTransactionsService: CreditTransactionsService,
    private prisma: PrismaService,
  ) {}

  // Step 1: Initiate payment
  @UseGuards(JwtAuthGuard)
  @Post('refill/initiate')
  async initiate(
    @Request() req,
    @Body() body: { amount: number; currency?: string; cardId?: string; saveCard?: boolean },
  ) {
    // Get user's currency preference if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { currency: true },
    });
    const currency = body.currency || user?.currency || 'USD';

    const result = await this.creditService.initiatePayment(
      req.user.userId,
      body.amount,
      currency,
      body.cardId,
      body.saveCard || false,
    );

    // If using saved card, result is from makeBindingPayment (direct success)
    // If using new card, result contains paymentUrl for webview
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getTransactions(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 20;
    return this.creditTransactionsService.getTransactionsForUser(
      req.user.userId,
      pageNumber,
      limitNumber,
    );
  }

  // BackURL callback endpoint (called by AmeriaBank vPOS after payment)
  // Handles both GET (redirect) and POST requests
  @Get('refill/callback')
  async paymentCallback(@Query() query: any, @Res() res: Response) {
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

    // Use BACKEND_URL for universal links (mobile app is configured to handle this domain)
    const redirectUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectPath = '/profile/refill-credits'; // Adjust to your actual path

    try {
      if (!orderID || !paymentID) {
        this.logger.error(
          `Payment callback missing required parameters. Query: ${JSON.stringify(query)}`
        );
        res.status(400).setHeader('Content-Type', 'text/html').send(
          this.getErrorHtml(
            'Missing payment parameters',
            'The payment callback is missing required parameters. Please contact support.',
            redirectUrl,
            redirectPath
          )
        );
        return;
      }

      const result = await this.creditService.handlePaymentCallback(
        orderID,
        responseCode,
        paymentID,
        opaque,
      );

      // Success - return HTML with auto-redirect
      res.status(200).setHeader('Content-Type', 'text/html').send(
        this.getSuccessHtml(
          'Payment Successful',
          'Your credits have been added successfully!',
          redirectUrl,
          redirectPath
        )
      );
    } catch (error: any) {
      this.logger.error(
        `Payment callback error: ${error.message}. OrderID: ${orderID}, PaymentID: ${paymentID}. Stack: ${error.stack}`
      );
      
      res.status(500).setHeader('Content-Type', 'text/html').send(
        this.getErrorHtml(
          'Payment Processing Error',
          error.message || 'An error occurred while processing your payment. Please contact support.',
          redirectUrl,
          redirectPath
        )
      );
    }
  }

  private getSuccessHtml(
    title: string,
    message: string,
    redirectUrl: string,
    redirectPath: string
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .success-icon {
      font-size: 4rem;
      color: #10b981;
      margin-bottom: 1rem;
    }
    h1 {
      color: #1f2937;
      margin: 0 0 1rem 0;
    }
    p {
      color: #6b7280;
      margin: 0 0 2rem 0;
      line-height: 1.6;
    }
    .info {
      color: #9ca3af;
      font-size: 0.875rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="info">
      You can close this page and return to the app.
    </p>
  </div>
</body>
</html>`;
  }

  private getErrorHtml(
    title: string,
    message: string,
    redirectUrl: string,
    redirectPath: string
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: #333;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .error-icon {
      font-size: 4rem;
      color: #ef4444;
      margin-bottom: 1rem;
    }
    h1 {
      color: #1f2937;
      margin: 0 0 1rem 0;
    }
    p {
      color: #6b7280;
      margin: 0 0 2rem 0;
      line-height: 1.6;
    }
    .info {
      color: #9ca3af;
      font-size: 0.875rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">✗</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="info">
      You can close this page and return to the app.
    </p>
  </div>
</body>
</html>`;
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
    @Res() res: Response,
  ) {
    // Use BACKEND_URL for universal links (mobile app is configured to handle this domain)
    const redirectUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectPath = '/profile/refill-credits';

    try {
      if (!body.orderID || !body.paymentID) {
        this.logger.error(
          `Payment callback POST missing required parameters. Body: ${JSON.stringify(body)}`
        );
        res.status(400).setHeader('Content-Type', 'text/html').send(
          this.getErrorHtml(
            'Missing payment parameters',
            'The payment callback is missing required parameters. Please contact support.',
            redirectUrl,
            redirectPath
          )
        );
        return;
      }

      const result = await this.creditService.handlePaymentCallback(
        body.orderID,
        body.responseCode,
        body.paymentID,
        body.opaque,
      );

      res.status(200).setHeader('Content-Type', 'text/html').send(
        this.getSuccessHtml(
          'Payment Successful',
          'Your credits have been added successfully!',
          redirectUrl,
          redirectPath
        )
      );
    } catch (error: any) {
      this.logger.error(
        `Payment callback POST error: ${error.message}. OrderID: ${body.orderID}, PaymentID: ${body.paymentID}. Stack: ${error.stack}`
      );
      
      res.status(500).setHeader('Content-Type', 'text/html').send(
        this.getErrorHtml(
          'Payment Processing Error',
          error.message || 'An error occurred while processing your payment. Please contact support.',
          redirectUrl,
          redirectPath
        )
      );
    }
  }

  // Cancel payment endpoint
  @UseGuards(JwtAuthGuard)
  @Post('payment/cancel')
  async cancelPayment(
    @Request() req,
    @Body() body: { paymentID: string; orderID: string }
  ) {
    if (!body.paymentID || !body.orderID) {
      throw new BadRequestException("paymentID and orderID are required");
    }
    try {
      return await this.creditService.cancelPayment(body.paymentID, body.orderID);
    } catch (error: any) {
      this.logger.error(`Cancel payment error in controller: ${error.message || error}`);
      this.logger.error(`Error stack: ${error.stack}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Create HttpException with proper error message
      const errorMessage = error?.message || error?.toString() || "Failed to cancel payment";
      const statusCode = error?.status || error?.statusCode || 500;
      
      throw new HttpException(
        {
          statusCode,
          message: errorMessage,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  // Refund payment endpoint
  @UseGuards(JwtAuthGuard)
  @Post('payment/refund')
  async refundPayment(
    @Request() req,
    @Body() body: { paymentID: string; orderID: string; amount?: number }
  ) {
    if (!body.paymentID || !body.orderID) {
      throw new Error("paymentID and orderID are required");
    }
    return this.creditService.refundPayment(body.paymentID, body.orderID, body.amount);
  }

  // Legacy webhook endpoint (kept for backward compatibility)
  @Post('refill/webhook')
  async webhook(@Body() body: { orderId: string; paidAmount: number }) {
    return this.creditService.handleWebhook(body.orderId, body.paidAmount);
  }
}
