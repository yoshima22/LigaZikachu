import { PrismaClient, Prisma } from '@prisma/client';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const directory = resolve('backups', `consistent-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const manifest = { format: 'postgres-json-pages-v1', completed: false, createdAt: new Date().toISOString(), tables: [], totalRows: 0 };
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const tables = await tx.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    for (const { tablename } of tables) {
      const table = { name: tablename, rows: 0, pages: [] };
      await tx.$executeRawUnsafe(`DECLARE backup_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS data FROM public.${quote(tablename)} t`);
      for (let offset = 0; ; offset += 500) {
        // PostgreSQL serializes values itself: bigint and numeric never pass through JS numbers.
        const rows = await tx.$queryRawUnsafe('FETCH FORWARD 500 FROM backup_rows');
        const page = { count: rows.length, data: '[' + rows.map(row => row.data).join(',') + ']' };
        if (!page.count) break;
        const file = `${tablename}-${offset}.json`;
        await writeFile(resolve(directory, file), page.data, { flag: 'wx' });
        table.pages.push({ file, rows: page.count, sha256: createHash('sha256').update(page.data).digest('hex') });
        table.rows += page.count;
        if (page.count < 500) break;
      }
      await tx.$executeRawUnsafe('CLOSE backup_rows');
      manifest.tables.push(table);
      manifest.totalRows += table.rows;
      console.log(`${tablename}: ${table.rows}`);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 900000, maxWait: 20000 });
  for (const table of manifest.tables) for (const page of table.pages) {
    const data = await readFile(resolve(directory, page.file));
    if (createHash('sha256').update(data).digest('hex') !== page.sha256 || JSON.parse(data.toString()).length !== page.rows) throw new Error(`Verification failed: ${page.file}`);
  }
  manifest.completed = true;
  console.log(`VERIFIED ${directory}: ${manifest.tables.length} tables, ${manifest.totalRows} rows`);
} catch (error) {
  console.error('Backup incomplete:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await prisma.$disconnect();
}
