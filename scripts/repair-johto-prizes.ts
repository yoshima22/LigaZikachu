/**
 * Reparo de 23/10/2026: a premiação da fase final foi distribuída pela versão
 * antiga (só um aviso + rewardedAt), antes do deploy das caixas. Cria as caixas
 * e prêmios de Johto que faltam, pela colocação na CHAVE. Idempotente: quem já
 * tem o presente JOHTO_PRIZE do torneio é pulado.
 *
 *   npx tsx --env-file=.env.local scripts/repair-johto-prizes.ts          # ensaio
 *   npx tsx --env-file=.env.local scripts/repair-johto-prizes.ts --apply  # grava
 */
import { prisma } from "../src/lib/prisma";
import { getJohtoPrize, JOHTO_BOXES, johtoPlacementFromResult } from "../src/lib/johto-reward-boxes";
import { createJohtoPrizeGifts, playersWithJohtoPrize } from "../src/lib/johto-reward-grant";

const APPLY = process.argv.includes("--apply");
const SLUG = "liga-zikachu-3-edicao-rumo-a-johto";

(async () => {
  const t = await prisma.tournament.findUnique({ where: { slug: SLUG }, include: { postseasonEntries: { include: { player: { select: { displayName: true } } }, orderBy: [{ stage: "asc" }, { seed: "asc" }] } } });
  if (!t) throw new Error("Torneio não encontrado.");
  const planned = t.postseasonEntries.map((e) => ({ e, placement: johtoPlacementFromResult(e.stage, e.resultLabel) }));
  const undefinedResult = planned.filter((p) => !p.placement);
  if (undefinedResult.length) throw new Error(`Sem resultado: ${undefinedResult.map((p) => p.e.player.displayName).join(", ")}`);

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`johto-prizes:${t.id}`}))`;
    const done = await playersWithJohtoPrize(tx, t.id);
    const pending = planned.filter((p) => !done.has(p.e.playerId));
    for (const { e, placement } of planned) {
      const boxes = getJohtoPrize(placement!).boxes.map((b) => JOHTO_BOXES[b].name).join(" + ");
      console.log(`${done.has(e.playerId) ? "já tem  " : "criar   "} ${e.player.displayName.padEnd(34)} ${placement!.padEnd(16)} prêmios fixos + ${boxes}`);
    }
    if (!APPLY) return 0;
    for (const { e, placement } of pending) {
      await createJohtoPrizeGifts(tx, { tournamentId: t.id, playerId: e.playerId, stage: e.stage, resultLabel: e.resultLabel, placement: placement! });
    }
    if (pending.length) await tx.auditLog.create({ data: { entityType: "tournament", entityId: t.id, action: "postseason.rewards_repaired", after: { players: pending.length } } });
    return pending.length;
  });
  console.log(APPLY ? `\nAPLICADO: presentes criados para ${created} jogador(es).` : "\nENSAIO: nada gravado. Use --apply.");
  await prisma.$disconnect();
})();
