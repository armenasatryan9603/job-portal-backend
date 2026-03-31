import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { OrdersService } from "./orders.service";
import { UsersService } from "../users/users.service";

/**
 * One-time backfill service to generate pgvector embeddings for all existing
 * orders and specialist users that don't yet have embeddings.
 *
 * Trigger via the admin endpoint:
 *   POST /orders/admin/backfill-embeddings
 *
 * The job runs in batches to avoid exhausting the OpenAI rate limit.
 */
@Injectable()
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);
  private readonly BATCH_SIZE = 10;
  private readonly DELAY_MS = 500; // pause between batches to stay within rate limits

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private usersService: UsersService
  ) {}

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Backfill embeddings for all orders that have no embedding yet.
   * Returns counts of processed and failed records.
   */
  async backfillOrderEmbeddings(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    // Fetch ids of orders without embeddings
    const orders: Array<{ id: number }> = await this.prisma.$queryRaw`
      SELECT id FROM "Order"
      WHERE "deletedAt" IS NULL
        AND status NOT IN ('draft', 'rejected')
        AND embedding IS NULL
      ORDER BY id ASC
    `;

    this.logger.log(`Backfilling embeddings for ${orders.length} orders`);

    for (let i = 0; i < orders.length; i += this.BATCH_SIZE) {
      const batch = orders.slice(i, i + this.BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ id }) => {
          try {
            await this.ordersService.storeOrderEmbedding(id);
            processed++;
          } catch (error) {
            this.logger.warn(`Failed to embed order ${id}: ${error instanceof Error ? error.message : String(error)}`);
            failed++;
          }
        })
      );
      if (i + this.BATCH_SIZE < orders.length) {
        await this.sleep(this.DELAY_MS);
      }
    }

    this.logger.log(`Order embeddings backfill done. Processed: ${processed}, Failed: ${failed}`);
    return { processed, failed };
  }

  /**
   * Backfill embeddings for all specialists without embeddings.
   */
  async backfillUserEmbeddings(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    const users: Array<{ id: number }> = await this.prisma.$queryRaw`
      SELECT id FROM "User"
      WHERE "deletedAt" IS NULL
        AND role = 'specialist'
        AND embedding IS NULL
      ORDER BY id ASC
    `;

    this.logger.log(`Backfilling embeddings for ${users.length} specialists`);

    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const batch = users.slice(i, i + this.BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ id }) => {
          try {
            await this.usersService.storeUserEmbedding(id);
            processed++;
          } catch (error) {
            this.logger.warn(`Failed to embed user ${id}: ${error instanceof Error ? error.message : String(error)}`);
            failed++;
          }
        })
      );
      if (i + this.BATCH_SIZE < users.length) {
        await this.sleep(this.DELAY_MS);
      }
    }

    this.logger.log(`User embeddings backfill done. Processed: ${processed}, Failed: ${failed}`);
    return { processed, failed };
  }

  async backfillAll(): Promise<{ orders: { processed: number; failed: number }; users: { processed: number; failed: number } }> {
    const [orders, users] = await Promise.all([
      this.backfillOrderEmbeddings(),
      this.backfillUserEmbeddings(),
    ]);
    return { orders, users };
  }
}
