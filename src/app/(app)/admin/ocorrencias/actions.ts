"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MascotOccurrenceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import {
  createOccurrenceBatch,
  occurrenceBlockReason,
  occurrenceMascotName,
  occurrenceMascotSelect,
  processDueOccurrences,
  returnOccurrences,
} from "@/lib/mascot-occurrences";
import { OCCURRENCE_TAGS } from "@/lib/mascot-occurrence-phrases";

async function requireOccurrenceAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) throw new Error("Acesso restrito a administradores.");
  return user;
}

const fail = (error: unknown) => ({ error: error instanceof Error ? error.message : "Erro inesperado." });

export type OccurrencePlayerRow = { id: string; displayName: string; nick: string | null; total: number; eligible: number };
export type OccurrenceMascotRow = {
  id: string;
  playerId: string;
  playerName: string;
  pokemonId: number;
  name: string;
  level: number;
  isShiny: boolean;
  state: string;
  reason: string | null;
};

const PAGE_SIZE = 20;

function playerWhere(q: string): Prisma.PlayerWhereInput {
  const term = q.trim();
  return {
    active: true,
    user: { status: "ACTIVE" },
    ...(term
      ? { OR: [{ displayName: { contains: term, mode: "insensitive" } }, { ptcglNick: { contains: term, mode: "insensitive" } }, { id: term }] }
      : {}),
  };
}

