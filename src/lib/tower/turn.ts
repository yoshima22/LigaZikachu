// Torre dos Rebeldes — núcleo do turn engine (janela global; Online 120s / Lento
// 4h). Módulo de servidor comum (NÃO "use server"): usado pelas server actions e
// pelo cron, sem expor a resolução como action pública.

import { prisma } from "@/lib/prisma";

export type TowerVolatile = {
  submissions?: Record<string, { confirmedAt: string; actions: unknown }>;
  log?: string[];
};

/** Duração da janela de turno por ritmo. */
export function windowMsFor(pace: string): number {
  return pace === "SLOW" ? 4 * 60 * 60_000 : 120_000;
}

/** Lock consultivo estável por run (evita resolver o mesmo turno duas vezes). */
export function runLockKey(runId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < runId.length; i++) {
    h ^= runId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0; // int32 assinado, aceito por pg_advisory_xact_lock
}

/**
 * Resolve UMA passagem de turno (idempotente, sob lock). Aplica AFK, avança o
 * turno global, rotaciona a ordem, limpa submissões e reabre a janela.
 * A resolução de gameplay (exploração/encounters via o núcleo tático) entra aqui
 * nas próximas fases — este é o esqueleto do loop.
 */
export async function resolveTowerTurnLocked(runId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${runLockKey(runId)})`;
      const run = await tx.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
      if (!run || run.status !== "ACTIVE") return;

      const vol = (run.volatileState ?? {}) as TowerVolatile;
      const submissions = vol.submissions ?? {};
      const active = run.members.filter((m) => !m.afkRemoved);

      // AFK: quem confirmou zera as faltas; quem não confirmou soma; 2 seguidas remove.
      let removedNow = 0;
      for (const m of active) {
        const confirmed = Boolean(submissions[m.userId]);
        if (confirmed) {
          if (m.consecutiveMisses !== 0) {
            await tx.towerRunMember.update({ where: { id: m.id }, data: { consecutiveMisses: 0 } });
          }
        } else {
          const misses = m.consecutiveMisses + 1;
          const remove = misses >= 2;
          if (remove) removedNow++;
          await tx.towerRunMember.update({
            where: { id: m.id },
            data: { consecutiveMisses: misses, afkRemoved: remove, removedAt: remove ? new Date() : null },
          });
        }
      }

      const stillActive = active.length - removedNow;
      const nextTurn = run.globalTurn + 1;
      const order = Array.isArray(run.resolutionOrder) ? (run.resolutionOrder as string[]) : [];
      const rotated = order.length ? [...order.slice(1), order[0]] : order;
      const log = [...(vol.log ?? []), `Turno ${run.globalTurn} resolvido.`].slice(-50);

      if (stillActive <= 0) {
        await tx.towerRun.update({
          where: { id: runId },
          data: { status: "FINISHED", endedAt: new Date(), volatileState: { ...vol, submissions: {}, log } },
        });
        return;
      }

      await tx.towerRun.update({
        where: { id: runId },
        data: {
          globalTurn: nextTurn,
          resolutionOrder: rotated,
          nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
          volatileState: { ...vol, submissions: {}, log },
        },
      });
    },
    { timeout: 15000 },
  );
}

/** Varredura (cron): resolve janelas expiradas. Retorna quantas foram resolvidas. */
export async function sweepTowerDeadlines(): Promise<number> {
  const expired = await prisma.towerRun.findMany({
    where: { status: "ACTIVE", nextDeadline: { lte: new Date() } },
    select: { id: true },
    take: 50,
  });
  let resolved = 0;
  for (const r of expired) {
    await resolveTowerTurnLocked(r.id).catch(() => null);
    resolved++;
  }
  return resolved;
}
