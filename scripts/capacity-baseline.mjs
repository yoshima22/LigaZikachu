import { PrismaClient } from '@prisma/client';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const db = new PrismaClient();
try {
  const tables = await db.$queryRaw`
    SELECT relname AS name, n_live_tup::text AS estimated_rows,
           pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
           seq_scan::text, idx_scan::text
    FROM pg_stat_user_tables WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC LIMIT 15`;
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), tables }, null, 2));
} finally {
  await db.$disconnect();
}
