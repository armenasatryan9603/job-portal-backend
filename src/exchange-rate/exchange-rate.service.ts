import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly cache = new Map<
    string,
    { rate: number; timestamp: number }
  >();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly FRANKFURTER_BASE =
    process.env.FRANKFURTER_API_URL || "https://api.frankfurter.app";

  /**
   * Get exchange rate from one currency to another
   * Uses caching to reduce API calls
   * @param from Source currency code (e.g., 'USD', 'EUR', 'RUB', 'AMD')
   * @param to Target currency code
   * @returns Exchange rate (e.g., 1.08 for USD to EUR)
   */
  async getExchangeRate(from: string, to: string): Promise<number> {
    // Normalize currency codes
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    // Same currency, return 1
    if (fromUpper === toUpper) {
      return 1;
    }

    // Check cache
    const cacheKey = `${fromUpper}_${toUpper}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Using cached rate for ${cacheKey}: ${cached.rate}`);
      return cached.rate;
    }

    // Fetch from API with fallbacks
    try {
      const rate = await this.fetchExchangeRate(fromUpper, toUpper);
      this.cache.set(cacheKey, { rate, timestamp: Date.now() });
      this.logger.log(`Fetched exchange rate ${fromUpper} to ${toUpper}: ${rate}`);
      return rate;
    } catch (error) {
      // If we have an expired cache, use it as fallback
      if (cached) {
        this.logger.warn(
          `API failed, using expired cached rate for ${cacheKey}: ${cached.rate}`
        );
        return cached.rate;
      }
      throw error;
    }
  }

  /**
   * Convert amount from one currency to another
   * @param amount Amount to convert
   * @param from Source currency
   * @param to Target currency
   * @returns Converted amount
   */
  async convertAmount(
    amount: number,
    from: string,
    to: string
  ): Promise<number> {
    const rate = await this.getExchangeRate(from, to);
    return amount * rate;
  }

  /**
   * Fetch exchange rate from API with multiple fallback providers
   */
  private async fetchExchangeRate(
    from: string,
    to: string
  ): Promise<number> {
    const providers = [
      {
        name: "Frankfurter",
        url: `${this.FRANKFURTER_BASE}/latest?from=${from}&to=${to}`,
        parser: (data: any) => data?.rates?.[to],
      },
      {
        name: "ExchangeRate-API",
        url: `https://api.exchangerate-api.com/v4/latest/${from}`,
        parser: (data: any) => data?.rates?.[to],
      },
      {
        name: "ExchangeRate-Host",
        url: `https://api.exchangerate.host/latest?base=${from}&symbols=${to}`,
        parser: (data: any) => data?.rates?.[to],
      },
    ];

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const response = await axios.get(provider.url, {
          timeout: 5000,
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 200 && response.data) {
          const rate = provider.parser(response.data);
          if (typeof rate === "number" && rate > 0) {
            this.logger.debug(
              `Successfully fetched rate from ${provider.name}: ${rate}`
            );
            return rate;
          }
        }
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Failed to fetch from ${provider.name}: ${error.message}`
        );
        // Continue to next provider
      }
    }

    // All providers failed
    throw new Error(
      `Failed to fetch exchange rate from all providers. Last error: ${
        lastError?.message || "Unknown error"
      }`
    );
  }

  /**
   * Clear the exchange rate cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log("Exchange rate cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; rate: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      rate: value.rate,
      age: now - value.timestamp,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}
