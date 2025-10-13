import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private prisma: PrismaService) {}

  private readonly vposUrl =
    process.env.AMERIABANK_VPOS_URL ||
    'https://services.ameriabank.am/VPOS/api/VPOS/InitPayment';
  private readonly vposStatusUrl =
    process.env.AMERIABANK_VPOS_STATUS_URL ||
    'https://services.ameriabank.am/VPOS/api/VPOS/GetPaymentDetails';

  private readonly credentials = {
    clientId: process.env.AMERIABANK_CLIENT_ID,
    username: process.env.AMERIABANK_USERNAME,
    password: process.env.AMERIABANK_PASSWORD,
  };

  // 1️⃣ Initiate payment
  async initiatePayment(userId: number, amount: number) {
    const orderId = `${userId}-${Date.now()}`;

    const payload = {
      ClientID: this.credentials.clientId,
      ClientUsr: this.credentials.username,
      ClientPass: this.credentials.password,
      Amount: amount,
      OrderID: orderId,
      // Optional: ReturnURL, FailURL, Description
    };

    const response = await axios.post(this.vposUrl, payload);
    this.logger.log(`Initiated payment for user ${userId} amount ${amount}`);
    return { orderId, paymentData: response.data };
  }

  // 2️⃣ Handle webhook / confirm payment
  async handleWebhook(orderId: string, paidAmount: number) {
    const userId = parseInt(orderId.split('-')[0]);

    // Verify with vPOS API (optional, recommended)
    const verifyPayload = {
      ClientID: this.credentials.clientId,
      ClientUsr: this.credentials.username,
      ClientPass: this.credentials.password,
      OrderID: orderId,
    };
    const verifyResponse = await axios.post(this.vposStatusUrl, verifyPayload);

    if (verifyResponse.data.Status !== 'Approved') {
      this.logger.warn(`Payment ${orderId} not approved`);
      throw new Error('Payment not approved');
    }

    // Update user credits
    await this.prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: paidAmount } },
    });

    this.logger.log(`Credits added to user ${userId}: ${paidAmount}`);
    return { message: 'Credits added successfully' };
  }
}
