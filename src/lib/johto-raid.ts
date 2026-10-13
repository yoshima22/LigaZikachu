// Raid dos Líderes de Johto: estado, ataque atômico, prêmios por líder e escolha de mascote. Dados/simulação em johto-raid-sim.ts.
import { revalidateTag, unstable_cache } from "next/cache";
import { MascotPersonality, Prisma, ZikaCoinTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { toLeagueMascot } from "@/lib/league-combat";
import { publishLeagueTicker } from "@/lib/league-ticker";
import { EGG_SHINY_CHANCE, EGG_STAT_RANGES, getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import {
  COMBO_MAX_STACKS, COMBO_WINDOW_MS, comboBonusPct, computeLeaderRewards, DEFAULT_JOHTO_REWARDS, getJohtoLeader, JOHTO_DEFAULT_COOLDOWN_MIN, JOHTO_DEFAULT_DAMAGE_SCALE,
  JOHTO_DEFAULT_LEADER_DAYS, JOHTO_EVENT_SLUG, JOHTO_LEADER_HP, JOHTO_LEADERS, JOHTO_MASCOTS_PER_LEADER, JOHTO_REPLAY_HISTORY,
  JOHTO_VISIBLE_KEY, readRewardConfig, runJohtoBattle, toReplayLineup, type JohtoLeaderDef, type JohtoBattleOutcome,
} from "@/lib/johto-raid-sim";

const NON_ADMIN = { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] as ("ADMIN" | "SUPER_ADMIN")[] } } };
const isAdminRole = (role: string | null | undefined) => role === "ADMIN" || role === "SUPER_ADMIN";
const HREF = "/combates/raid-johto";
const DAY_MS = 86_400_000;

// ── Visibilidade ─────────────────────────────────────────────────────────────

// Cache curto: o layout consulta isto em toda página; o toggle do admin invalida a tag na hora.
export const isJohtoRaidVisibleToPlayers = unstable_cache(async (): Promise<boolean> => {
  const setting = await prisma.appSetting.findUnique({ where: { key: JOHTO_VISIBLE_KEY }, select: { value: true } }).catch(() => null);
  return setting?.value === true;
}, ["johto-raid-visible"], { revalidate: 60, tags: ["johto-raid-visible"] });

export async function setJohtoRaidVisible(visible: boolean) {
  await prisma.appSetting.upsert({ where: { key: JOHTO_VISIBLE_KEY }, create: { key: JOHTO_VISIBLE_KEY, value: visible }, update: { value: visible } });
  revalidateTag("johto-raid-visible");
}

// ── Tipos de estado ──────────────────────────────────────────────────────────

export type JohtoMascotState = { slot: number; pokemonId: number; name: string; hpMax: number; hpCurrent: number; defeated: boolean; defeatedByName: string | null; role: string; personality: string; types: string[] };

export type JohtoLeaderState = Omit<JohtoLeaderDef, "roster"> & {
  id: string; position: number; hpMax: number; hpCurrent: number; status: "DEFEATED" | "ESCAPED" | "CURRENT" | "WAITING";
  startedAt: string | null; expiresAt: string | null; defeatedAt: string | null; finalBlowName: string | null;
  mascots: JohtoMascotState[]; rosterPokemonIds: number[];
};

export type JohtoLeaderRankingEntry = { playerId: string; playerName: string; damage: number; attackCount: number; highestSingleDamage: number };
export type JohtoPendingReward = { id: string; leaderKey: string; leaderName: string; tier: string; zc: number; level: number; egg: boolean; claimed: boolean; chosenPokemonId: number | null; options: number[] };
export type JohtoRecentFight = { id: string; playerName: string; leaderName: string; damage: number; win: boolean; createdAt: string; hasReplay: boolean };

export type JohtoRaidState = {
  event: {
    id: string; name: string; active: boolean; defeatedAt: string | null; cooldownMinutes: number; damageScale: number; leaderDays: number;
    rewards: ReturnType<typeof readRewardConfig>;
  } | null;
  leaders: JohtoLeaderState[];
  current: JohtoLeaderState | null;
  totalHpMax: number;
  totalHpCurrent: number;
  currentRanking: JohtoLeaderRankingEntry[];
  recent: JohtoRecentFight[];
  participants: number;
  totalAttacks: number;
  me: { damageOnCurrent: number; attacksOnCurrent: number; rankOnCurrent: number | null; cooldownUntil: string | null } | null;
  myRewards: JohtoPendingReward[];
  /** Regra do evento: só UM mascote pode ser escolhido em toda a raid. Preenchido quando o jogador já usou a escolha. */
  choiceUsed: { leaderName: string; pokemonId: number } | null;
  /** Combo de ataque em grupo para o próximo ataque de quem está vendo (treinadores que atacaram nos últimos 30 min). */
  combo: JohtoComboState;
};

export type JohtoComboState = { stacks: number; bonusPct: number; nextDropAt: string | null };

// O slug só é trocado nos testes (para não tocar no evento real).
let eventSlug = JOHTO_EVENT_SLUG;
export function useJohtoEventSlugForTests(slug: string) { eventSlug = slug; }

export async function getJohtoEvent() {
  return prisma.johtoRaidEvent.findUnique({ where: { slug: eventSlug } });
}

/** Eventos criados antes dos times de 6 mascotes não têm linhas de mascote: completa (idempotente). */
async function ensureLeaderMascots(eventId: string) {
  const leaders = await prisma.johtoRaidLeader.findMany({ where: { eventId }, select: { id: true, key: true, hpMax: true, hpCurrent: true, _count: { select: { mascots: true } } } });
  for (const leader of leaders) {
    const def = getJohtoLeader(leader.key);
    if (!def || leader._count.mascots > 0) continue;
    const per = Math.floor(leader.hpMax / JOHTO_MASCOTS_PER_LEADER);
    const left = Math.min(per, Math.round(leader.hpCurrent / JOHTO_MASCOTS_PER_LEADER));
    await prisma.johtoRaidLeaderMascot.createMany({ data: def.roster.map((entry, slot) => ({ leaderId: leader.id, slot, pokemonId: entry.pokemonId, hpMax: per, hpCurrent: left })), skipDuplicates: true });
  }
}

// ── Criação e prazo dos líderes ──────────────────────────────────────────────

