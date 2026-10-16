import { randomUUID } from "node:crypto";
import { Prisma, type MascotOccurrenceStatus, type MascotOccurrenceTag } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { OCCURRENCE_RETURN_DEFAULT, renderOccurrenceText } from "@/lib/mascot-occurrence-phrases";

// Ocorrência ativa = mascote em repouso (arenaState RESTING + restingUntil), o mecanismo que
// Arena, Expedição, Refúgio, Caçada e equipamentos já respeitam. O estado original fica salvo
// na ocorrência e só é restaurado se ninguém mexeu no repouso nesse meio-tempo.
const INDEFINITE_BLOCK_UNTIL = new Date("2099-12-31T23:59:59.000Z");
const OPEN_STATUSES: MascotOccurrenceStatus[] = ["SCHEDULED", "ACTIVE"];

export function occurrenceMascotName(m: { nickname: string | null; speciesNameOverride: string | null; pokemonId: number }) {
  return m.nickname ?? m.speciesNameOverride ?? getPokemonName(m.pokemonId);
}

export const occurrenceMascotSelect = {
  id: true,
  playerId: true,
  pokemonId: true,
  nickname: true,
  speciesNameOverride: true,
  level: true,
  isShiny: true,
  arenaState: true,
  restingUntil: true,
  bazarListed: true,
  expeditions: { where: { status: "ACTIVE" }, take: 1, select: { id: true } },
  routine: { select: { status: true } },
  occurrences: { where: { status: { in: OPEN_STATUSES } }, take: 1, select: { id: true } },
} satisfies Prisma.MascotSelect;

type EligibilityMascot = Prisma.MascotGetPayload<{ select: typeof occurrenceMascotSelect }>;

/** Motivo pelo qual o mascote não pode receber uma ocorrência (null = elegível). */
export function occurrenceBlockReason(m: EligibilityMascot, now = new Date()): string | null {
  if (m.occurrences.length > 0) return "Já tem uma ocorrência em andamento ou agendada";
  if (m.bazarListed) return "Anunciado no Bazar";
  if (m.expeditions.length > 0) return "Em expedição";
  if (m.routine?.status === "ACTIVE") return "Ocupado no Refúgio";
  if (m.arenaState === "ARENA") return "Em equipe da Arena";
  if (m.arenaState === "INJURED") return "Ferido";
  if (m.arenaState === "TRACE_HIDING" || m.arenaState === "TRACE_HUNTING") return "Em Caçada de Rastros";
  if (m.arenaState === "RESTING" && m.restingUntil && m.restingUntil > now) return "Em repouso";
  return null;
}

export type OccurrenceConfig = {
  tag: MascotOccurrenceTag;
  message: string;
  returnMessage?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  showDeadline: boolean;
};

type TxClient = Prisma.TransactionClient;

