import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreditController } from "./credit.controller";
import { CreditService } from "./credit.service";
import { CreditTransactionsService } from "./credit-transactions.service";
import { ExchangeRateModule } from "../exchange-rate/exchange-rate.module";

@Module({
  imports: [ExchangeRateModule],
  controllers: [CreditController],
  providers: [CreditService, CreditTransactionsService, PrismaService],
  exports: [CreditService, CreditTransactionsService, PrismaService],
})
export class CreditModule {}
