"use server";

// Torre dos Rebeldes — Fase 1 (shell admin-only).
// Segurança real no servidor: TODA action verifica isAdmin (ADMIN/SUPER_ADMIN).
// GM é explicitamente NEGADO — nunca usar isStaff aqui.

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import {
  getTowerConfig,
  TOWER_EXPEDITION_ROLES,
  TOWER_ROLE_BY_KEY,
  initialStanceFor,
  towerMaxHp,
} from "@/lib/tower/config";
import { Prisma, type TowerExpeditionRole, type TowerPaceMode } from "@prisma/client";
import { windowMsFor, resolveTowerTurnLocked, runLockKey, type TowerVolatile } from "@/lib/tower/turn";
import { generateEncounter, visibleTiles, type MemberMascotInput } from "@/lib/tower/encounter";
import { tileKey } from "@/lib/tower/engine/grid";
import { normalizeCombatRole } from "@/lib/combat-roles";

const PATH = "/combates/torre-dos-rebeldes";

/** Membro de uma run ainda ativa (LOBBY/ACTIVE) do usuário, se houver. */
async function findActiveRunForUser(userId: string) {
  return prisma.towerRunMember.findFirst({
    where: { userId, afkRemoved: false, run: { status: { in: ["LOBBY", "ACTIVE"] } } },
    select: { run: { select: { id: true, status: true, pace: true, currentFloor: true } } },
  });
}

async function lastEntryAt(userId: string): Promise<number | null> {
  const last = await prisma.towerRunMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    select: { run: { select: { createdAt: true } } },
  });
  return last ? last.run.createdAt.getTime() : null;
}

/** Retorna o usuário só se for ADMIN de plataforma; senão null (GM/USER negados). */
export async function requireTowerAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return null;
  return user;
}

type TowerOverview =
  | { error: string }
  | { ok: true; status: "in_development"; message: string };

/** Visão geral da Torre (placeholder da Fase 1). Guardada por ADMIN. */
export async function getTowerOverviewAction(): Promise<TowerOverview> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  return {
    ok: true,
    status: "in_development",
    message: "Torre dos Rebeldes em desenvolvimento (Fase 1: shell admin-only).",
  };
}

// ── Fase 4 · Lobby & entrada ──────────────────────────────────────────────────

/** Dados para montar o lobby: run ativa, cooldown, mascotes elegíveis, Funções. */
export async function getTowerLobbyDataAction() {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };

  const config = await getTowerConfig();
  const active = await findActiveRunForUser(user.id);
  const lastAt = await lastEntryAt(user.id);
  const nextEntryMs = lastAt !== null ? lastAt + config.entryCooldownMinutes * 60_000 : 0;

  const mascots = await prisma.mascot.findMany({
    where: {
      playerId: player.id,
      arenaState: "FREE",
      bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    orderBy: [{ level: "desc" }, { nickname: "asc" }],
    take: 300,
    select: {
      id: true, pokemonId: true, nickname: true, level: true, preferredCombatRole: true,
      statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
    },
  });

  return {
    ok: true as const,
    config,
    activeRun: active?.run ?? null,
    nextEntryAt: nextEntryMs > Date.now() ? new Date(nextEntryMs).toISOString() : null,
    roles: TOWER_EXPEDITION_ROLES.map((r) => ({
      key: r.key, label: r.label, exploration: r.exploration, benefit: r.benefit, stances: r.stances,
    })),
    mascots: mascots.map((m) => ({ ...m, name: m.nickname ?? getPokemonName(m.pokemonId) })),
  };
}