/** Cria (ou recria, apagando o anterior) o evento com os 8 líderes e seus 6 mascotes. Não ativa nem libera aos jogadores. */
export async function createJohtoEvent(options: { reset?: boolean; hpPerLeader?: number } = {}) {
  const existing = await getJohtoEvent();
  if (existing && !options.reset) return existing;
  if (existing) await prisma.johtoRaidEvent.delete({ where: { id: existing.id } });
  const mascotHp = Math.max(60, Math.min(300_000_000, Math.floor((options.hpPerLeader ?? JOHTO_LEADER_HP) / JOHTO_MASCOTS_PER_LEADER)));
  return prisma.johtoRaidEvent.create({
    data: {
      slug: eventSlug, name: "Raid dos Líderes de Johto", active: false, cooldownMinutes: JOHTO_DEFAULT_COOLDOWN_MIN,
      damageScale: JOHTO_DEFAULT_DAMAGE_SCALE, leaderDays: JOHTO_DEFAULT_LEADER_DAYS,
      rewardConfigJson: DEFAULT_JOHTO_REWARDS as unknown as Prisma.InputJsonValue,
      leaders: {
        create: JOHTO_LEADERS.map((leader, position) => ({
          position, key: leader.key, hpMax: mascotHp * JOHTO_MASCOTS_PER_LEADER, hpCurrent: mascotHp * JOHTO_MASCOTS_PER_LEADER,
          mascots: { create: leader.roster.map((entry, slot) => ({ slot, pokemonId: entry.pokemonId, hpMax: mascotHp, hpCurrent: mascotHp })) },
        })),
      },
    },
  });
}

/** Abre a janela de prazo do primeiro líder ainda sem prazo (ao abrir os ataques ou ao avançar). */
export async function openNextLeaderWindow(eventId: string, now = new Date()) {
  const event = await prisma.johtoRaidEvent.findUnique({ where: { id: eventId }, select: { leaderDays: true } });
  if (!event) return null;
  const leaders = await prisma.johtoRaidLeader.findMany({ where: { eventId }, orderBy: { position: "asc" } });
  if (leaders.some((l) => l.startedAt && !l.defeatedAt && !l.escapedAt)) return null;
  const next = leaders.find((l) => !l.startedAt && !l.defeatedAt && !l.escapedAt);
  if (!next) return null;
  const opened = await prisma.johtoRaidLeader.updateMany({
    where: { id: next.id, startedAt: null, defeatedAt: null, escapedAt: null },
    data: { startedAt: now, expiresAt: new Date(now.getTime() + event.leaderDays * DAY_MS) },
  });
  return opened.count ? prisma.johtoRaidLeader.findUnique({ where: { id: next.id } }) : null;
}

/** Líder que não caiu no prazo foge; o próximo entra. Idempotente (chamado ao ler o estado e ao atacar). */
export async function advanceExpiredLeaders(eventId: string, now = new Date()) {
  const expired = await prisma.johtoRaidLeader.findMany({ where: { eventId, defeatedAt: null, escapedAt: null, expiresAt: { lt: now } }, select: { id: true } });
  for (const leader of expired) {
    const flagged = await prisma.johtoRaidLeader.updateMany({ where: { id: leader.id, escapedAt: null, defeatedAt: null }, data: { escapedAt: now } });
    if (flagged.count > 0) {
      await openNextLeaderWindow(eventId, now);
      if (await isJohtoRaidVisibleToPlayers().catch(() => false)) {
        const row = await prisma.johtoRaidLeader.findUnique({ where: { id: leader.id }, select: { key: true } });
        const name = getJohtoLeader(row?.key ?? "")?.name ?? "O líder";
        await publishLeagueTicker({ type: "JOHTO_RAID_TIMEOUT", href: HREF, priority: 16, ttlHours: 24, eventKey: `johto-timeout:${leader.id}`, message: `👨‍🏫 Professor Enguiça: o tempo acabou e ${name} venceu o desafio! O próximo líder já está esperando.` }).catch(() => undefined);
      }
    }
  }
  if (expired.length > 0) {
    const open = await prisma.johtoRaidLeader.count({ where: { eventId, defeatedAt: null, escapedAt: null } });
    if (open === 0) await prisma.johtoRaidEvent.update({ where: { id: eventId }, data: { active: false } });
  }
}

// ── Combo ────────────────────────────────────────────────────────────────────

