import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = join(root, 'src', 'lib', 'companion');
const files = readdirSync(fixtureDir).filter(name => name.endsWith('.test.ts')).sort();
if (!files.length) throw new Error('No companion smoke fixtures found');

// Fixtures call local handlers with in-memory stores. Never give the test child
// deployment credentials; use an unreachable loopback database as a backstop.
const fixtureDb = 'postgresql://fixture:fixture@127.0.0.1:1/fixture';
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|TMPDIR)$/i.test(key)),
);
const run = spawnSync(process.execPath, [
  '--import', 'tsx', '--test', ...files.map(name => join(fixtureDir, name)),
], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...env,
    DATABASE_URL: fixtureDb,
    DIRECT_URL: fixtureDb,
    AUTH_SECRET: 'local-smoke-fixture-only',
    ZIKACOMPANION_PILOT_ENABLED: 'false',
    ZIKACOMPANION_PILOT_USER_IDS: '',
  },
});
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