/** Cria a expedição (host/solo). Valida cooldown, run única e 2 mascotes elegíveis. */
export async function createTowerRunAction(input: {
  pace: TowerPaceMode;
  expeditionRole: TowerExpeditionRole;
  mascotIds: string[];
}): Promise<{ error: string } | { ok: true; runId: string }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };
  const config = await getTowerConfig();

  if (input.pace !== "ONLINE" && input.pace !== "SLOW") return { error: "Ritmo inválido." };
  if (!TOWER_ROLE_BY_KEY[input.expeditionRole]) return { error: "Função de Expedição inválida." };
  const ids = [...new Set(input.mascotIds ?? [])];
  if (ids.length !== 2) return { error: "Selecione exatamente 2 mascotes." };

  if (await findActiveRunForUser(user.id)) return { error: "Você já possui uma expedição ativa na Torre." };

  const lastAt = await lastEntryAt(user.id);
  if (lastAt !== null) {
    const nextAt = lastAt + config.entryCooldownMinutes * 60_000;
    if (Date.now() < nextAt) {
      return { error: `Cooldown de entrada ativo — disponível às ${new Date(nextAt).toLocaleTimeString("pt-BR")}.` };
    }
  }

  const mascots = await prisma.mascot.findMany({
    where: {
      id: { in: ids }, playerId: player.id, arenaState: "FREE", bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
    },
    select: { id: true, level: true, statVitality: true, preferredCombatRole: true },
  });
  if (mascots.length !== 2) return { error: "Um ou mais mascotes não estão disponíveis." };

  // Ticket da Torre: exigência configurável — desligada em desenvolvimento.
  // if (config.requireTicket) { /* consumir Ticket da Torre do inventário */ }

  const seed = randomBytes(12).toString("base64url");
  const allowedStances = TOWER_ROLE_BY_KEY[input.expeditionRole].stances;
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.towerRun.create({
      data: { pace: input.pace, seed, status: "LOBBY", resolutionOrder: [user.id] },
    });
    const member = await tx.towerRunMember.create({
      data: { runId: created.id, userId: user.id, expeditionRole: input.expeditionRole, resolutionIndex: 0 },
    });
    for (const m of mascots) {
      const maxHp = towerMaxHp(m.level, m.statVitality);
      await tx.towerRunMascot.create({
        data: {
          memberId: member.id, mascotId: m.id, ownerUserId: user.id,
          currentHp: maxHp, maxHp,
          currentStance: initialStanceFor(input.expeditionRole, m.preferredCombatRole),
          allowedStances, state: "IN_TOWER",
        },
      });
    }
    return created;
  });
  revalidatePath(PATH);
  return { ok: true as const, runId: run.id };
}

/** Encerra/abandona a expedição do usuário (uso em dev enquanto não há gameplay). */
export async function abandonTowerRunAction(runId: string): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const member = await prisma.towerRunMember.findFirst({ where: { runId, userId: user.id }, select: { id: true } });
  if (!member) return { error: "Você não participa desta expedição." };
  await prisma.towerRun.update({ where: { id: runId }, data: { status: "ABANDONED", endedAt: new Date() } });
  revalidatePath(PATH);
  return { ok: true as const };
}

// ── Fase 5 · Turn Engine (janela global; Online 120s / Lento 4h) ──────────────
// Núcleo em @/lib/tower/turn (compartilhado com o cron; não exposto como action).

