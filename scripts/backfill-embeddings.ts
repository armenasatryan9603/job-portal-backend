/**
 * One-time backfill script: generates and stores pgvector embeddings
 * for all existing Orders and specialist Users that have no embedding yet.
 *
 * Run with:
 *   cd backend && npx ts-node scripts/backfill-embeddings.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 10;
const DELAY_MS = 500; // between batches — respect OpenAI rate limit

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.replace(/\n/g, " ").trim().slice(0, 8000);
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  return response.data[0].embedding;
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

async function backfillOrders() {
  console.log("\n=== Backfilling Order embeddings ===");

  const orders: Array<{ id: number }> = await prisma.$queryRaw`
    SELECT id FROM "Order"
    WHERE "deletedAt" IS NULL
      AND status NOT IN ('draft', 'rejected')
      AND embedding IS NULL
    ORDER BY id ASC
  `;

  console.log(`Found ${orders.length} orders without embeddings`);
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async ({ id }) => {
        try {
          const order = await prisma.order.findUnique({
            where: { id },
            include: {
              Category: true,
              OrderSkills: { include: { Skill: true } },
            },
          });

          if (!order) return;

          const skillNames = ((order as any).OrderSkills ?? [])
            .map((os: any) => os.Skill?.nameEn || os.Skill?.nameRu || os.Skill?.nameHy || "")
            .filter(Boolean)
            .join(", ");

          const text = [
            (order as any).titleEn || order.title || "",
            (order as any).descriptionEn || order.description || "",
            (order as any).titleRu || "",
            (order as any).titleHy || "",
            (order as any).Category?.name || "",
            skillNames,
          ]
            .filter(Boolean)
            .join(" ");

          if (!text.trim()) return;

          const embedding = await generateEmbedding(text);
          const vectorLiteral = `[${embedding.join(",")}]`;

          await prisma.$executeRawUnsafe(
            `UPDATE "Order" SET embedding = $1::vector WHERE id = $2`,
            vectorLiteral,
            id
          );

          processed++;
          process.stdout.write(`\r  Orders: ${processed} done, ${failed} failed`);
        } catch (err: any) {
          failed++;
          console.error(`\n  ✗ Order ${id}: ${err.message}`);
        }
      })
    );

    if (i + BATCH_SIZE < orders.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n  ✓ Orders done — processed: ${processed}, failed: ${failed}`);
  return { processed, failed };
}

// ─── USERS / SPECIALISTS ─────────────────────────────────────────────────────

async function backfillUsers() {
  console.log("\n=== Backfilling Specialist embeddings ===");

  const users: Array<{ id: number }> = await prisma.$queryRaw`
    SELECT id FROM "User"
    WHERE "deletedAt" IS NULL
      AND role = 'specialist'
      AND embedding IS NULL
    ORDER BY id ASC
  `;

  console.log(`Found ${users.length} specialists without embeddings`);
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async ({ id }) => {
        try {
          const user = await prisma.user.findUnique({
            where: { id },
            include: {
              UserCategories: { include: { Category: true } },
            },
          });

          if (!user) return;

          const categoryNames = ((user as any).UserCategories ?? [])
            .map((uc: any) => uc.Category?.name || "")
            .filter(Boolean)
            .join(", ");

          const text = [user.name || "", user.bio || "", categoryNames]
            .filter(Boolean)
            .join(" ");

          if (!text.trim()) return;

          const embedding = await generateEmbedding(text);
          const vectorLiteral = `[${embedding.join(",")}]`;

          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET embedding = $1::vector WHERE id = $2`,
            vectorLiteral,
            id
          );

          processed++;
          process.stdout.write(`\r  Specialists: ${processed} done, ${failed} failed`);
        } catch (err: any) {
          failed++;
          console.error(`\n  ✗ User ${id}: ${err.message}`);
        }
      })
    );

    if (i + BATCH_SIZE < users.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n  ✓ Specialists done — processed: ${processed}, failed: ${failed}`);
  return { processed, failed };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting embedding backfill...");
  console.log(`OpenAI key: ${process.env.OPENAI_API_KEY ? "✓ found" : "✗ MISSING"}`);
  console.log(`Database:   ${process.env.DATABASE_URL ? "✓ found" : "✗ MISSING"}`);

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is not set in .env");
    process.exit(1);
  }

  try {
    const orderResult = await backfillOrders();
    const userResult = await backfillUsers();

    console.log("\n=== Summary ===");
    console.log(`Orders:      ${orderResult.processed} processed, ${orderResult.failed} failed`);
    console.log(`Specialists: ${userResult.processed} processed, ${userResult.failed} failed`);
    console.log("\nDone! AI search is now ready.\n");
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
