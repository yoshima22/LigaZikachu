import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { interactWithMascot, recalculateMood, type InteractionType } from "@/lib/mascot";

const STALE_LOCK_MS = 90_000;
const MAX_ATTEMPTS = 3;

type BulkInteractionType = Extract<InteractionType, "PLAY" | "PET">;
type BulkInteractionScope = "ALL" | "FAVORITES";

export type MascotInteractionJobResult = {
  total: number;
  succeeded: number;
  failed: number;
  succeededIds: string[];
  failures: Array<{ mascotId: string; name: string; message: string }>;
};

function isBulkInteractionType(value: string): value is BulkInteractionType {
  return value === "PLAY" || value === "PET";
}

function isBulkInteractionScope(value: string): value is BulkInteractionScope {
  return value === "ALL" || value === "FAVORITES";
}

/**
 * Processa um pedido persistido. O claim atomico impede dois workers de
 * executarem o mesmo job ao mesmo tempo. Se um worker morrer, o lock expira e
 * o cron retoma o pedido. PLAY/PET tambem sao protegidos pelos cooldowns do
 * proprio mascote, deixando a retomada idempotente por efeito.
 */
export async function processMascotInteractionJob(jobId: string): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  const claimed = await prisma.mascotInteractionJob.updateMany({
    where: {
      id: jobId,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { status: "PENDING" },
        { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "PROCESSING",
      lockedAt: now,
      startedAt: now,
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count === 0) return false;

  const job = await prisma.mascotInteractionJob.findUnique({ where: { id: jobId } });
  if (!job || !isBulkInteractionType(job.interactionType) || !isBulkInteractionScope(job.scope)) {
    await prisma.mascotInteractionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", completedAt: new Date(), lastError: "Pedido de interacao invalido." },
    });
    return false;
  }
  const interactionType = job.interactionType;
  const interactionScope = job.scope;

  try {
    const mascots = await prisma.mascot.findMany({
      where: interactionScope === "FAVORITES"
        ? { playerId: job.playerId, isFavorite: true }
        : { playerId: job.playerId },
      select: { id: true, nickname: true, pokemonId: true, isFavorite: true },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
      take: interactionScope === "FAVORITES" ? 6 : 100,
    });

    const succeededIds: string[] = [];
    const failures: MascotInteractionJobResult["failures"] = [];
    const concurrency = 4;

    for (let index = 0; index < mascots.length; index += concurrency) {
      const batch = mascots.slice(index, index + concurrency);
      const settled = await Promise.all(batch.map(async (mascot) => {
        const name = mascot.nickname ?? `#${mascot.pokemonId}`;
        try {
          await recalculateMood(mascot.id);
          const result = await interactWithMascot(job.playerId, mascot.id, interactionType);
          return { mascotId: mascot.id, name, success: result.success, message: result.message };
        } catch (error) {
          return {
            mascotId: mascot.id,
            name,
            success: false,
            message: error instanceof Error ? error.message : "Erro ao aplicar interacao.",
          };
        }
      }));

      for (const result of settled) {
        if (result.success) succeededIds.push(result.mascotId);
        else failures.push({ mascotId: result.mascotId, name: result.name, message: result.message });
      }
    }

    const result: MascotInteractionJobResult = {
      total: mascots.length,
      succeeded: succeededIds.length,
      failed: failures.length,
      succeededIds,
      failures,
    };
    await prisma.mascotInteractionJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        resultJson: result,
        completedAt: new Date(),
        lockedAt: null,
      },
    });
    revalidateTag(`player-mascots-${job.playerId}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada no processamento.";
    const retry = job.attempts < MAX_ATTEMPTS;
    await prisma.mascotInteractionJob.update({
      where: { id: job.id },
      data: {
        status: retry ? "PENDING" : "FAILED",
        lockedAt: null,
        completedAt: retry ? null : new Date(),
        lastError: message,
      },
    });
    console.error("[MascotInteractionJob] Falha", { jobId, attempt: job.attempts, message });
    return false;
  }
}

export async function processPendingMascotInteractionJobs(limit = 5) {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  const jobs = await prisma.mascotInteractionJob.findMany({
    where: {
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { status: "PENDING" },
        { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  // O fallback e deliberadamente serial para nao abrir dezenas de conexoes ao
  // mesmo tempo quando a Vercel recuperar mais de um pedido interrompido.
  for (const job of jobs) {
    if (await processMascotInteractionJob(job.id)) processed += 1;
  }
  return { found: jobs.length, processed };
}
