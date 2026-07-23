import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const versioned = await prisma.$executeRawUnsafe(`
    UPDATE mascots
    SET "analysisJson" = jsonb_set("analysisJson", '{analysisVersion}', '2'::jsonb, true)
    WHERE "analysisJson" IS NOT NULL
      AND "analyzedAt" IS NOT NULL
  `);
  console.log(JSON.stringify({ versioned }));
}

main().finally(async () => prisma.$disconnect());
