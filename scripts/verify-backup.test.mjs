import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyBackup } from './verify-backup.mjs';

test('backup verification detects corruption, incomplete exports and wrong totals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liga-backup-test-'));
  const data = '[{"id":"player","coins":9007199254740993123}]';
  const manifest = { completed: true, format: 'postgres-json-pages-v1', totalRows: 1, tables: [{ name: 'players', rows: 1, pages: [{ file: 'players-0.json', rows: 1, sha256: createHash('sha256').update(data).digest('hex') }] }] };
  const saveManifest = () => writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  try {
    await writeFile(join(dir, 'players-0.json'), data);
    await saveManifest();
    assert.deepEqual(await verifyBackup(dir), { tables: 1, rows: 1 });
    await writeFile(join(dir, 'players-0.json'), '[]');
    await assert.rejects(verifyBackup(dir), /Hash mismatch/);
    await writeFile(join(dir, 'players-0.json'), data);
    manifest.completed = false;
    await saveManifest();
    await assert.rejects(verifyBackup(dir), /incomplete/);
    manifest.completed = true;
    manifest.totalRows = 2;
    await saveManifest();
    await assert.rejects(verifyBackup(dir), /Total count/);
  } finally {
    await rm(dir, { recursive: true });
  }
});
