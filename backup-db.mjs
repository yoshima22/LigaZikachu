import { PrismaClient, Prisma } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";

const prisma = new PrismaClient();

// Serializa BigInt/Date/Decimal de forma segura
function replacer(_key, value) {
  if (typeof value === "bigint") return { __bigint__: value.toString() };
  if (value instanceof Date) return value.toISOString();
  return value;
}

try {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = `backups/${stamp}`;
  mkdirSync(dir, { recursive: true });

  const models = Prisma.dmmf.datamodel.models;
  const manifest = { createdAt: new Date().toISOString(), tables: {}, totalRows: 0 };

  for (const m of models) {
    const accessor = m.name[0].toLowerCase() + m.name.slice(1);
    const client = prisma[accessor];
    if (!client?.findMany) { console.log(`- ${m.name}: sem accessor (pulado)`); continue; }
    try {
      const rows = await client.findMany();
      writeFileSync(`${dir}/${m.name}.json`, JSON.stringify(rows, replacer, 0));
      manifest.tables[m.name] = rows.length;
      manifest.totalRows += rows.length;
      console.log(`+ ${m.name}: ${rows.length} linhas`);
    } catch (e) {
      manifest.tables[m.name] = `ERRO: ${e.message}`;
      console.log(`! ${m.name}: ERRO ${e.message}`);
    }
  }

  writeFileSync(`${dir}/_manifest.json`, JSON.stringify(manifest, null, 2));
  console.log(`\nBackup salvo em: ${dir}`);
  console.log(`Tabelas: ${Object.keys(manifest.tables).length} | Total de linhas: ${manifest.totalRows}`);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
