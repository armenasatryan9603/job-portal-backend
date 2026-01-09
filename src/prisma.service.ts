import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Global,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Global()
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static isConnected = false;
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxRetries = 5;
  private readonly retryDelay = 2000; // 2 seconds

  constructor() {
    super({
      log: ["query", "info", "warn", "error"],
      errorFormat: "pretty",
    });
  }

  async onModuleInit() {
    // Only connect once
    if (!PrismaService.isConnected) {
      await this.connectWithRetry();
      // } else {
      // this.logger.log("Already connected to database");
    }
  }

  private async connectWithRetry(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log(
          `Connecting to database... (Attempt ${attempt}/${this.maxRetries})`
        );

        // Test connection with a simple query
        await this.$connect();

        // Verify connection with a simple query
        await this.$queryRaw`SELECT 1`;

        PrismaService.isConnected = true;
        this.logger.log("✅ Connected to database successfully");
        return;
      } catch (error) {
        lastError = error as Error;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `❌ Database connection attempt ${attempt}/${this.maxRetries} failed: ${errorMessage}`
        );

        // If it's the last attempt, don't wait
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          this.logger.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    this.logger.error(
      `❌ Failed to connect to database after ${this.maxRetries} attempts`
    );
    this.logger.error("Last error:", lastError);

    // Provide helpful error message
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const urlObj = new URL(dbUrl);
      this.logger.error(`Database host: ${urlObj.hostname}`);
      this.logger.error(`Database port: ${urlObj.port || "5432"}`);
      this.logger.error("Please check:");
      this.logger.error("1. Database server is running");
      this.logger.error("2. DATABASE_URL is correct");
      this.logger.error("3. Network connectivity");
      this.logger.error("4. Firewall/security group settings");
      this.logger.error(
        "5. SSL/TLS configuration (for Neon, add ?sslmode=require)"
      );
    } else {
      this.logger.error("DATABASE_URL environment variable is not set!");
    }

    throw lastError || new Error("Failed to connect to database");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy() {
    if (PrismaService.isConnected) {
      this.logger.log("Disconnecting from database...");
      try {
        await this.$disconnect();
        PrismaService.isConnected = false;
        this.logger.log("Disconnected from database");
      } catch (error) {
        this.logger.error("Error disconnecting from database:", error);
      }
    }
  }

  /**
   * Health check method to verify database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error("Database health check failed:", error);
      return false;
    }
  }
}