async function lockMascot(tx: TxClient, mascotId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`occurrence:${mascotId}`}))`;
}

async function audit(tx: TxClient, actorUserId: string | null, entityId: string, action: string, after?: Prisma.InputJsonValue) {
  await tx.auditLog.create({ data: { actorUserId, entityType: "MascotOccurrence", entityId, action, after } }).catch(() => null);
}

/** SCHEDULED → ACTIVE: reconfere elegibilidade, aplica o bloqueio e notifica. Idempotente. */
async function activateOccurrence(id: string, now: Date): Promise<"activated" | "cancelled" | "skipped"> {
  return prisma.$transaction(async (tx) => {
    const occ = await tx.mascotOccurrence.findUnique({ where: { id } });
    if (!occ || occ.status !== "SCHEDULED") return "skipped";
    await lockMascot(tx, occ.mascotId);
    const mascot = await tx.mascot.findUnique({ where: { id: occ.mascotId }, select: occurrenceMascotSelect });
    const reason = mascot ? occurrenceBlockReason({ ...mascot, occurrences: [] }, now) : "Mascote não encontrado";
    if (!mascot || reason) {
      const claimed = await tx.mascotOccurrence.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "CANCELLED", endedAt: now } });
      if (claimed.count === 0) return "skipped";
      await audit(tx, null, id, "ACTIVATION_CANCELLED", { reason });
      return "cancelled";
    }
    const blockUntil = occ.endsAt ?? INDEFINITE_BLOCK_UNTIL;
    const claimed = await tx.mascotOccurrence.updateMany({
      where: { id, status: "SCHEDULED" },
      data: { status: "ACTIVE", activatedAt: now, blockUntil, previousArenaState: mascot.arenaState, previousRestingUntil: mascot.restingUntil },
    });
    if (claimed.count === 0) return "skipped";
    await tx.mascot.update({ where: { id: mascot.id }, data: { arenaState: "RESTING", restingUntil: blockUntil } });
    await tx.playerNotification.createMany({
      data: [{
        playerId: occ.playerId, category: "OCCURRENCE", type: "MASCOT_OCCURRENCE_START", title: "Algo estranho aconteceu...",
        body: occ.message, href: "/mascotes", entityId: occ.id, eventKey: `occurrence:${occ.id}:start`,
      }],
      skipDuplicates: true,
    });
    await audit(tx, occ.createdById, id, "ACTIVATED", { mascotId: occ.mascotId, blockUntil: blockUntil.toISOString() });
    return "activated";
  });
}

/** ACTIVE → RETURNED/EXPIRED (ou SCHEDULED → CANCELLED). Só libera o que a própria ocorrência bloqueou. Idempotente. */
async function endOccurrence(
  id: string,
  mode: "RETURNED" | "EXPIRED",
  actorUserId: string | null,
  now: Date,
): Promise<"ended" | "cancelled" | "skipped"> {
  return prisma.$transaction(async (tx) => {
    const occ = await tx.mascotOccurrence.findUnique({ where: { id } });
    if (!occ || !OPEN_STATUSES.includes(occ.status)) return "skipped";
    await lockMascot(tx, occ.mascotId);

    if (occ.status === "SCHEDULED") {
      const claimed = await tx.mascotOccurrence.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "CANCELLED", endedAt: now, returnedById: actorUserId } });
      if (claimed.count === 0) return "skipped";
      await audit(tx, actorUserId, id, "CANCELLED");
      return "cancelled";
    }

    const claimed = await tx.mascotOccurrence.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: mode, endedAt: now, returnedById: actorUserId },
    });
    if (claimed.count === 0) return "skipped";

    // Restaura só se o repouso ainda é o da ocorrência; outro repouso/estado posterior é respeitado.
    let restored = false;
    if (occ.blockUntil) {
      const keepPrevious = occ.previousRestingUntil && occ.previousRestingUntil > now;
      const res = await tx.mascot.updateMany({
        where: { id: occ.mascotId, arenaState: "RESTING", restingUntil: occ.blockUntil },
        data: keepPrevious
          ? { arenaState: "RESTING", restingUntil: occ.previousRestingUntil }
          : { arenaState: "FREE", restingUntil: null },
      });
      restored = res.count > 0;
    }
    const returnText = occ.returnMessage?.trim() ? occ.returnMessage : null;
    await tx.playerNotification.createMany({
      data: [{
        playerId: occ.playerId, category: "OCCURRENCE", type: "MASCOT_OCCURRENCE_RETURN", title: "Boas notícias do refúgio",
        body: returnText ?? OCCURRENCE_RETURN_DEFAULT, href: "/mascotes", entityId: occ.id, eventKey: `occurrence:${occ.id}:return`,
      }],
      skipDuplicates: true,
    });
    await audit(tx, actorUserId, id, mode, { mascotId: occ.mascotId, restoredState: restored });
    return "ended";
  });
}

/** Ativa as agendadas que venceram e encerra as ativas cujo prazo passou. */
export async function processDueOccurrences(now = new Date(), playerId?: string) {
  const scope = playerId ? { playerId } : {};
  const [toStart, toEnd] = await Promise.all([
    prisma.mascotOccurrence.findMany({ where: { ...scope, status: "SCHEDULED", startsAt: { lte: now } }, select: { id: true }, take: 500 }),
    prisma.mascotOccurrence.findMany({ where: { ...scope, status: "ACTIVE", endsAt: { lte: now } }, select: { id: true }, take: 500 }),
  ]);
  let activated = 0;
  let ended = 0;
  for (const { id } of toStart) if ((await activateOccurrence(id, now).catch(() => "skipped")) === "activated") activated++;
  for (const { id } of toEnd) if ((await endOccurrence(id, "EXPIRED", null, now).catch(() => "skipped")) === "ended") ended++;
  return { activated, ended };
}

export type OccurrenceItemResult = { playerId: string; mascotId: string; ok: boolean; id?: string; error?: string };

/** Cria as ocorrências da lista congelada pelo admin. Cada item é validado e processado em separado. */
export async function createOccurrenceBatch(
  adminUserId: string,
  items: Array<{ playerId: string; mascotId: string } & OccurrenceConfig>,
) {
  const now = new Date();
  const batchId = randomUUID();
  const unique = new Map(items.map((i) => [i.mascotId, i]));
  const results: OccurrenceItemResult[] = [];

  for (const item of unique.values()) {
    try {
      const config = item;
      const startsAt = config.startsAt && config.startsAt > now ? config.startsAt : now;
      if (config.endsAt && config.endsAt <= startsAt) throw new Error("O término precisa ser depois do início.");
      const id = await prisma.$transaction(async (tx) => {
        await lockMascot(tx, item.mascotId);
        const mascot = await tx.mascot.findUnique({ where: { id: item.mascotId }, select: occurrenceMascotSelect });
        if (!mascot || mascot.playerId !== item.playerId) throw new Error("Mascote não pertence ao jogador selecionado.");
        const reason = occurrenceBlockReason(mascot, now);
        if (reason) throw new Error(reason);
        const name = occurrenceMascotName(mascot);
        const occ = await tx.mascotOccurrence.create({
          data: {
            batchId,
            playerId: item.playerId,
            mascotId: item.mascotId,
            tag: config.tag,
            status: "SCHEDULED",
            message: renderOccurrenceText(config.message, name),
            returnMessage: config.returnMessage?.trim() ? renderOccurrenceText(config.returnMessage, name) : null,
            startsAt,
            endsAt: config.endsAt ?? null,
            showDeadline: config.showDeadline,
            createdById: adminUserId,
          },
        });
        await audit(tx, adminUserId, occ.id, "CREATED", { batchId, tag: config.tag, startsAt: startsAt.toISOString(), endsAt: config.endsAt?.toISOString() ?? null });
        return occ.id;
      });
      results.push({ playerId: item.playerId, mascotId: item.mascotId, ok: true, id });
    } catch (error) {
      results.push({ playerId: item.playerId, mascotId: item.mascotId, ok: false, error: error instanceof Error ? error.message : "Falha ao criar ocorrência." });
    }
  }

  await prisma.auditLog.create({
    data: { actorUserId: adminUserId, entityType: "MascotOccurrenceBatch", entityId: batchId, action: "CREATED", after: { count: items.length, results } as unknown as Prisma.InputJsonValue },
  }).catch(() => null);

  // Início imediato (ou já vencido): ativa agora; as agendadas ficam para o processamento periódico/on-access.
  await processDueOccurrences(now);
  return { batchId, results };
}

/** Retorno manual (individual ou em lote). Falha parcial não derruba o restante. */
export async function returnOccurrences(adminUserId: string, ids: string[]) {
  const now = new Date();
  const results: Array<{ id: string; ok: boolean; outcome?: string; error?: string }> = [];
  for (const id of [...new Set(ids)]) {
    try {
      const outcome = await endOccurrence(id, "RETURNED", adminUserId, now);
      results.push({ id, ok: outcome !== "skipped", outcome, error: outcome === "skipped" ? "Já encerrada ou inexistente." : undefined });
    } catch (error) {
      results.push({ id, ok: false, error: error instanceof Error ? error.message : "Falha ao retornar." });
    }
  }
  await prisma.auditLog.create({
    data: { actorUserId: adminUserId, entityType: "MascotOccurrenceBatch", entityId: randomUUID(), action: "RETURN_BATCH", after: { results } as unknown as Prisma.InputJsonValue },
  }).catch(() => null);
  return results;
}

// ── Avisos para o jogador ────────────────────────────────────────────────────

export type OccurrenceNotice = {
  id: string;
  kind: "START" | "RETURN";
  tag: MascotOccurrenceTag;
  mascotName: string;
  pokemonId: number;
  isShiny: boolean;
  message: string;
  endsAt: string | null;
  showDeadline: boolean;
};

/** Avisos pendentes (ocorrência iniciada ou retorno) ainda não confirmados pelo jogador. */
export async function getOccurrenceNoticesForPlayer(playerId: string): Promise<OccurrenceNotice[]> {
  await processDueOccurrences(new Date(), playerId).catch(() => null);
  const rows = await prisma.mascotOccurrence.findMany({
    where: {
      playerId,
      OR: [
        { status: "ACTIVE", noticeReadAt: null },
        { status: { in: ["RETURNED", "EXPIRED"] }, returnNoticeReadAt: null },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true, status: true, tag: true, message: true, returnMessage: true, endsAt: true, showDeadline: true, noticeReadAt: true,
      mascot: { select: { pokemonId: true, nickname: true, speciesNameOverride: true, isShiny: true } },
    },
  });
  return rows.flatMap((r) => {
    // Encerrada antes de o jogador ler o aviso inicial: mostra só o retorno.
    const isReturn = r.status !== "ACTIVE";
    return [{
      id: r.id,
      kind: isReturn ? ("RETURN" as const) : ("START" as const),
      tag: r.tag,
      mascotName: occurrenceMascotName(r.mascot),
      pokemonId: r.mascot.pokemonId,
      isShiny: r.mascot.isShiny,
      message: isReturn ? (r.returnMessage?.trim() ? r.returnMessage : renderOccurrenceText(OCCURRENCE_RETURN_DEFAULT, occurrenceMascotName(r.mascot))) : r.message,
      endsAt: r.endsAt?.toISOString() ?? null,
      showDeadline: r.showDeadline,
    }];
  });
}

export async function acknowledgeOccurrenceNotice(playerId: string, id: string, kind: "START" | "RETURN") {
  const now = new Date();
  if (kind === "START") {
    await prisma.mascotOccurrence.updateMany({ where: { id, playerId, noticeReadAt: null }, data: { noticeReadAt: now } });
  } else {
    await prisma.mascotOccurrence.updateMany({
      where: { id, playerId, returnNoticeReadAt: null, status: { in: ["RETURNED", "EXPIRED"] } },
      data: { returnNoticeReadAt: now, noticeReadAt: now },
    });
  }
}
