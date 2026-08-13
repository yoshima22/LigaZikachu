/**
 * fix-nakaima-rush-teams.ts
 *
 * Limpa as equipes da Liga Rush do jogador Nakaima e resolve "mascotes fantasma"
 * (slots que apontam para mascotes que não existem mais ou que não pertencem
 * mais a ele). O jogador poderá remontar as equipes normalmente depois.
 *
 * Modo dry-run (padrão): mostra o que seria removido.
 * Com --apply: remove as equipes diárias da Rush do jogador.
 *
 * Uso:
 *   node scripts/run-with-env-local.mjs tsx scripts/fix-nakaima-rush-teams.ts
 *   node scripts/run-with-env-local.mjs tsx scripts/fix-nakaima-rush-teams.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const NAME = "Nakaima";

async function main() {
  const player = await prisma.player.findFirst({
    where: { displayName: { equals: NAME, mode: "insensitive" } },
    select: { id: true, displayName: true },
  });

  if (!player) {
    console.log(`❌ Jogador "${NAME}" não encontrado.`);
    return;
  }
  console.log(`👤 Jogador: ${player.displayName} (${player.id})\n`);

  const teams = await prisma.rushLeagueDailyTeam.findMany({
    where: { playerId: player.id },
    select: {
      id: true, leagueId: true, battleDate: true, battleSlot: true, mascotIdsJson: true,
      league: { select: { name: true, weekKey: true, status: true } },
    },
    orderBy: [{ battleDate: "asc" }, { battleSlot: "asc" }],
  });

  if (teams.length === 0) {
    console.log("✅ Nenhuma equipe da Rush encontrada para este jogador. Nada a limpar.");
    return;
  }

  // Detecta mascotes fantasma: ids referenciados que não existem mais ou
  // não pertencem mais ao jogador.
  const referencedIds = [
    ...new Set(teams.flatMap((t) => (Array.isArray(t.mascotIdsJson) ? (t.mascotIdsJson as string[]) : []))),
  ];
  const existing = await prisma.mascot.findMany({
    where: { id: { in: referencedIds } },
    select: { id: true, playerId: true },
  });
  const ownedIds = new Set(existing.filter((m) => m.playerId === player.id).map((m) => m.id));

  console.log(`🗺️  ${teams.length} equipe(s) da Rush encontrada(s):\n`);
  for (const t of teams) {
    const ids = Array.isArray(t.mascotIdsJson) ? (t.mascotIdsJson as string[]) : [];
    const ghosts = ids.filter((id) => !ownedIds.has(id));
    const flag = ghosts.length ? ` ⚠️  fantasma(s): ${ghosts.join(", ")}` : "";
    console.log(
      `  [${t.league.weekKey} · ${t.league.status}] ${t.battleDate} slot ${t.battleSlot} — ` +
        `${ids.length} mascote(s)${flag}`,
    );
  }

  if (!apply) {
    console.log("\n⚡ Modo dry-run. Use --apply para remover todas as equipes da Rush deste jogador.");
    return;
  }

  const { count } = await prisma.rushLeagueDailyTeam.deleteMany({ where: { playerId: player.id } });
  console.log(`\n✅ ${count} equipe(s) da Rush removida(s). O jogador pode remontar as escalações.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
