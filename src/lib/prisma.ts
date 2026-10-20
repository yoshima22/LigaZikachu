import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: PrismaClient | undefined;
}

const log: ("query" | "error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"];

function withServerlessPoolLimit(url: string | undefined) {
  if (!url) return url;
  if (url.includes("connection_limit=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=2&pool_timeout=20`;
}

/** Remove parâmetros que só o engine Rust entende (o driver pg não os usa). */
function stripEngineParams(url: string) {
  const u = new URL(url);
  for (const key of ["pgbouncer", "connection_limit", "pool_timeout", "sslmode"]) u.searchParams.delete(key);
  return u.toString();
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL;

  // Driver adapter `pg` (padrão). Com `?pgbouncer=true`, o engine Rust do Prisma
  // envolvia TODA query (até leituras) em BEGIN + DEALLOCATE ALL + COMMIT —
  // 4 idas-e-voltas por query; medido em produção como ~70% de todas as chamadas
  // ao banco. O `pg` usa statements sem nome, compatíveis com o Supavisor em modo
  // transação, então cada query é 1 ida-e-volta.
  // Kill switch: PRISMA_DRIVER_ADAPTER=off volta ao engine antigo sem deploy de código.
  if (url && process.env.PRISMA_DRIVER_ADAPTER !== "off") {
    const adapter = new PrismaPg({
      connectionString: stripEngineParams(url),
      // Mesmo teto por instância serverless que o engine usava (connection_limit=2),
      // para não aumentar a pressão sobre o pooler; ajustável sem deploy.
      max: Math.max(1, Number(process.env.DB_POOL_MAX ?? 2)),
      connectionTimeoutMillis: 20_000, // equivalente ao antigo pool_timeout=20
      idleTimeoutMillis: 10_000,
      // TLS como o engine fazia (o pg não usa TLS por padrão).
      ssl: { rejectUnauthorized: false },
    });
    return new PrismaClient({ adapter, log });
  }

  // Se DATABASE_URL estiver ausente (ex.: hiccup de env durante o build do Vercel),
  // não passa datasources — passar url: undefined faz o construtor lançar erro no
  // import do módulo e derruba o build no "Collecting page data". Sem o override,
  // o erro só aparece na primeira query em runtime.
  const pooledUrl = withServerlessPoolLimit(url);
  return new PrismaClient({
    ...(pooledUrl ? { datasources: { db: { url: pooledUrl } } } : {}),
    log,
  });
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
