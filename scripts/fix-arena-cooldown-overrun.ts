/**
 * fix-arena-cooldown-overrun.ts
 *
 * Corrige mascotes FREE que estão com restingUntil indevidamente longo
 * (bug: usava 30 min em vez de 10 min para cooldown de re-entrada na arena).
 *
 * Modo dry-run (padrão): mostra o que seria corrigido.
 * Com --apply: executa as correções.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const CORRECT_MAX_COOLDOWN_MS = 10 * 60_000; // 10 min = limite correto

async function main() {
  const now = new Date();
  // Limite máximo correto: agora + 10 min (com 5s de folga para clock skew)
  const maxAllowed = new Date(now.getTime() + CORRECT_MAX_COOLDOWN_MS + 5_000);

  // Busca mascotes FREE com restingUntil além do que o cooldown correto permitiria
  const overrun = await prisma.mascot.findMany({
    where: {
      arenaState: "FREE",
      restingUntil: { gt: maxAllowed },
    },
    select: {
      id: true,
      nickname: true,
      pokemonId: true,
      restingUntil: true,
      player: { select: { displayName: true } },
    },
  });

  if (overrun.length === 0) {
    console.log("✅ Nenhum mascote com cooldown excessivo encontrado.");
    return;
  }

  console.log(`\n⚠️  ${overrun.length} mascote(s) com cooldown excessivo:\n`);
  for (const m of overrun) {
    const name = m.nickname ?? `#${m.pokemonId}`;
    const remaining = Math.ceil((m.restingUntil!.getTime() - now.getTime()) / 60_000);
    console.log(`  ${name} (${m.player.displayName}) — restingUntil: ${m.restingUntil!.toISOString()} (~${remaining} min restantes)`);
  }

  if (!apply) {
    console.log("\n⚡ Modo dry-run. Use --apply para liberar os mascotes.");
    return;
  }

  // Libera todos: zera restingUntil (cooldown já expirado de facto pelo bug)
  const ids = overrun.map(m => m.id);
  const { count } = await prisma.mascot.updateMany({
    where: { id: { in: ids } },
    data: { restingUntil: null },
  });

  console.log(`\n✅ ${count} mascote(s) liberado(s) com sucesso.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
