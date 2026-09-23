/** Reconstitui as falhas das últimas 48h e cancela afastamentos reabertos na recarga. */
import { prisma } from "../src/lib/prisma";
import { FAILED_DISTANCE_COOLDOWN_MS, failedDistanceMemoryData } from "../src/lib/bond-distance-cooldown";

const apply = process.argv.includes("--apply");
const now = new Date();
const since = new Date(now.getTime() - FAILED_DISTANCE_COOLDOWN_MS);

async function main() {
  const notices = await prisma.playerNotification.findMany({
    where: { type: "BOND_DISTANCE_DISPUTE", title: "Contestação bem-sucedida", createdAt: { gt: since }, entityId: { startsWith: "bond-contest:" } },
    orderBy: { createdAt: "asc" },
    select: { entityId: true, createdAt: true },
  });
  const events = [...new Map(notices.filter((notice) => notice.entityId).map((notice) => [notice.entityId!, notice])).values()];
  const findings: Array<{ event: string; initiatorMascotId: string; failedAt: string; cancelPairs: string[] }> = [];
  for (const event of events) {
    const relationId = event.entityId!.split(":")[1];
    const relation = await prisma.mascotRelation.findUnique({ where: { id: relationId }, select: { mascotAId: true, mascotBId: true } });
    if (!relation) continue;
    const pair = [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }];
    const started = await prisma.mascotBondMemory.findFirst({
      where: { memoryType: "AFASTAMENTO_INICIADO", OR: pair, createdAt: { lte: event.createdAt } },
      orderBy: { createdAt: "desc" }, select: { mascotAId: true, mascotBId: true },
    });
    if (!started?.mascotBId) continue;
    const initiator = await prisma.mascot.findUnique({ where: { id: started.mascotAId }, select: { playerId: true } });
    if (!initiator) continue;
    const active = await prisma.mascotRelation.findMany({
      where: { isActive: true, distanceStartedByPlayerId: initiator.playerId, distanceStartedAt: { gt: event.createdAt }, dormantAt: { gt: now }, OR: [{ mascotAId: started.mascotAId }, { mascotBId: started.mascotAId }] },
      select: { mascotAId: true, mascotBId: true },
    });
    const cancelPairs = [...new Set(active.map((item) => [item.mascotAId, item.mascotBId].sort().join(":")))];
    findings.push({ event: event.entityId!, initiatorMascotId: started.mascotAId, failedAt: event.createdAt.toISOString(), cancelPairs });
    if (!apply) continue;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.mascotBondMemory.findFirst({ where: { memoryType: "AFASTAMENTO_FALHOU", sourceType: "BOND_COOLDOWN_BACKFILL", sourceId: event.entityId }, select: { id: true } });
      if (!existing) await tx.mascotBondMemory.create({ data: { ...failedDistanceMemoryData(started.mascotAId, started.mascotBId!, relationId, "CONTEST", event.createdAt), sourceType: "BOND_COOLDOWN_BACKFILL", sourceId: event.entityId } });
      for (const key of cancelPairs) {
        const [mascotAId, mascotBId] = key.split(":");
        const cancelled = await tx.mascotRelation.updateMany({ where: { isActive: true, distanceStartedByPlayerId: initiator.playerId, distanceStartedAt: { gt: event.createdAt }, dormantAt: { gt: now }, OR: [{ mascotAId, mascotBId }, { mascotAId: mascotBId, mascotBId: mascotAId }] }, data: { dormantAt: null, distanceStartedAt: null, distanceStartedByPlayerId: null, distanceRemainingMs: null, promiseCharmStartedAt: null, promiseCharmResolvesAt: null, promiseCharmByPlayerId: null, promiseShielded: false, distanceContestants: [] } });
        if (!cancelled.count) continue;
        await tx.mascotBondMemory.create({ data: { mascotAId: started.mascotAId, mascotBId: mascotAId === started.mascotAId ? mascotBId : mascotAId, memoryType: "AFASTAMENTO_CANCELADO", sourceType: "BOND_COOLDOWN_BACKFILL", sourceId: event.entityId, title: "Tentativa durante a recarga", description: "O afastamento reaberto após uma contestação vencedora foi cancelado. O mascote iniciador deve respeitar a recarga de 48 horas.", intensity: 2 } });
        const mascots = await tx.mascot.findMany({ where: { id: { in: [mascotAId, mascotBId] } }, select: { playerId: true } });
        await tx.playerNotification.createMany({ data: [...new Set(mascots.map((mascot) => mascot.playerId))].map((playerId) => ({ playerId, category: "BONDS", type: "BOND_DISTANCE_DISPUTE", title: "Afastamento reaberto cancelado", body: "Uma contestação anterior preservou o vínculo e iniciou 48 horas de recarga para o mascote que tentou se afastar. A nova tentativa foi cancelada.", href: "/lacos", eventKey: `bond-distance-retro:${key}:${playerId}` })), skipDuplicates: true });
      }
    });
  }
  console.log(JSON.stringify({ mode: apply ? "APPLIED" : "DRY_RUN", findings }, null, 2));
}

main().finally(() => prisma.$disconnect());
