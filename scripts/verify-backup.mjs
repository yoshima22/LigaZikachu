import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyBackup(directory) {
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  if (!manifest.completed || manifest.format !== 'postgres-json-pages-v1') throw new Error('Backup incomplete or unsupported');
  let total = 0;
  for (const table of manifest.tables) {
    let rows = 0;
    for (const page of table.pages) {
      if (basename(page.file) !== page.file) throw new Error('Invalid backup file name');
      const data = await readFile(resolve(directory, page.file));
      if (createHash('sha256').update(data).digest('hex') !== page.sha256) throw new Error(`Hash mismatch: ${page.file}`);
      const parsed = JSON.parse(data.toString());
      if (!Array.isArray(parsed) || parsed.length !== page.rows) throw new Error(`Row count mismatch: ${page.file}`);
      rows += parsed.length;
    }
    if (rows !== table.rows) throw new Error(`Table count mismatch: ${table.name}`);
    total += rows;
  }
  if (total !== manifest.totalRows) throw new Error('Total count mismatch');
  return { tables: manifest.tables.length, rows: total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/verify-backup.mjs <backup-directory>');
    console.log(await verifyBackup(resolve(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