/** Treinadores (não admin, exceto o próprio) que atacaram nos últimos 30 minutos: cada um vale +2% de status, até +8%. */
export async function getComboState(eventId: string, excludePlayerId?: string | null, now = new Date()): Promise<JohtoComboState> {
  const rows = await prisma.johtoRaidAttempt.findMany({
    where: { eventId, createdAt: { gte: new Date(now.getTime() - COMBO_WINDOW_MS) }, player: NON_ADMIN, ...(excludePlayerId ? { playerId: { not: excludePlayerId } } : {}) },
    select: { playerId: true, createdAt: true }, orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, Date>();
  for (const row of rows) if (!latest.has(row.playerId)) latest.set(row.playerId, row.createdAt);
  const times = [...latest.values()].sort((a, b) => b.getTime() - a.getTime()).slice(0, COMBO_MAX_STACKS);
  const stacks = times.length;
  // O bônus cai quando o ataque mais antigo dentre os que contam sair da janela.
  const oldest = times[times.length - 1];
  return { stacks, bonusPct: comboBonusPct(stacks), nextDropAt: oldest ? new Date(oldest.getTime() + COMBO_WINDOW_MS).toISOString() : null };
}

// ── Estado para a página ─────────────────────────────────────────────────────

export async function getJohtoRaidState(playerId?: string | null): Promise<JohtoRaidState> {
  const empty: JohtoRaidState = { event: null, leaders: [], current: null, totalHpMax: 0, totalHpCurrent: 0, currentRanking: [], recent: [], participants: 0, totalAttacks: 0, me: null, myRewards: [], choiceUsed: null, combo: { stacks: 0, bonusPct: 0, nextDropAt: null } };
  const event = await getJohtoEvent();
  if (!event) return empty;
  await ensureLeaderMascots(event.id).catch(() => undefined);
  if (event.active) await advanceExpiredLeaders(event.id).catch(() => undefined);
  const [fresh, rows] = await Promise.all([
    prisma.johtoRaidEvent.findUniqueOrThrow({ where: { id: event.id } }),
    prisma.johtoRaidLeader.findMany({ where: { eventId: event.id }, orderBy: { position: "asc" }, include: { mascots: { orderBy: { slot: "asc" } } } }),
  ]);
  const playerIds = new Set<string>();
  for (const l of rows) { if (l.finalBlowPlayerId) playerIds.add(l.finalBlowPlayerId); for (const m of l.mascots) if (m.defeatedByPlayerId) playerIds.add(m.defeatedByPlayerId); }
  const names = new Map((playerIds.size ? await prisma.player.findMany({ where: { id: { in: [...playerIds] } }, select: { id: true, displayName: true } }) : []).map((p) => [p.id, p.displayName]));
  const open = rows.find((r) => !r.defeatedAt && !r.escapedAt && r.startedAt);
  const leaders = rows.flatMap((row): JohtoLeaderState[] => {
    const def = getJohtoLeader(row.key);
    if (!def) return [];
    const { roster, ...meta } = def;
    return [{
      ...meta, id: row.id, position: row.position, hpMax: row.hpMax, hpCurrent: row.hpCurrent,
      startedAt: row.startedAt?.toISOString() ?? null, expiresAt: row.expiresAt?.toISOString() ?? null, defeatedAt: row.defeatedAt?.toISOString() ?? null,
      finalBlowName: row.finalBlowPlayerId ? names.get(row.finalBlowPlayerId) ?? null : null,
      status: row.defeatedAt ? "DEFEATED" : row.escapedAt ? "ESCAPED" : open?.id === row.id ? "CURRENT" : "WAITING",
      rosterPokemonIds: roster.map((r) => r.pokemonId),
      mascots: row.mascots.map((m) => ({ slot: m.slot, pokemonId: m.pokemonId, name: getPokemonName(m.pokemonId), hpMax: m.hpMax, hpCurrent: m.hpCurrent, defeated: m.hpCurrent <= 0, defeatedByName: m.defeatedByPlayerId ? names.get(m.defeatedByPlayerId) ?? null : null, role: roster[m.slot]?.role ?? "ATTACKER", personality: roster[m.slot]?.personality ?? "", types: getPokemonTypes(m.pokemonId) })),
    }];
  });
  const current = leaders.find((l) => l.status === "CURRENT") ?? null;
  const [stats, recent, attackCount, participants, myLast, rewards, combo] = await Promise.all([
    current ? prisma.johtoRaidLeaderStat.findMany({ where: { leaderId: current.id, player: NON_ADMIN }, orderBy: [{ damage: "desc" }, { id: "asc" }], take: 15, select: { playerId: true, damage: true, attackCount: true, highestSingleDamage: true, player: { select: { displayName: true } } } }) : [],
    prisma.johtoRaidAttempt.findMany({
      where: { eventId: event.id, replayJson: { not: Prisma.DbNull }, player: NON_ADMIN }, orderBy: { createdAt: "desc" }, take: JOHTO_REPLAY_HISTORY,
      select: { id: true, damage: true, leaderKey: true, createdAt: true, summaryJson: true, player: { select: { displayName: true } } },
    }),
    prisma.johtoRaidAttempt.count({ where: { eventId: event.id, player: NON_ADMIN } }),
    prisma.johtoRaidLeaderStat.findMany({ where: { leader: { eventId: event.id }, player: NON_ADMIN }, distinct: ["playerId"], select: { playerId: true } }),
    playerId ? prisma.johtoRaidAttempt.findFirst({ where: { eventId: event.id, playerId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }) : null,
    playerId ? prisma.johtoRaidReward.findMany({ where: { eventId: event.id, playerId }, orderBy: { createdAt: "desc" } }) : [],
    getComboState(event.id, playerId),
  ]);
  const ranking = stats.map((s): JohtoLeaderRankingEntry => ({ playerId: s.playerId, playerName: s.player.displayName, damage: s.damage, attackCount: s.attackCount, highestSingleDamage: s.highestSingleDamage }));
  const mineIndex = playerId ? ranking.findIndex((r) => r.playerId === playerId) : -1;
  let mine = mineIndex >= 0 ? ranking[mineIndex] : null;
  if (!mine && playerId && current) {
    const own = await prisma.johtoRaidLeaderStat.findUnique({ where: { leaderId_playerId: { leaderId: current.id, playerId } }, select: { damage: true, attackCount: true, highestSingleDamage: true } });
    if (own) mine = { playerId, playerName: "", ...own };
  }
  return {
    event: {
      id: fresh.id, name: fresh.name, active: fresh.active, defeatedAt: fresh.defeatedAt?.toISOString() ?? null, cooldownMinutes: fresh.cooldownMinutes,
      damageScale: fresh.damageScale, leaderDays: fresh.leaderDays, rewards: readRewardConfig(fresh.rewardConfigJson),
    },
    leaders, current,
    totalHpMax: leaders.reduce((sum, l) => sum + l.hpMax, 0),
    totalHpCurrent: leaders.reduce((sum, l) => sum + l.hpCurrent, 0),
    currentRanking: ranking,
    recent: recent.map((a) => ({
      id: a.id, playerName: a.player.displayName, leaderName: getJohtoLeader(a.leaderKey)?.name ?? a.leaderKey, damage: a.damage,
      win: Boolean((a.summaryJson as { win?: boolean } | null)?.win), createdAt: a.createdAt.toISOString(), hasReplay: true,
    })),
    participants: participants.length,
    totalAttacks: attackCount,
    me: playerId ? {
      damageOnCurrent: mine?.damage ?? 0, attacksOnCurrent: mine?.attackCount ?? 0, rankOnCurrent: mineIndex >= 0 ? mineIndex + 1 : null,
      cooldownUntil: myLast ? new Date(myLast.createdAt.getTime() + fresh.cooldownMinutes * 60_000).toISOString() : null,
    } : null,
    combo,
    choiceUsed: (() => {
      const used = rewards.find((r) => r.claimedAt && r.chosenPokemonId);
      return used ? { leaderName: getJohtoLeader(used.leaderKey)?.name ?? used.leaderKey, pokemonId: used.chosenPokemonId! } : null;
    })(),
    myRewards: rewards.map((r) => ({
      id: r.id, leaderKey: r.leaderKey, leaderName: getJohtoLeader(r.leaderKey)?.name ?? r.leaderKey, tier: r.tier, zc: r.zc, level: r.mascotLevel, egg: r.egg,
      claimed: Boolean(r.claimedAt), chosenPokemonId: r.chosenPokemonId, options: getJohtoLeader(r.leaderKey)?.roster.map((e) => e.pokemonId) ?? [],
    })),
  };
}

// ── Ataque ───────────────────────────────────────────────────────────────────

const PLAYER_MASCOT_SELECT = {
  id: true, playerId: true, pokemonId: true, nickname: true, level: true, personality: true, diseasedAt: true,
  statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
  speciesNameOverride: true, primaryTypeOverride: true, secondaryTypeOverride: true,
} as const;

export type JohtoBattlePayload = {
  winner: "A" | "B" | "DRAW"; log: JohtoBattleOutcome["battle"]["log"]; lineupA: ReturnType<typeof toReplayLineup>; lineupB: ReturnType<typeof toReplayLineup>;
  survivorsA: number; survivorsB: number; playerId: string; playerName: string; leaderName: string;
};

export type JohtoAttackResult =
  | { ok: false; message: string; cooldownUntil?: string }
  | {
    ok: true; message: string; win: boolean; damage: number; rounds: number; leaderName: string; leaderKey: string; comboPct: number;
    perSlot: JohtoBattleOutcome["perSlot"]; fallenMascots: string[]; fallenIds: string[]; koSlots: number[]; cooldownUntil: string;
    leaderDefeated: boolean; eventDefeated: boolean; battle: JohtoBattlePayload;
  };

function buildPayload(outcome: JohtoBattleOutcome, playerId: string, playerName: string, leaderName: string): JohtoBattlePayload {
  const { battle } = outcome;
  return {
    winner: battle.winner, log: battle.log, lineupA: toReplayLineup(battle.lineupA), lineupB: toReplayLineup(battle.lineupB, outcome.startingHp),
    survivorsA: battle.teamASurvivors, survivorsB: battle.teamBSurvivors, playerId, playerName, leaderName,
  };
}

/**
 * Ataca o líder atual: 6 mascotes do jogador contra os mascotes vivos do líder (motor da Liga). O dano causado a cada
 * mascote do líder é convertido para a vida global dele com UPDATE sob lock da linha, então ataques simultâneos somam certo
 * e só um jogador recebe o golpe final. Contas de admin atacam como teste: ficam fora de ranking e prêmios.
 */
export async function runJohtoRaidAttack(userId: string, selectedMascotIds: string[], selectedRoles: Record<string, string>): Promise<JohtoAttackResult> {
  const now = new Date();
  const event = await getJohtoEvent();
  if (!event?.active) return { ok: false, message: "A Raid dos Líderes de Johto não está ativa." };
  if (event.defeatedAt) return { ok: false, message: "O servidor já venceu os Líderes de Johto!" };
  await ensureLeaderMascots(event.id);
  await advanceExpiredLeaders(event.id, now);

  const player = await prisma.player.findUnique({ where: { userId }, select: { id: true, displayName: true, user: { select: { role: true } } } });
  if (!player) return { ok: false, message: "Perfil de jogador não encontrado." };
  const admin = isAdminRole(player.user?.role);
  const cooldownMs = event.cooldownMinutes * 60_000;
  const last = await prisma.johtoRaidAttempt.findFirst({ where: { eventId: event.id, playerId: player.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && cooldownMs > 0 && now.getTime() - last.createdAt.getTime() < cooldownMs) {
    const until = new Date(last.createdAt.getTime() + cooldownMs);
    return { ok: false, message: `A equipe precisa se reagrupar. Tente novamente em ${Math.ceil((until.getTime() - now.getTime()) / 60000)} min.`, cooldownUntil: until.toISOString() };
  }

  const ids = [...new Set(selectedMascotIds)].slice(0, 6);
  if (ids.length !== 6) return { ok: false, message: "Monte uma equipe completa com 6 mascotes." };
  const mascots = await prisma.mascot.findMany({
    where: { id: { in: ids }, playerId: player.id, arenaState: "FREE", expeditions: { none: { status: "ACTIVE" } } }, select: PLAYER_MASCOT_SELECT,
  });
  if (mascots.length !== 6) return { ok: false, message: "A equipe precisa ter 6 mascotes livres." };
  const order = new Map(ids.map((id, index) => [id, index]));
  mascots.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const leaderRow = await prisma.johtoRaidLeader.findFirst({ where: { eventId: event.id, defeatedAt: null, escapedAt: null, startedAt: { not: null } }, orderBy: { position: "asc" }, include: { mascots: { orderBy: { slot: "asc" } } } });
  if (!leaderRow) return { ok: false, message: "Nenhum líder disponível no momento." };
  const def = getJohtoLeader(leaderRow.key);
  if (!def) return { ok: false, message: "Líder desconhecido." };
  const alive = leaderRow.mascots.filter((m) => m.hpCurrent > 0).map((m) => ({ slot: m.slot, hpMax: m.hpMax, hpCurrent: m.hpCurrent }));
  if (alive.length === 0) return { ok: false, message: `${def.name} já foi derrotado.` };

  const playerTeam = mascots.map((m, index) => toLeagueMascot({ ...m, playerId: player.id }, index, selectedRoles[m.id]));
  const combo = await getComboState(event.id, player.id, now);
  const outcome = runJohtoBattle(playerTeam, def, leaderRow.position, alive, event.damageScale, combo.bonusPct);
  const payload = buildPayload(outcome, player.id, player.displayName, def.name);
  const fallenNames = outcome.playerFallenIds.map((id) => playerTeam.find((m) => m.id === id)?.name ?? "");

  type TxResult = { total: number; koSlots: Array<{ slot: number; pokemonId: number }>; leaderDefeated: boolean; eventDefeated: boolean };
  let applied: TxResult;
  try {
    applied = await prisma.$transaction(async (tx): Promise<TxResult> => {
      // Trava por jogador e repete o cooldown: dois cliques simultâneos não geram dois ataques.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`johto-raid:${player.id}`}))`);
      const again = await tx.johtoRaidAttempt.findFirst({ where: { eventId: event.id, playerId: player.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      if (again && cooldownMs > 0 && Date.now() - again.createdAt.getTime() < cooldownMs) throw new Error("COOLDOWN");
      const leaderNow = await tx.johtoRaidLeader.findUniqueOrThrow({ where: { id: leaderRow.id }, select: { defeatedAt: true, escapedAt: true } });
      if (leaderNow.defeatedAt || leaderNow.escapedAt) throw new Error("LEADER_GONE");
      const locked = await tx.$queryRaw<Array<{ id: string; slot: number; hpCurrent: number; pokemonId: number }>>(Prisma.sql`
        SELECT id, slot, "hpCurrent", "pokemonId" FROM johto_raid_leader_mascots WHERE "leaderId" = ${leaderRow.id} ORDER BY slot FOR UPDATE`);
      let total = 0;
      const koSlots: TxResult["koSlots"] = [];
      let remaining = 0;
      for (const row of locked) {
        const wanted = outcome.perSlot.find((p) => p.slot === row.slot)?.globalDamage ?? 0;
        const dealt = Math.max(0, Math.min(wanted, row.hpCurrent));
        const after = row.hpCurrent - dealt;
        remaining += after;
        if (dealt <= 0) continue;
        total += dealt;
        await tx.johtoRaidLeaderMascot.update({
          where: { id: row.id },
          data: { hpCurrent: after, ...(after === 0 ? { defeatedAt: now, defeatedByPlayerId: admin ? null : player.id } : {}) },
        });
        if (after === 0) koSlots.push({ slot: row.slot, pokemonId: row.pokemonId });
      }
      const leaderDefeated = remaining === 0;
      await tx.johtoRaidLeader.update({
        where: { id: leaderRow.id },
        data: { hpCurrent: remaining, ...(leaderDefeated ? { defeatedAt: now, finalBlowPlayerId: admin ? null : player.id } : {}) },
      });
      let eventDefeated = false;
      if (leaderDefeated) {
        const open = await tx.johtoRaidLeader.count({ where: { eventId: event.id, defeatedAt: null, escapedAt: null, id: { not: leaderRow.id } } });
        if (open === 0) {
          eventDefeated = true;
          await tx.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: now, active: false } });
        }
      }
      await tx.johtoRaidAttempt.create({
        data: {
          eventId: event.id, leaderKey: leaderRow.key, playerId: player.id, damage: total, koCount: outcome.playerFallenIds.length, finalBlow: leaderDefeated,
          teamSnapshotJson: playerTeam.map((m) => ({ id: m.id, pokemonId: m.pokemonId, name: m.name, level: m.level, role: m.combatRole })) as unknown as Prisma.InputJsonValue,
          replayJson: admin ? Prisma.DbNull : (JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue),
          summaryJson: { win: outcome.win, rounds: outcome.rounds, perSlot: outcome.perSlot, fallen: fallenNames, scale: event.damageScale, comboPct: combo.bonusPct } as unknown as Prisma.InputJsonValue,
        },
      });
      if (!admin) {
        // Guarda só os 20 replays mais recentes do evento (o restante perde o JSON pesado e mantém o resumo).
        await tx.$executeRaw(Prisma.sql`UPDATE johto_raid_attempts SET "replayJson" = NULL WHERE "eventId" = ${event.id} AND "replayJson" IS NOT NULL
          AND id NOT IN (SELECT id FROM johto_raid_attempts WHERE "eventId" = ${event.id} AND "replayJson" IS NOT NULL ORDER BY "createdAt" DESC LIMIT ${JOHTO_REPLAY_HISTORY})`);
        const stat = await tx.johtoRaidLeaderStat.findUnique({ where: { leaderId_playerId: { leaderId: leaderRow.id, playerId: player.id } }, select: { highestSingleDamage: true } });
        await tx.johtoRaidLeaderStat.upsert({
          where: { leaderId_playerId: { leaderId: leaderRow.id, playerId: player.id } },
          create: { leaderId: leaderRow.id, playerId: player.id, damage: total, attackCount: 1, highestSingleDamage: total },
          update: { damage: { increment: total }, attackCount: { increment: 1 }, highestSingleDamage: Math.max(stat?.highestSingleDamage ?? 0, total) },
        });
      }
      // Como na Arena: quem caiu na luta fica ferido (Atendimento SUS); vitória/derrota segue o resultado do time.
      if (outcome.playerFallenIds.length > 0) {
        await tx.mascot.updateMany({ where: { id: { in: outcome.playerFallenIds }, playerId: player.id }, data: { arenaState: "INJURED", injuredAt: now, restingUntil: null, isEquipped: false } });
        for (const mascot of playerTeam.filter((m) => outcome.playerFallenIds.includes(m.id))) {
          await tx.mascotEvent.create({ data: { mascotId: mascot.id, emoji: "RAID", description: `${mascot.name} caiu contra o líder ${def.name} na Raid de Johto e precisa de Atendimento SUS.` } });
        }
      }
      await tx.mascot.updateMany({ where: { id: { in: playerTeam.map((m) => m.id) }, playerId: player.id }, data: outcome.win ? { battleWins: { increment: 1 } } : { battleLosses: { increment: 1 } } });
      return { total, koSlots, leaderDefeated, eventDefeated };
    }, { timeout: 30000, maxWait: 10000 });
  } catch (error) {
    if (error instanceof Error && error.message === "COOLDOWN") return { ok: false, message: "Sua equipe ainda está se reagrupando." };
    if (error instanceof Error && error.message === "LEADER_GONE") return { ok: false, message: `${def.name} já não está mais disponível. Recarregue a página.` };
    throw error;
  }

  if (applied.leaderDefeated) {
    if (!applied.eventDefeated) await openNextLeaderWindow(event.id, now).catch(() => undefined);
    if (applied.eventDefeated) await thankParticipants(event.id).catch(() => undefined);
    await grantLeaderRewards(leaderRow.id).catch((error) => console.error("[JohtoRaid] Falha ao entregar prêmios do líder.", error));
  }
  if (!admin && (await isJohtoRaidVisibleToPlayers().catch(() => false))) await announceProgress(def, player.displayName, applied.koSlots, applied.leaderDefeated, applied.eventDefeated, leaderRow.id, event.id).catch(() => undefined);

  const leaderName = def.name;
  return {
    ok: true,
    message: applied.eventDefeated ? "OS LÍDERES DE JOHTO CAÍRAM! O servidor venceu!" : applied.leaderDefeated ? `${leaderName} foi derrotado!` : outcome.win ? `Vitória contra o time de ${leaderName}!` : `Ataque registrado contra ${leaderName}.`,
    win: outcome.win, damage: applied.total, rounds: outcome.rounds, leaderName, leaderKey: def.key, comboPct: combo.bonusPct, perSlot: outcome.perSlot, fallenMascots: fallenNames, fallenIds: outcome.playerFallenIds,
    koSlots: applied.koSlots.map((k) => k.slot), cooldownUntil: new Date(now.getTime() + cooldownMs).toISOString(),
    leaderDefeated: applied.leaderDefeated, eventDefeated: applied.eventDefeated, battle: payload,
  };
}

/** Avisos do Professor Enguiça (faixa do topo) a cada mascote do líder derrubado e a cada líder vencido. */
async function announceProgress(def: JohtoLeaderDef, killer: string, koSlots: Array<{ slot: number; pokemonId: number }>, leaderDefeated: boolean, eventDefeated: boolean, leaderId: string, eventId: string) {
  const alive = await prisma.johtoRaidLeaderMascot.count({ where: { leaderId, hpCurrent: { gt: 0 } } });
  for (const ko of koSlots) {
    await publishLeagueTicker({
      type: "JOHTO_RAID_KO", href: HREF, priority: 15, ttlHours: 24, eventKey: `johto-ko:${leaderId}:${ko.slot}`,
      message: `👨‍🏫 Professor Enguiça: ${killer} derrotou ${getPokemonName(ko.pokemonId)} do líder ${def.name}! ${alive > 0 ? `Faltam ${alive} mascote${alive > 1 ? "s" : ""} — continuem o ataque!` : "Foi o último!"}`,
    });
  }
  if (leaderDefeated) {
    const top = await prisma.johtoRaidLeaderStat.findMany({ where: { leaderId, player: NON_ADMIN }, orderBy: [{ damage: "desc" }, { attackCount: "desc" }], take: 3, select: { damage: true, player: { select: { displayName: true } } } });
    const podium = top.map((t, i) => `${["🥇", "🥈", "🥉"][i]} ${t.player.displayName} (${t.damage.toLocaleString("pt-BR")})`).join(" · ");
    const next = eventDefeated ? null : await prisma.johtoRaidLeader.findFirst({ where: { eventId, defeatedAt: null, escapedAt: null, startedAt: { not: null } }, orderBy: { position: "asc" }, select: { key: true } });
    const nextName = next ? getJohtoLeader(next.key)?.name : null;
    await publishLeagueTicker({
      type: "JOHTO_RAID_LEADER", href: HREF, priority: 18, ttlHours: 36, eventKey: `johto-leader:${leaderId}`,
      message: eventDefeated
        ? `👨‍🏫 Professor Enguiça: INCRÍVEL! ${killer} deu o golpe final e os oito Líderes de Johto caíram! Pódio do último líder: ${podium}. Prêmios entregues!`
        : `👨‍🏫 Professor Enguiça: ${def.name} caiu! Golpe final de ${killer}. Pódio: ${podium}. Prêmios entregues — escolham o mascote na página!${nextName ? ` ${nextName} já é o próximo desafio!` : ""}`,
    });
  }
}

// ── Prêmios ──────────────────────────────────────────────────────────────────

/** Agradecimento do último líder: notificação a todo treinador que participou de algum líder (idempotente). */
async function thankParticipants(eventId: string) {
  const rows = await prisma.johtoRaidLeaderStat.findMany({ where: { leader: { eventId }, player: NON_ADMIN }, distinct: ["playerId"], select: { playerId: true } });
  if (rows.length === 0) return;
  await prisma.playerNotification.createMany({
    data: rows.map((row) => ({
      playerId: row.playerId, category: "EVENT", type: "JOHTO_RAID_THANKS", title: "Os Líderes de Johto caíram! Obrigado!",
      body: "Obrigado por lutar nesta raid: o servidor venceu os oito Líderes de Johto! As recompensas de cada líder que você atacou continuam disponíveis na página da raid, inclusive a escolha dos mascotes.",
      href: HREF, entityId: eventId, eventKey: `johto-raid-thanks:${eventId}:${row.playerId}`,
    })),
    skipDuplicates: true,
  });
}

/** Prévia dos prêmios de um líder com as estatísticas atuais (sem entregar nada). */
export async function previewLeaderRewards(leaderId: string) {
  const leader = await prisma.johtoRaidLeader.findUnique({ where: { id: leaderId }, include: { event: true } });
  if (!leader) return [];
  const stats = await prisma.johtoRaidLeaderStat.findMany({ where: { leaderId, player: NON_ADMIN }, select: { playerId: true, damage: true, attackCount: true, player: { select: { displayName: true } } } });
  const rows = computeLeaderRewards(stats, leader.finalBlowPlayerId, readRewardConfig(leader.event.rewardConfigJson));
  const names = new Map(stats.map((s) => [s.playerId, s.player.displayName]));
  return rows.map((r) => ({ ...r, playerName: names.get(r.playerId) ?? "Jogador", leaderName: getJohtoLeader(leader.key)?.name ?? leader.key }));
}

/** Entrega os prêmios de um líder derrotado, uma vez por jogador/faixa (índice único). ZC e ovo na hora; o mascote é escolhido depois. */
export async function grantLeaderRewards(leaderId: string) {
  const leader = await prisma.johtoRaidLeader.findUnique({ where: { id: leaderId }, include: { event: true } });
  if (!leader || !leader.defeatedAt) throw new Error("O líder ainda não foi derrotado.");
  const def = getJohtoLeader(leader.key);
  const config = readRewardConfig(leader.event.rewardConfigJson);
  const stats = await prisma.johtoRaidLeaderStat.findMany({ where: { leaderId, player: NON_ADMIN }, select: { playerId: true, damage: true, attackCount: true } });
  const rows = computeLeaderRewards(stats, leader.finalBlowPlayerId, config);
  let granted = 0;
  for (const row of rows) {
    try {
      const delivered = await prisma.$transaction(async (tx) => {
        // createMany + skipDuplicates: o índice único garante a entrega única sem erro no log (count 0 = já entregue).
        const created = await tx.johtoRaidReward.createMany({ data: [{ eventId: leader.eventId, leaderKey: leader.key, playerId: row.playerId, tier: row.tier, zc: row.zc, mascotLevel: row.mascotLevel, egg: row.egg }], skipDuplicates: true });
        if (created.count === 0) return false;
        const reward = await tx.johtoRaidReward.findFirstOrThrow({ where: { eventId: leader.eventId, leaderKey: leader.key, playerId: row.playerId, tier: row.tier } });
        if (row.zc > 0) await creditCoins(tx, { playerId: row.playerId, type: ZikaCoinTxType.ADMIN_ADJUSTMENT, amount: row.zc, description: `Raid de Johto: recompensa contra ${def?.name ?? leader.key}` });
        if (row.egg) await tx.mascotEgg.create({ data: { playerId: row.playerId, type: config.finalBlowEggType, origin: config.eggOrigin, hatchRarityBonusPct: config.finalBlowEggBonusPct } });
        const label = row.tier === "FINAL_BLOW" ? "golpe final" : row.tier === "PARTICIPANT" ? "participação" : `${row.tier.slice(3)}º lugar em dano`;
        await tx.playerNotification.createMany({
          data: [{
            playerId: row.playerId, category: "EVENT", type: "JOHTO_RAID_REWARD", title: `${def?.name ?? "O líder"} foi derrotado!`,
            body: `Recompensa (${label}): ${row.zc.toLocaleString("pt-BR")} ZC${row.egg ? " + ovo especial" : ""} e a escolha de um mascote de ${def?.name ?? "o líder"} no nível ${row.mascotLevel}. Escolha na página da raid.`,
            href: HREF, entityId: reward.id, eventKey: `johto-raid-reward:${reward.id}`,
          }],
          skipDuplicates: true,
        });
        return true;
      }, { timeout: 20000 });
      if (delivered) granted++;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error; // P2002 = já entregue
    }
  }
  await prisma.johtoRaidLeader.update({ where: { id: leaderId }, data: { rewardsGrantedAt: new Date() } });
  return { granted, total: rows.length };
}

/** Jogador escolhe o mascote do prêmio (uma vez). O mascote nasce no nível da faixa, com a origem da raid. */
export async function claimJohtoMascotReward(userId: string, rewardId: string, pokemonId: number): Promise<{ ok: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
  if (!player) return { ok: false, message: "Perfil não encontrado." };
  const reward = await prisma.johtoRaidReward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.playerId !== player.id) return { ok: false, message: "Prêmio não encontrado." };
  if (reward.claimedAt) return { ok: false, message: "Você já escolheu o mascote deste prêmio." };
  const earlier = await prisma.johtoRaidReward.findFirst({ where: { eventId: reward.eventId, playerId: player.id, claimedAt: { not: null } }, select: { leaderKey: true, chosenPokemonId: true } });
  if (earlier) return { ok: false, message: `Você já escolheu ${earlier.chosenPokemonId ? getPokemonName(earlier.chosenPokemonId) : "um mascote"} (${getJohtoLeader(earlier.leaderKey)?.name ?? earlier.leaderKey}). Só é possível escolher UM mascote em toda a raid.` };
  const def = getJohtoLeader(reward.leaderKey);
  if (!def || !def.roster.some((entry) => entry.pokemonId === pokemonId)) return { ok: false, message: "Esse mascote não faz parte do time do líder." };
  const { computeProceduralStats } = await import("@/lib/mascot");
  const { getSpeciesSnapshot } = await import("@/lib/species-registry");
  const { registerPokemonDiscovery } = await import("@/lib/pokemon-dex");
  const personalities = Object.values(MascotPersonality);
  const personality = personalities[Math.floor(Math.random() * personalities.length)];
  // Origem de ovo ESPECIAL: status sorteados na faixa do ovo especial e crescidos proporcionalmente até o nível da faixa; personalidade aleatória.
  const range = EGG_STAT_RANGES.SPECIAL ?? [13, 20];
  const stats = computeProceduralStats(pokemonId, reward.mascotLevel, personality, range);
  const isShiny = Math.random() < (EGG_SHINY_CHANCE.SPECIAL ?? 1 / 500);
  try {
    await prisma.$transaction(async (tx) => {
      // Trava por jogador: duas escolhas simultâneas (ou em líderes diferentes) não passam.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`johto-claim:${player.id}`}))`);
      const other = await tx.johtoRaidReward.findFirst({ where: { eventId: reward.eventId, playerId: player.id, claimedAt: { not: null } }, select: { id: true } });
      if (other) throw new Error("ONE_ONLY");
      const claim = await tx.johtoRaidReward.updateMany({ where: { id: reward.id, playerId: player.id, claimedAt: null }, data: { claimedAt: new Date(), chosenPokemonId: pokemonId } });
      if (claim.count === 0) throw new Error("ALREADY");
      const mascot = await tx.mascot.create({
        data: {
          playerId: player.id, pokemonId, ...(await getSpeciesSnapshot(pokemonId, tx)), hatchedPokemonId: pokemonId, personality, level: reward.mascotLevel,
          hatchedFromEggType: "SPECIAL", hatchedFromEggOrigin: "Raid dos Líderes de Johto", isShiny, happiness: 80, ...stats,
        },
      });
      await tx.mascotEvent.create({ data: { mascotId: mascot.id, emoji: "🎁", description: `Recompensa da Raid de Johto: ${getPokemonName(pokemonId)} do líder ${def.name} (Nv.${reward.mascotLevel}).` } });
      await registerPokemonDiscovery({ playerId: player.id, pokemonId, source: "JOHTO_RAID" }, tx);
    }, { timeout: 20000 });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY") return { ok: false, message: "Você já escolheu o mascote deste prêmio." };
    if (error instanceof Error && error.message === "ONE_ONLY") return { ok: false, message: "Você já escolheu um mascote nesta raid. Só é possível escolher UM em todo o evento." };
    throw error;
  }
  return { ok: true, message: `${getPokemonName(pokemonId)} (Nv.${reward.mascotLevel}) entrou para a sua coleção!` };
}

// ── Replays ──────────────────────────────────────────────────────────────────

/** Replay de um dos últimos combates do evento (qualquer jogador autenticado pode assistir). */
export async function getJohtoReplay(attemptId: string): Promise<JohtoBattlePayload | null> {
  const attempt = await prisma.johtoRaidAttempt.findUnique({ where: { id: attemptId }, select: { replayJson: true } });
  return attempt?.replayJson ? (attempt.replayJson as unknown as JohtoBattlePayload) : null;
}

// ── Teste e estatísticas (admin) ─────────────────────────────────────────────

export type JohtoTestSummary = {
  runs: number; leaderName: string; leaderKey: string; winRate: number; avgRounds: number; avgBattleDamage: number; avgGlobalDamage: number;
  avgLeaderFallen: number; avgPlayerFallen: number; attacksToDefeatLeader: number | null; damageScale: number; comboPct: number;
  perSlot: Array<{ slot: number; name: string; avgBattleDamage: number; avgGlobalDamage: number; fellRate: number; globalHpMax: number }>;
  battle: JohtoBattlePayload;
};

/** Simula N lutas do time do admin contra um líder, sem gravar nada: taxa de vitória, dano convertido e ataques estimados para derrubar o líder. */
export async function simulateJohtoTest(userId: string, mascotIds: string[], roles: Record<string, string>, leaderKey: string, runs: number, comboStacks = 0): Promise<{ ok: false; message: string } | { ok: true; summary: JohtoTestSummary }> {
  const def = getJohtoLeader(leaderKey);
  if (!def) return { ok: false, message: "Líder desconhecido." };
  const player = await prisma.player.findUnique({ where: { userId }, select: { id: true, displayName: true } });
  if (!player) return { ok: false, message: "Perfil não encontrado." };
  const ids = [...new Set(mascotIds)].slice(0, 6);
  if (ids.length !== 6) return { ok: false, message: "Monte uma equipe completa com 6 mascotes." };
  const mascots = await prisma.mascot.findMany({ where: { id: { in: ids }, playerId: player.id }, select: PLAYER_MASCOT_SELECT });
  if (mascots.length !== 6) return { ok: false, message: "Mascotes inválidos." };
  const event = await getJohtoEvent();
  const scale = event?.damageScale ?? JOHTO_DEFAULT_DAMAGE_SCALE;
  const position = Math.max(0, JOHTO_LEADERS.findIndex((l) => l.key === leaderKey));
  const order = new Map(ids.map((id, index) => [id, index]));
  mascots.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const team = mascots.map((m, index) => toLeagueMascot({ ...m, playerId: player.id }, index, roles[m.id]));
  const total = Math.max(1, Math.min(50, Math.floor(runs) || 1));
  const leaderHpMax = (event ? (await prisma.johtoRaidLeader.findFirst({ where: { eventId: event.id, key: leaderKey }, select: { hpMax: true } }))?.hpMax : null) ?? JOHTO_LEADER_HP;
  const mascotHp = Math.floor(leaderHpMax / JOHTO_MASCOTS_PER_LEADER);
  const fullTeam = def.roster.map((_, slot) => ({ slot, hpMax: mascotHp, hpCurrent: mascotHp }));
  const all = Array.from({ length: total }, () => runJohtoBattle(team, def, position, fullTeam, scale, comboBonusPct(comboStacks)));
  const avg = (pick: (o: JohtoBattleOutcome) => number) => all.reduce((sum, o) => sum + pick(o), 0) / total;
  const avgGlobal = avg((o) => o.totalGlobalDamage);
  const hpMax = leaderHpMax;
  return {
    ok: true,
    summary: {
      runs: total, leaderName: def.name, leaderKey, winRate: all.filter((o) => o.win).length / total, avgRounds: avg((o) => o.rounds),
      avgBattleDamage: avg((o) => o.perSlot.reduce((sum, p) => sum + p.battleDamage, 0)), avgGlobalDamage: avgGlobal,
      avgLeaderFallen: avg((o) => o.perSlot.filter((p) => p.fellInBattle).length), avgPlayerFallen: avg((o) => o.playerFallenIds.length),
      attacksToDefeatLeader: avgGlobal > 0 ? Math.ceil(hpMax / avgGlobal) : null, damageScale: scale, comboPct: comboBonusPct(comboStacks),
      perSlot: def.roster.map((entry, slot) => {
        const rows = all.map((o) => o.perSlot.find((p) => p.slot === slot)!);
        return {
          slot, name: getPokemonName(entry.pokemonId), avgBattleDamage: rows.reduce((s, r) => s + r.battleDamage, 0) / total,
          avgGlobalDamage: rows.reduce((s, r) => s + r.globalDamage, 0) / total, fellRate: rows.filter((r) => r.fellInBattle).length / total,
          globalHpMax: Math.floor(hpMax / JOHTO_MASCOTS_PER_LEADER),
        };
      }),
      battle: buildPayload(all[0], player.id, player.displayName, def.name),
    },
  };
}

export type JohtoAdminSummary = {
  exists: boolean; active: boolean; visible: boolean; cooldownMinutes: number; damageScale: number; leaderDays: number; defeated: boolean;
  currentLeader: string | null; currentLeaderKey: string | null; hpCurrent: number; hpMax: number; expiresAt: string | null; participants: number; attacks: number;
  leaders: Array<{ key: string; name: string; status: string; rewardsGranted: boolean }>;
};

/** Resumo para os controles de admin (painel e página do evento). */
export async function getJohtoAdminSummary(state?: JohtoRaidState): Promise<JohtoAdminSummary> {
  const [s, visible] = await Promise.all([state ? Promise.resolve(state) : getJohtoRaidState(null), isJohtoRaidVisibleToPlayers()]);
  const rewarded = s.event ? await prisma.johtoRaidLeader.findMany({ where: { eventId: s.event.id, rewardsGrantedAt: { not: null } }, select: { key: true } }) : [];
  const granted = new Set(rewarded.map((r) => r.key));
  return {
    exists: Boolean(s.event), active: Boolean(s.event?.active), visible, cooldownMinutes: s.event?.cooldownMinutes ?? JOHTO_DEFAULT_COOLDOWN_MIN,
    damageScale: s.event?.damageScale ?? JOHTO_DEFAULT_DAMAGE_SCALE, leaderDays: s.event?.leaderDays ?? JOHTO_DEFAULT_LEADER_DAYS, defeated: Boolean(s.event?.defeatedAt),
    currentLeader: s.current?.name ?? null, currentLeaderKey: s.current?.key ?? null, hpCurrent: s.current?.hpCurrent ?? 0, hpMax: s.current?.hpMax ?? 0,
    expiresAt: s.current?.expiresAt ?? null, participants: s.participants, attacks: s.totalAttacks,
    leaders: s.leaders.map((l) => ({ key: l.key, name: l.name, status: l.status, rewardsGranted: granted.has(l.key) })),
  };
}
