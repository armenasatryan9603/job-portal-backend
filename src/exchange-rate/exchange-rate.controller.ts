import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ExchangeRateService } from "./exchange-rate.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("exchange-rate")
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Get exchange rate between two currencies
   * GET /exchange-rate?from=USD&to=EUR
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getExchangeRate(
    @Query("from") from: string,
    @Query("to") to: string
  ) {
    if (!from || !to) {
      return {
        success: false,
        error: "Both 'from' and 'to' currency codes are required",
      };
    }

    try {
      const rate = await this.exchangeRateService.getExchangeRate(from, to);
      return {
        success: true,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch exchange rate",
      };
    }
  }

  /**
   * Convert amount from one currency to another
   * GET /exchange-rate/convert?amount=100&from=USD&to=EUR
   */
  @Get("convert")
  @UseGuards(JwtAuthGuard)
  async convertAmount(
    @Query("amount") amount: string,
    @Query("from") from: string,
    @Query("to") to: string
  ) {
    if (!amount || !from || !to) {
      return {
        success: false,
        error: "Amount, 'from', and 'to' currency codes are required",
      };
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return {
        success: false,
        error: "Amount must be a positive number",
      };
    }

    try {
      const convertedAmount = await this.exchangeRateService.convertAmount(
        amountNum,
        from,
        to
      );
      const rate = await this.exchangeRateService.getExchangeRate(from, to);

      return {
        success: true,
        originalAmount: amountNum,
        originalCurrency: from.toUpperCase(),
        convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimals
        convertedCurrency: to.toUpperCase(),
        exchangeRate: rate,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to convert amount",
      };
    }
  }
}
