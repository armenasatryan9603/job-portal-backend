import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreditController } from "./credit.controller";
import { CreditService } from "./credit.service";
import { CreditTransactionsService } from "./credit-transactions.service";

@Module({
  controllers: [CreditController],
  providers: [CreditService, CreditTransactionsService, PrismaService],
  exports: [CreditService, CreditTransactionsService],
})
export class CreditModule {}