/** Inicia a expedição: gera o encounter, LOBBY → ACTIVE e abre a 1ª janela. */
export async function startTowerExpeditionAction(runId: string): Promise<{ error: string } | { ok: true }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    select: {
      id: true, status: true, pace: true, seed: true,
      members: { select: { userId: true, resolutionIndex: true, mascots: { select: { mascotId: true, currentStance: true } } } },
    },
  });
  if (!run) return { error: "Expedição não encontrada." };
  if (!run.members.some((m) => m.userId === user.id)) return { error: "Você não participa desta expedição." };
  if (run.status !== "LOBBY") return { error: "Esta expedição já foi iniciada." };

  const mascotIds = run.members.flatMap((m) => m.mascots.map((x) => x.mascotId));
  const rows = await prisma.mascot.findMany({
    where: { id: { in: mascotIds } },
    select: { id: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const members = run.members.map((m) => ({
    userId: m.userId,
    mascots: m.mascots.flatMap((mm): MemberMascotInput[] => {
      const r = byId.get(mm.mascotId);
      if (!r) return [];
      return [{
        id: r.id, pokemonId: r.pokemonId, name: r.nickname ?? getPokemonName(r.pokemonId), level: r.level,
        force: r.statForce, agility: r.statAgility, instinct: r.statInstinct, vitality: r.statVitality, charisma: r.statCharisma,
        stance: normalizeCombatRole(mm.currentStance),
      }];
    }),
  }));

  const battle = generateEncounter(run.seed, members);
  const order = [...run.members].sort((a, b) => a.resolutionIndex - b.resolutionIndex).map((m) => m.userId);
  await prisma.towerRun.update({
    where: { id: runId },
    data: {
      status: "ACTIVE", startedAt: new Date(), globalTurn: 1, resolutionOrder: order,
      nextDeadline: new Date(Date.now() + windowMsFor(run.pace)),
      volatileState: { submissions: {}, log: ["Expedição iniciada. Um encounter começou!"], battle } as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Estado atual da run (para polling). Resolve o turno se o deadline já passou. */
export async function getTowerRunStateAction(runId: string) {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };

  let run = await prisma.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
  if (!run) return { error: "Expedição não encontrada." };
  if (!run.members.some((m) => m.userId === user.id)) return { error: "Você não participa desta expedição." };

  // Auto-resolução ao acessar após o deadline (além do cron).
  if (run.status === "ACTIVE" && run.nextDeadline && run.nextDeadline.getTime() <= Date.now()) {
    await resolveTowerTurnLocked(runId).catch(() => null);
    run = await prisma.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
    if (!run) return { error: "Expedição não encontrada." };
  }

  const vol = (run.volatileState ?? {}) as TowerVolatile;
  const submissions = vol.submissions ?? {};

  // View do combate com fog de time: aliados sempre; inimigos só se visíveis.
  let battle: null | {
    room: { width: number; height: number; blocked: string[] };
    discovered: string[]; visible: string[];
    units: { id: string; team: string; name: string; pokemonId: number; x: number; y: number; hp: number; maxHp: number; role: string; shield: number }[];
    over: boolean; outcome: "WIN" | "LOSS" | null;
  } = null;
  let myMascots: { id: string; name: string; hp: number; maxHp: number; role: string }[] = [];
  if (vol.battle) {
    const b = vol.battle;
    const vis = visibleTiles(b);
    battle = {
      room: b.room, discovered: b.discovered, visible: [...vis],
      units: b.units
        .filter((u) => u.team === "ALLY" || vis.has(tileKey(u.x, u.y)))
        .map((u) => ({ id: u.id, team: u.team, name: u.name, pokemonId: u.pokemonId, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, role: u.role, shield: u.shield })),
      over: b.encounterOver, outcome: b.outcome ?? null,
    };
    myMascots = b.units
      .filter((u) => u.team === "ALLY" && u.ownerId === user.id)
      .map((u) => ({ id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, role: u.role }));
  }

  return {
    ok: true as const,
    run: {
      id: run.id, status: run.status, pace: run.pace, currentFloor: run.currentFloor,
      globalTurn: run.globalTurn, nextDeadline: run.nextDeadline?.toISOString() ?? null,
    },
    order: (Array.isArray(run.resolutionOrder) ? (run.resolutionOrder as string[]) : []),
    members: run.members.map((m) => ({
      userId: m.userId, expeditionRole: m.expeditionRole, afkRemoved: m.afkRemoved,
      consecutiveMisses: m.consecutiveMisses, confirmed: Boolean(submissions[m.userId]),
    })),
    mine: { userId: user.id, confirmed: Boolean(submissions[user.id]) },
    battle,
    myMascots,
    log: (vol.log ?? []).slice(-12),
  };
}

/** Submete/confirma a ação do turno. Resolve na hora se todos os ativos confirmarem. */
export async function submitTowerActionAction(runId: string, actions: unknown): Promise<{ error: string } | { ok: true; resolved: boolean }> {
  const user = await requireTowerAdmin();
  if (!user) return { error: "Acesso restrito à equipe ADMIN." };

  const resolvedNow = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${runLockKey(runId)})`;
    const run = await tx.towerRun.findUnique({ where: { id: runId }, include: { members: true } });
    if (!run) throw new Error("Expedição não encontrada.");
    if (run.status !== "ACTIVE") throw new Error("A expedição não está aceitando ações.");
    const me = run.members.find((m) => m.userId === user.id);
    if (!me || me.afkRemoved) throw new Error("Você não está ativo nesta expedição.");

    const vol = (run.volatileState ?? {}) as TowerVolatile;
    const submissions = { ...(vol.submissions ?? {}) };
    submissions[user.id] = { confirmedAt: new Date().toISOString(), actions: actions ?? null };
    await tx.towerRun.update({ where: { id: runId }, data: { volatileState: { ...vol, submissions } as unknown as Prisma.InputJsonValue } });

    const active = run.members.filter((m) => !m.afkRemoved);
    return active.every((m) => Boolean(submissions[m.userId]));
  }, { timeout: 15000 });

  if (resolvedNow) await resolveTowerTurnLocked(runId).catch(() => null);
  revalidatePath(PATH);
  return { ok: true as const, resolved: resolvedNow };
}
