import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = path.resolve("backups", "local");
const outputPath = path.join(outputDir, `liga-zikachu-${timestamp}.json`);

const serialize = (value: unknown) => JSON.stringify(value, (_key, item) => {
  if (typeof item === "bigint") return { $bigint: item.toString() };
  if (item instanceof Uint8Array) return { $bytes: Buffer.from(item).toString("base64") };
  return item;
});

async function main() {
  await mkdir(outputDir, { recursive: true });
  const models: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const model of Prisma.dmmf.datamodel.models) {
    const delegateName = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const delegate = (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[delegateName];
    if (!delegate?.findMany) continue;
    const rows = await delegate.findMany();
    models[model.name] = rows;
    counts[model.name] = rows.length;
  }

  const payload = serialize({
    format: "liga-zikachu-prisma-data-v1",
    createdAt: new Date().toISOString(),
    databaseProvider: "postgresql",
    counts,
    models,
  });
  await writeFile(outputPath, payload, "utf8");
  const sha256 = createHash("sha256").update(payload).digest("hex");
  await writeFile(`${outputPath}.sha256`, `${sha256}  ${path.basename(outputPath)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, sha256, models: Object.keys(models).length, rows: Object.values(counts).reduce((a, b) => a + b, 0) }));
}

main().finally(() => prisma.$disconnect());
