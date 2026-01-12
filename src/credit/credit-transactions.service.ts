import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export interface LogCreditTransactionParams {
  userId: number;
  amount: number;
  balanceAfter: number;
  type: string;
  status?: string;
  description?: string;
  referenceId?: string | null;
  referenceType?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  // Currency conversion fields
  currency?: string | null;
  baseCurrency?: string | null;
  exchangeRate?: number | null;
  originalAmount?: number | null;
  convertedAmount?: number | null;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class CreditTransactionsService {
  constructor(private prisma: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient): PrismaClientOrTx {
    return (tx as Prisma.TransactionClient) || this.prisma;
  }

  async logTransaction({
    userId,
    amount,
    balanceAfter,
    type,
    status = "completed",
    description,
    referenceId,
    referenceType,
    metadata,
    currency,
    baseCurrency,
    exchangeRate,
    originalAmount,
    convertedAmount,
    tx,
  }: LogCreditTransactionParams) {
    const client = this.getClient(tx) as any;

    return client.creditTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter,
        type,
        status,
        description,
        referenceId,
        referenceType,
        metadata,
        currency,
        baseCurrency,
        exchangeRate,
        originalAmount,
        convertedAmount,
      },
    });
  }

  async getTransactionsForUser(
    userId: number,
    page: number = 1,
    limit: number = 20
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    const [transactions, total] = await Promise.all([
      (this.prisma as any).creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      (this.prisma as any).creditTransaction.count({
        where: { userId },
      }),
    ]);

    return {
      transactions,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNextPage: safePage * safeLimit < total,
        hasPrevPage: safePage > 1,
      },
    };
  }
}
