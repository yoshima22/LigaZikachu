/**
 * Auditoria read-only de RLS. Nao altera nada.
 *
 * Use antes e depois de scripts/enable-rls-all.ts, e sempre que quiser conferir
 * se alguma tabela nova entrou sem protecao.
 *
 *   npx tsx scripts/check-rls.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const conexao = await prisma.$queryRawUnsafe<{ u: string; bypass: boolean }[]>(
    `SELECT current_user AS u, rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user`,
  );
  console.log(`conexao: ${conexao[0].u} (bypassrls=${conexao[0].bypass})`);
  if (!conexao[0].bypass) {
    console.log("ATENCAO: este papel NAO ignora RLS — o app seria filtrado pelas politicas.");
  }

  const semRls = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY 1`,
  );
  const comRls = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity`,
  );

  console.log(`com RLS: ${Number(comRls[0].n)} | sem RLS: ${semRls.length}`);
  if (semRls.length > 0) {
    console.log("EXPOSTAS:", semRls.join(", "));
    process.exitCode = 1;
  } else {
    console.log("ok — nenhuma tabela de public exposta.");
  }
}

main().finally(() => prisma.$disconnect());
