import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function withServerlessPoolLimit(url: string | undefined) {
  if (!url) return url;
  if (url.includes("connection_limit=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=2&pool_timeout=20`;
}

// Se DATABASE_URL estiver ausente (ex.: hiccup de env durante o build do Vercel),
// não passa datasources — passar url: undefined faz o construtor lançar erro no
// import do módulo e derruba o build no "Collecting page data". Sem o override,
// o erro só aparece na primeira query em runtime.
const pooledUrl = withServerlessPoolLimit(process.env.DATABASE_URL);

export const prisma =
  global.prisma ??
  new PrismaClient({
    ...(pooledUrl ? { datasources: { db: { url: pooledUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
