import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function seedSubscriptionPlans() {
  const csvPath = path.join(__dirname, 'SubscriptionPlan.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length} subscription plan rows to process.`);

  let processed = 0;

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    // id,name,nameEn,nameRu,nameHy,description,descriptionEn,descriptionRu,descriptionHy,price,currency,durationDays,isRecurring,features,isActive,createdAt,updatedAt,oldPrice
    if (cols.length < 17) continue;

    const [
      idStr,
      name,
      nameEn,
      nameRu,
      nameHy,
      description,
      descriptionEn,
      descriptionRu,
      descriptionHy,
      priceStr,
      currency,
      durationDaysStr,
      isRecurringStr,
      featuresStr,
      isActiveStr,
      createdAtStr,
      updatedAtStr,
      oldPriceStr,
    ] = cols;

    const id = parseInt(idStr, 10);
    if (isNaN(id)) continue;

    const price = parseFloat(priceStr || '0');
    const durationDays = parseInt(durationDaysStr || '30', 10);
    const isRecurring = isRecurringStr?.toLowerCase() === 'true';
    const isActive = isActiveStr?.toLowerCase() !== 'false';
    const oldPrice = oldPriceStr?.trim() ? parseFloat(oldPriceStr) : null;

    const createdAt = createdAtStr ? new Date(createdAtStr) : new Date();
    const updatedAt = updatedAtStr ? new Date(updatedAtStr) : new Date();

    // Features: CSV escapes " as ""; normalize and parse as JSON object for Prisma
    let features: Prisma.InputJsonValue | undefined;
    const featuresJson = featuresStr?.trim()?.replace(/""/g, '"');
    if (featuresJson) {
      try {
        features = JSON.parse(featuresJson) as Prisma.InputJsonValue;
      } catch {
        features = undefined;
      }
    } else {
      features = undefined;
    }

    const data = {
      name: name || '',
      nameEn: nameEn?.trim() || null,
      nameRu: nameRu?.trim() || null,
      nameHy: nameHy?.trim() || null,
      description: description?.trim() || null,
      descriptionEn: descriptionEn?.trim() || null,
      descriptionRu: descriptionRu?.trim() || null,
      descriptionHy: descriptionHy?.trim() || null,
      price,
      oldPrice,
      currency: currency?.trim() || 'AMD',
      durationDays,
      isRecurring,
      ...(features !== undefined && { features }),
      isActive,
      createdAt,
      updatedAt,
    };

    await prisma.subscriptionPlan.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    processed++;
  }

  // Reset PostgreSQL sequence so next auto-generated id is max(id)+1
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"SubscriptionPlan"', 'id'), COALESCE((SELECT MAX(id) FROM "SubscriptionPlan"), 1))`,
  );

  console.log(`Seeding complete. Inserted/updated ${processed} subscription plans.`);
}

seedSubscriptionPlans()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