export async function searchOccurrencePlayersAction(input: { q: string; page: number }): Promise<{ error?: string; players?: OccurrencePlayerRow[]; total?: number; pages?: number }> {
  try {
    await requireOccurrenceAdmin();
    const { q, page } = z.object({ q: z.string().max(80), page: z.number().int().min(0) }).parse(input);
    const where = playerWhere(q);
    const [total, players] = await Promise.all([
      prisma.player.count({ where }),
      prisma.player.findMany({ where, orderBy: { displayName: "asc" }, skip: page * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, displayName: true, ptcglNick: true } }),
    ]);
    const mascots = await prisma.mascot.findMany({ where: { playerId: { in: players.map((p) => p.id) } }, select: occurrenceMascotSelect });
    const now = new Date();
    const stats = new Map<string, { total: number; eligible: number }>();
    for (const m of mascots) {
      const s = stats.get(m.playerId) ?? { total: 0, eligible: 0 };
      s.total++;
      if (!occurrenceBlockReason(m, now)) s.eligible++;
      stats.set(m.playerId, s);
    }
    return {
      total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      players: players.map((p) => ({ id: p.id, displayName: p.displayName, nick: p.ptcglNick, total: stats.get(p.id)?.total ?? 0, eligible: stats.get(p.id)?.eligible ?? 0 })),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function listFilteredOccurrencePlayersAction(q: string): Promise<{ error?: string; players?: Array<{ id: string; displayName: string }> }> {
  try {
    await requireOccurrenceAdmin();
    const players = await prisma.player.findMany({ where: playerWhere(z.string().max(80).parse(q)), orderBy: { displayName: "asc" }, take: 1000, select: { id: true, displayName: true } });
    return { players };
  } catch (error) {
    return fail(error);
  }
}

async function loadMascotRows(playerIds: string[]): Promise<OccurrenceMascotRow[]> {
  const mascots = await prisma.mascot.findMany({
    where: { playerId: { in: playerIds } },
    select: { ...occurrenceMascotSelect, player: { select: { displayName: true } } },
    orderBy: [{ level: "desc" }, { id: "asc" }],
    take: 4000,
  });
  const now = new Date();
  return mascots.map((m) => ({
    id: m.id,
    playerId: m.playerId,
    playerName: m.player.displayName,
    pokemonId: m.pokemonId,
    name: occurrenceMascotName(m),
    level: m.level,
    isShiny: m.isShiny,
    state: m.arenaState,
    reason: occurrenceBlockReason(m, now),
  }));
}

const playerIdsSchema = z.array(z.string().min(1)).min(1, "Selecione ao menos um jogador.").max(1000);

export async function listOccurrenceMascotsAction(playerIds: string[]): Promise<{ error?: string; mascots?: OccurrenceMascotRow[] }> {
  try {
    await requireOccurrenceAdmin();
    return { mascots: await loadMascotRows(playerIdsSchema.parse(playerIds)) };
  } catch (error) {
    return fail(error);
  }
}

/** Sorteia separadamente para cada jogador; o resultado é só uma sugestão até o admin confirmar. */
export async function drawOccurrenceMascotsAction(input: {
  playerIds: string[]; minLevel: number; maxLevel: number; perPlayer: number; pokemonIds?: number[];
}): Promise<{ error?: string; mascots?: OccurrenceMascotRow[]; playersWithoutEligible?: string[] }> {
  try {
    await requireOccurrenceAdmin();
    const data = z.object({
      playerIds: playerIdsSchema,
      minLevel: z.number().int().min(1).max(100),
      maxLevel: z.number().int().min(1).max(100),
      perPlayer: z.number().int().min(1).max(10),
      pokemonIds: z.array(z.number().int()).optional(),
    }).parse(input);
    if (data.minLevel > data.maxLevel) throw new Error("Nível mínimo maior que o máximo.");
    const rows = await loadMascotRows(data.playerIds);
    const chosen: OccurrenceMascotRow[] = [];
    const without: string[] = [];
    for (const playerId of data.playerIds) {
      const pool = rows.filter((m) =>
        m.playerId === playerId && !m.reason && m.level >= data.minLevel && m.level <= data.maxLevel &&
        (!data.pokemonIds?.length || data.pokemonIds.includes(m.pokemonId)));
      if (pool.length === 0) {
        without.push(rows.find((m) => m.playerId === playerId)?.playerName ?? playerId);
        continue;
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      chosen.push(...pool.slice(0, data.perPlayer));
    }
    return { mascots: chosen, playersWithoutEligible: without };
  } catch (error) {
    return fail(error);
  }
}

export async function createOccurrencesAction(input: {
  items: Array<{ playerId: string; mascotId: string }>;
  tag: string;
  message: string;
  returnMessage?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  showDeadline: boolean;
}) {
  try {
    const admin = await requireOccurrenceAdmin();
    const data = z.object({
      items: z.array(z.object({ playerId: z.string().min(1), mascotId: z.string().min(1) })).min(1, "Nenhum mascote na lista.").max(2000),
      tag: z.enum(OCCURRENCE_TAGS as [string, ...string[]]),
      message: z.string().trim().min(5, "Escreva a mensagem.").max(1200),
      returnMessage: z.string().trim().max(1200).nullish(),
      startsAt: z.string().nullish(),
      endsAt: z.string().nullish(),
      showDeadline: z.boolean(),
    }).parse(input);
    const startsAt = data.startsAt ? new Date(data.startsAt) : null;
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new Error("Data inválida.");
    const result = await createOccurrenceBatch(admin.id, data.items, {
      tag: data.tag as (typeof OCCURRENCE_TAGS)[number],
      message: data.message,
      returnMessage: data.returnMessage,
      startsAt,
      endsAt,
      showDeadline: data.showDeadline,
    });
    revalidatePath("/admin/ocorrencias");
    return result;
  } catch (error) {
    return fail(error);
  }
}

export type OccurrenceListRow = {
  id: string;
  playerName: string;
  mascotName: string;
  pokemonId: number;
  isShiny: boolean;
  level: number;
  tag: string;
  status: MascotOccurrenceStatus;
  message: string;
  returnMessage: string | null;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  noticeRead: boolean;
  returnNoticeRead: boolean;
  adminName: string;
};

export async function listOccurrencesAction(input: { scope: "active" | "history"; q?: string }): Promise<{ error?: string; rows?: OccurrenceListRow[] }> {
  try {
    await requireOccurrenceAdmin();
    const { scope, q } = z.object({ scope: z.enum(["active", "history"]), q: z.string().max(80).optional() }).parse(input);
    await processDueOccurrences().catch(() => null);
    const term = q?.trim();
    const rows = await prisma.mascotOccurrence.findMany({
      where: {
        status: scope === "active" ? { in: ["SCHEDULED", "ACTIVE"] } : { in: ["RETURNED", "EXPIRED", "CANCELLED"] },
        ...(term ? { OR: [{ player: { displayName: { contains: term, mode: "insensitive" } } }, { mascot: { nickname: { contains: term, mode: "insensitive" } } }] } : {}),
      },
      orderBy: scope === "active" ? { startsAt: "desc" } : { endedAt: "desc" },
      take: 300,
      select: {
        id: true, tag: true, status: true, message: true, returnMessage: true, startsAt: true, endsAt: true, endedAt: true,
        noticeReadAt: true, returnNoticeReadAt: true, createdById: true,
        player: { select: { displayName: true } },
        mascot: { select: { pokemonId: true, nickname: true, speciesNameOverride: true, isShiny: true, level: true } },
      },
    });
    const admins = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } }, select: { id: true, name: true, email: true } });
    const adminName = new Map(admins.map((a) => [a.id, a.name ?? a.email ?? a.id]));
    return {
      rows: rows.map((r) => ({
        id: r.id,
        playerName: r.player.displayName,
        mascotName: occurrenceMascotName(r.mascot),
        pokemonId: r.mascot.pokemonId,
        isShiny: r.mascot.isShiny,
        level: r.mascot.level,
        tag: r.tag,
        status: r.status,
        message: r.message,
        returnMessage: r.returnMessage,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt?.toISOString() ?? null,
        endedAt: r.endedAt?.toISOString() ?? null,
        noticeRead: Boolean(r.noticeReadAt),
        returnNoticeRead: Boolean(r.returnNoticeReadAt),
        adminName: adminName.get(r.createdById) ?? r.createdById,
      })),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function returnOccurrencesAction(ids: string[]) {
  try {
    const admin = await requireOccurrenceAdmin();
    const parsed = z.array(z.string().min(1)).min(1).max(1000).parse(ids);
    const results = await returnOccurrences(admin.id, parsed);
    revalidatePath("/admin/ocorrencias");
    return { results };
  } catch (error) {
    return fail(error);
  }
}
