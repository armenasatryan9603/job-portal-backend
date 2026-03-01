import { PrismaClient } from '@prisma/client';
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

function escapeSql(str: string): string {
  if (str == null || str === '') return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

async function seedSkills() {
  const csvPath = path.join(__dirname, '..', 'Skill.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length} skill rows to process.`);

  const values: string[] = [];

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (cols.length < 9) continue;

    const [
      idStr,
      nameEn,
      nameRu,
      nameHy,
      descriptionEn,
      descriptionRu,
      descriptionHy,
      createdAtStr,
      updatedAtStr,
    ] = cols;

    const id = parseInt(idStr, 10);
    if (isNaN(id)) continue;

    const createdAt = createdAtStr ? new Date(createdAtStr).toISOString() : new Date().toISOString();
    const updatedAt = updatedAtStr ? new Date(updatedAtStr).toISOString() : new Date().toISOString();

    const row = [
      id,
      escapeSql(nameEn || ''),
      escapeSql(nameRu || ''),
      escapeSql(nameHy || ''),
      descriptionEn?.trim() ? escapeSql(descriptionEn) : 'NULL',
      descriptionRu?.trim() ? escapeSql(descriptionRu) : 'NULL',
      descriptionHy?.trim() ? escapeSql(descriptionHy) : 'NULL',
      `'${createdAt}'`,
      `'${updatedAt}'`,
    ].join(', ');
    values.push(`(${row})`);
  }

  if (values.length === 0) {
    console.log('No valid rows to insert.');
    return;
  }

  const sql = `
    INSERT INTO "Skill" (id, "nameEn", "nameRu", "nameHy", "descriptionEn", "descriptionRu", "descriptionHy", "createdAt", "updatedAt")
    VALUES ${values.join(',\n    ')}
    ON CONFLICT (id) DO UPDATE SET
      "nameEn" = EXCLUDED."nameEn",
      "nameRu" = EXCLUDED."nameRu",
      "nameHy" = EXCLUDED."nameHy",
      "descriptionEn" = EXCLUDED."descriptionEn",
      "descriptionRu" = EXCLUDED."descriptionRu",
      "descriptionHy" = EXCLUDED."descriptionHy",
      "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt"
  `;

  await prisma.$executeRawUnsafe(sql);

  // Reset PostgreSQL sequence so next auto-generated id is max(id)+1
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Skill"', 'id'), COALESCE((SELECT MAX(id) FROM "Skill"), 1))`,
  );

  console.log(`Seeding complete. Inserted/updated ${values.length} skills.`);
}

seedSkills()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
