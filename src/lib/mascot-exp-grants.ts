import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addExp } from "@/lib/mascot";

const STALE_LOCK_MS = 90_000;

export type ExpGrantPayload = {
  mascotId: string;
  amount: number;
  source: string;
  ignoreBenchPenalty?: boolean;
  ignoreExpBoost?: boolean;
  sourceEntityType?: string;
  sourceEntityId?: string;
};

export async function processMascotExpGrant(jobId: string, invalidateCache = true): Promise<boolean> {
  const now = new Date();
  const claimed = await prisma.mascotInteractionJob.updateMany({
    where: {
      id: jobId,
      interactionType: "EXP_GRANT",
      OR: [
        { status: "PENDING" },
        { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } },
      ],
    },
    data: { status: "PROCESSING", lockedAt: now, startedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return false;

  const job = await prisma.mascotInteractionJob.findUnique({
    where: { id: jobId },
    select: { id: true, playerId: true, attempts: true, resultJson: true },
  });
  if (!job) return false;
  const payload = job.resultJson as ExpGrantPayload | null;
  if (!payload || typeof payload.mascotId !== "string" || !Number.isSafeInteger(payload.amount) || payload.amount <= 0 || typeof payload.source !== "string") {
    await prisma.mascotInteractionJob.update({ where: { id: jobId }, data: { status: "FAILED", completedAt: new Date(), lockedAt: null, lastError: "Concessão de EXP inválida." } });
    return false;
  }

  try {
    await addExp(payload.mascotId, payload.amount, {
      source: payload.source,
      ignoreBenchPenalty: payload.ignoreBenchPenalty,
      ignoreExpBoost: payload.ignoreExpBoost,
      sourceEntityType: payload.sourceEntityType,
      sourceEntityId: payload.sourceEntityId,
      grantJobId: job.id,
    });
    // EXP bloqueada ou nível máximo não executam a transação de progresso.
    await prisma.mascotInteractionJob.updateMany({
      where: { id: job.id, status: "PROCESSING" },
      data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null },
    });
    if (invalidateCache) revalidateTag(`player-mascots-${job.playerId}`);
    return true;
  } catch (error) {
    // Se o commit da EXP ocorreu, uma falha posterior no log não deve repetir a concessão.
    const stillProcessing = await prisma.mascotInteractionJob.updateMany({
      where: { id: job.id, status: "PROCESSING" },
      data: {
        status: "PENDING",
        lockedAt: null,
        completedAt: null,
        lastError: error instanceof Error ? error.message : "Falha ao aplicar EXP.",
      },
    });
    if (stillProcessing.count === 0) return true;
    console.error("[mascot-exp-grant] failed", { jobId, attempt: job.attempts, error });
    return false;
  }
}

export async function processPendingMascotExpGrants(limit = 20) {
  const deadline = Date.now() + 40_000;
  const jobs = await prisma.mascotInteractionJob.findMany({
    where: {
      interactionType: "EXP_GRANT",
      OR: [
        { status: "PENDING" },
        { status: "PROCESSING", lockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } },
      ],
    },
    select: { id: true, playerId: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  const affected = new Set<string>();
  try {
    for (const job of jobs) {
      if (Date.now() >= deadline) break;
      affected.add(job.playerId);
      if (await processMascotExpGrant(job.id, false)) processed += 1;
    }
  } finally {
    for (const playerId of affected) revalidateTag(`player-mascots-${playerId}`);
  }
  return { found: jobs.length, processed };
}

export async function processMascotExpGrantBatch(jobIds: string[]) {
  const jobs = await prisma.mascotInteractionJob.findMany({
    where: { id: { in: jobIds }, interactionType: "EXP_GRANT" }, select: { id: true, playerId: true },
  });
  const deadline = Date.now() + 40_000;
  const affected = new Set<string>();
  try {
    for (let index = 0; index < jobs.length; index += 2) {
      if (Date.now() >= deadline) break; // Remaining jobs are durable and picked up by cron.
      const batch = jobs.slice(index, index + 2);
      for (const job of batch) affected.add(job.playerId);
      await Promise.allSettled(batch.map((job) => processMascotExpGrant(job.id, false)));
    }
  } finally {
    for (const playerId of affected) revalidateTag(`player-mascots-${playerId}`);
  }
}
