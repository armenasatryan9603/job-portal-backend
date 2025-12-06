import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get max peers per application from database or environment variable
   * Default: 5
   */
  async getMaxPeersPerApplication(): Promise<number> {
    try {
      // Try to get from database first
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: "maxPeersPerApplication" },
      });

      if (config) {
        const value = parseInt(config.value, 10);
        if (!isNaN(value) && value > 0) {
          return value;
        }
      }

      // Fallback to environment variable
      const envValue = process.env.MAX_PEERS_PER_APPLICATION;
      if (envValue) {
        const value = parseInt(envValue, 10);
        if (!isNaN(value) && value > 0) {
          return value;
        }
      }

      // Default value
      return 5;
    } catch (error) {
      this.logger.warn(
        "Error getting maxPeersPerApplication config, using default: 5",
        error
      );
      return 5;
    }
  }

  /**
   * Set max peers per application
   */
  async setMaxPeersPerApplication(value: number): Promise<void> {
    if (value <= 0) {
      throw new Error("maxPeersPerApplication must be greater than 0");
    }

    await this.prisma.systemConfig.upsert({
      where: { key: "maxPeersPerApplication" },
      update: { value: value.toString() },
      create: {
        key: "maxPeersPerApplication",
        value: value.toString(),
        description: "Maximum number of peers that can be included in a group application",
      },
    });
  }
}

