/**
 * Liga Row Level Security em toda tabela do schema `public` que ainda nao tem.
 *
 * Por que e seguro para esta aplicacao (tudo verificado no banco antes):
 *  - o Prisma conecta como `postgres`, que tem rolbypassrls = true, entao
 *    nenhuma query do servidor passa a ser filtrada;
 *  - o Storage usa a service_role key e vive no schema `storage`;
 *  - no cliente, a chave anon so abre canais de Realtime (.channel()), nunca
 *    le tabela via PostgREST;
 *  - 16 tabelas ja rodavam assim (RLS ligado, zero politicas) sem quebrar nada.
 *
 * O que muda: sem politica, `anon` e `authenticated` deixam de ler e escrever
 * pelo PostgREST. Era esse o buraco — a chave anon vai no bundle do navegador
 * e ate aqui devolvia `players` e `users` inteiros em GET /rest/v1/<tabela>.
 *
 * NAO usa FORCE ROW LEVEL SECURITY de proposito: FORCE sujeitaria tambem o dono
 * da tabela as politicas e derrubaria o Prisma.
 *
 * Idempotente — rodar de novo nao faz nada. Se algum dia um recurso precisar ler
 * pelo PostgREST, crie uma politica explicita para aquela tabela, em vez de
 * desligar o RLS.
 *
 *   npx tsx scripts/enable-rls-all.ts
 */
import { prisma } from "../src/lib/prisma";

async function semRls(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT c.relname AS t
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY 1`,
  );
  return rows.map((r) => r.t);
}

async function main() {
  const antes = await semRls();
  if (antes.length === 0) {
    console.log("Nada a fazer: todas as tabelas de public ja tem RLS.");
    return;
  }
  console.log(`Ligando RLS em ${antes.length} tabelas...`);

  // O laco roda dentro do Postgres: a lista de tabelas nunca sai do banco e o
  // identificador e montado por format(%I), nao por concatenacao no TypeScript.
  await prisma.$executeRawUnsafe(`
    DO $enable_rls$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT c.relname
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
      END LOOP;
    END
    $enable_rls$;
  `);

  const restantes = await semRls();
  if (restantes.length > 0) {
    console.log(`FALTARAM ${restantes.length}: ${restantes.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok — RLS ligado em ${antes.length} tabelas; nenhuma de public segue exposta.`);
}

main().finally(() => prisma.$disconnect());
