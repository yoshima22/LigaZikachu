// Raid dos Líderes de Johto: estado, ataque atômico, visibilidade e prêmios. Simulação pura em johto-raid-sim.ts.
import { revalidateTag, unstable_cache } from "next/cache";
import type { CombatRole } from "@/lib/combat-roles";
import { Prisma, ZikaCoinTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { mascotRaidPower } from "@/lib/raid-event";
import {
  computeJohtoAwards, DEFAULT_JOHTO_REWARDS, getJohtoLeader, JOHTO_DEFAULT_COOLDOWN_MIN, JOHTO_EVENT_SLUG, JOHTO_LEADER_HP,
  JOHTO_LEADERS, JOHTO_VISIBLE_KEY, readRewardConfig, simulateJohtoBattle, type JohtoLeaderDef, type RankingRow,
} from "@/lib/johto-raid-sim";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
const isAdminRole = (role: string | null | undefined) => role === "ADMIN" || role === "SUPER_ADMIN";

// Cache curto: o layout consulta isto em toda página; o toggle do admin invalida a tag na hora.
export const isJohtoRaidVisibleToPlayers = unstable_cache(async (): Promise<boolean> => {
  const setting = await prisma.appSetting.findUnique({ where: { key: JOHTO_VISIBLE_KEY }, select: { value: true } }).catch(() => null);
  return setting?.value === true;
}, ["johto-raid-visible"], { revalidate: 60, tags: ["johto-raid-visible"] });

export async function setJohtoRaidVisible(visible: boolean) {
  await prisma.appSetting.upsert({ where: { key: JOHTO_VISIBLE_KEY }, create: { key: JOHTO_VISIBLE_KEY, value: visible }, update: { value: visible } });
  revalidateTag("johto-raid-visible");
}

export type JohtoLeaderState = JohtoLeaderDef & {
  id: string; position: number; hpMax: number; hpCurrent: number; defeatedAt: string | null; finalBlowName: string | null; status: "DEFEATED" | "CURRENT" | "WAITING";
};

export type JohtoRankingEntry = RankingRow & { playerName: string; badges: string[] };

export type JohtoRaidState = {
  event: { id: string; name: string; active: boolean; startsAt: string | null; endsAt: string | null; defeatedAt: string | null; rewardsGrantedAt: string | null; cooldownMinutes: number } | null;
  leaders: JohtoLeaderState[];
  current: JohtoLeaderState | null;
  totalHpMax: number;
  totalHpCurrent: number;
  ranking: JohtoRankingEntry[];
  recent: Array<{ id: string; playerName: string; damage: number; leaderName: string; createdAt: string }>;
  participants: number;
  totalAttacks: number;
  me: { totalDamage: number; attackCount: number; rank: number | null; cooldownUntil: string | null; badges: string[] } | null;
};

export async function getJohtoEvent() {
  return prisma.johtoRaidEvent.findUnique({ where: { slug: JOHTO_EVENT_SLUG } });
}

/** Ranking sem contas de admin (testes) e com as conquistas já calculadas. */
async function loadRanking(eventId: string, config: ReturnType<typeof readRewardConfig>) {
  const rows = await prisma.johtoRaidRanking.findMany({
    where: { eventId, player: { user: { role: { notIn: [...ADMIN_ROLES] } } } },
    select: { playerId: true, totalDamage: true, attackCount: true, highestSingleDamage: true, finalBlows: true, leadersJson: true, lastAttackAt: true, player: { select: { displayName: true } } },
    orderBy: [{ totalDamage: "desc" }, { id: "asc" }],
  });
  const base: RankingRow[] = rows.map((r) => ({
    playerId: r.playerId, totalDamage: r.totalDamage, attackCount: r.attackCount, highestSingleDamage: r.highestSingleDamage,
    finalBlows: r.finalBlows, leaders: Array.isArray(r.leadersJson) ? r.leadersJson.length : 0, lastAttackAt: r.lastAttackAt,
  }));
  const { badges } = computeJohtoAwards(base, config);
  const names = new Map(rows.map((r) => [r.playerId, r.player.displayName]));
  return base.map((r): JohtoRankingEntry => ({ ...r, playerName: names.get(r.playerId) ?? "Jogador", badges: badges[r.playerId] ?? [] }));
}

export async function getJohtoRaidState(playerId?: string | null): Promise<JohtoRaidState> {
  const event = await getJohtoEvent();
  if (!event) return { event: null, leaders: [], current: null, totalHpMax: 0, totalHpCurrent: 0, ranking: [], recent: [], participants: 0, totalAttacks: 0, me: null };
  const config = readRewardConfig(event.rewardConfigJson);
  const [rows, ranking, recent, attackCount, myLast] = await Promise.all([
    prisma.johtoRaidLeader.findMany({ where: { eventId: event.id }, orderBy: { position: "asc" } }),
    loadRanking(event.id, config),
    prisma.johtoRaidAttempt.findMany({
      where: { eventId: event.id, player: { user: { role: { notIn: [...ADMIN_ROLES] } } } },
      orderBy: { createdAt: "desc" }, take: 8,
      select: { id: true, damage: true, leaderKey: true, createdAt: true, player: { select: { displayName: true } } },
    }),
    prisma.johtoRaidAttempt.count({ where: { eventId: event.id, player: { user: { role: { notIn: [...ADMIN_ROLES] } } } } }),
    playerId ? prisma.johtoRaidAttempt.findFirst({ where: { eventId: event.id, playerId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }) : null,
  ]);
  const blowIds = rows.map((r) => r.finalBlowPlayerId).filter((id): id is string => Boolean(id));
  const blowNames = new Map((blowIds.length ? await prisma.player.findMany({ where: { id: { in: blowIds } }, select: { id: true, displayName: true } }) : []).map((p) => [p.id, p.displayName]));
  const firstOpen = rows.find((r) => r.hpCurrent > 0)?.position ?? -1;
  const leaders = rows.flatMap((row): JohtoLeaderState[] => {
    const def = getJohtoLeader(row.key);
    if (!def) return [];
    return [{
      ...def, id: row.id, position: row.position, hpMax: row.hpMax, hpCurrent: row.hpCurrent,
      defeatedAt: row.defeatedAt?.toISOString() ?? null, finalBlowName: row.finalBlowPlayerId ? blowNames.get(row.finalBlowPlayerId) ?? null : null,
      status: row.hpCurrent <= 0 ? "DEFEATED" : row.position === firstOpen ? "CURRENT" : "WAITING",
    }];
  });
  const mineIndex = playerId ? ranking.findIndex((r) => r.playerId === playerId) : -1;
  const mine = mineIndex >= 0 ? ranking[mineIndex] : null;
  return {
    event: {
      id: event.id, name: event.name, active: event.active, startsAt: event.startsAt?.toISOString() ?? null, endsAt: event.endsAt?.toISOString() ?? null,
      defeatedAt: event.defeatedAt?.toISOString() ?? null, rewardsGrantedAt: event.rewardsGrantedAt?.toISOString() ?? null, cooldownMinutes: event.cooldownMinutes,
    },
    leaders,
    current: leaders.find((l) => l.status === "CURRENT") ?? null,
    totalHpMax: leaders.reduce((sum, l) => sum + l.hpMax, 0),
    totalHpCurrent: leaders.reduce((sum, l) => sum + l.hpCurrent, 0),
    ranking,
    recent: recent.map((a) => ({ id: a.id, playerName: a.player.displayName, damage: a.damage, leaderName: getJohtoLeader(a.leaderKey)?.name ?? a.leaderKey, createdAt: a.createdAt.toISOString() })),
    participants: ranking.length,
    totalAttacks: attackCount,
    me: playerId ? {
      totalDamage: mine?.totalDamage ?? 0, attackCount: mine?.attackCount ?? 0, rank: mineIndex >= 0 ? mineIndex + 1 : null, badges: mine?.badges ?? [],
      cooldownUntil: myLast ? new Date(myLast.createdAt.getTime() + event.cooldownMinutes * 60_000).toISOString() : null,
    } : null,
  };
}

/** Cria (ou recria, apagando o anterior) o evento com os 8 líderes. Não ativa nem libera aos jogadores. */
export async function createJohtoEvent(options: { reset?: boolean; hpPerLeader?: number } = {}) {
  const existing = await getJohtoEvent();
  if (existing && !options.reset) return existing;
  if (existing) await prisma.johtoRaidEvent.delete({ where: { id: existing.id } });
  const hp = Math.max(1000, Math.min(2_000_000_000, Math.floor(options.hpPerLeader ?? JOHTO_LEADER_HP)));
  return prisma.johtoRaidEvent.create({
    data: {
      slug: JOHTO_EVENT_SLUG, name: "Raid dos Líderes de Johto", active: false, cooldownMinutes: JOHTO_DEFAULT_COOLDOWN_MIN,
      rewardConfigJson: DEFAULT_JOHTO_REWARDS as unknown as Prisma.InputJsonValue,
      leaders: { create: JOHTO_LEADERS.map((leader, position) => ({ position, key: leader.key, hpMax: hp, hpCurrent: hp })) },
    },
  });
}

export type JohtoAttackResult =
  | { ok: false; message: string; cooldownUntil?: string }
  | {
    ok: true; message: string; damage: number; bossHpAfter: number; defeatedMascots: string[];
    team: Array<{ id: string; pokemonId: number; name: string; level: number; maxHp: number; remainingHp: number; damage: number; defeated: boolean; combatRole: CombatRole }>;
    boss: { name: string; pokemonId: number; hpBefore: number; hpAfter: number; maxHp: number; megaPhase: boolean; seriousModeActivated: boolean };
    replay: Array<Record<string, unknown>>; cooldownUntil: string; megaJustActivated: boolean; seriousModeJustActivated: boolean;
    result: "WIN" | "LOSS" | "DRAW"; leaderDefeated: boolean; eventDefeated: boolean;
  };

/**
 * Ataca o líder atual. O dano é aplicado com UPDATE atômico (nunca read-modify-write), então ataques
 * simultâneos somam certo e só um jogador recebe o golpe final. Contas de admin atacam normalmente,
 * mas ficam fora do ranking e dos prêmios.
 */
export async function runJohtoRaidAttack(userId: string, selectedMascotIds: string[], selectedRoles: Record<string, string>): Promise<JohtoAttackResult> {
  const now = new Date();
  const event = await getJohtoEvent();
  if (!event?.active) return { ok: false, message: "A Raid dos Líderes de Johto não está ativa." };
  if (event.endsAt && now > event.endsAt) return { ok: false, message: "A Raid dos Líderes de Johto já terminou." };
  if (event.defeatedAt) return { ok: false, message: "O servidor já venceu os Líderes de Johto!" };

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
    where: { id: { in: ids }, playerId: player.id, arenaState: "FREE", expeditions: { none: { status: "ACTIVE" } } },
    select: { id: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true },
  });
  if (mascots.length !== 6) return { ok: false, message: "A equipe precisa ter 6 mascotes livres." };
  const order = new Map(ids.map((id, index) => [id, index]));
  mascots.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const leaderRow = await prisma.johtoRaidLeader.findFirst({ where: { eventId: event.id, hpCurrent: { gt: 0 } }, orderBy: { position: "asc" } });
  if (!leaderRow) return { ok: false, message: "Todos os líderes já foram derrotados." };
  const def = getJohtoLeader(leaderRow.key);
  if (!def) return { ok: false, message: "Líder desconhecido." };

  const sim = simulateJohtoBattle(mascots, selectedRoles, {
    name: def.name, pokemonId: def.pokemonId, type: def.type, position: leaderRow.position, hpRemaining: leaderRow.hpCurrent, hpMax: leaderRow.hpMax,
  }, mascotRaidPower);

  let applied = { before: 0, after: 0, dealt: 0 };
  let eventDefeated = false;
  try {
    await prisma.$transaction(async (tx) => {
      // Trava por jogador e repete o cooldown: dois cliques simultâneos não geram dois ataques.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`johto-raid:${player.id}`}))`);
      const again = await tx.johtoRaidAttempt.findFirst({ where: { eventId: event.id, playerId: player.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      if (again && cooldownMs > 0 && Date.now() - again.createdAt.getTime() < cooldownMs) throw new Error("COOLDOWN");
      const [row] = await tx.$queryRaw<Array<{ before: number; after: number }>>(Prisma.sql`
        UPDATE johto_raid_leaders l SET "hpCurrent" = GREATEST(0, l."hpCurrent" - ${sim.rawDamage})
        FROM (SELECT id, "hpCurrent" AS before FROM johto_raid_leaders WHERE id = ${leaderRow.id} FOR UPDATE) p
        WHERE l.id = p.id RETURNING p.before AS before, l."hpCurrent" AS after`);
      if (!row || row.before <= 0) throw new Error("LEADER_ALREADY_DOWN");
      const dealt = row.before - row.after;
      const finalBlow = row.after <= 0;
      applied = { before: row.before, after: row.after, dealt };
      if (finalBlow) {
        await tx.johtoRaidLeader.update({ where: { id: leaderRow.id }, data: { defeatedAt: now, finalBlowPlayerId: admin ? null : player.id } });
        const open = await tx.johtoRaidLeader.count({ where: { eventId: event.id, hpCurrent: { gt: 0 } } });
        if (open === 0) {
          eventDefeated = true;
          await tx.johtoRaidEvent.update({ where: { id: event.id }, data: { defeatedAt: now, active: false } });
        }
      }
      await tx.johtoRaidAttempt.create({
        data: {
          eventId: event.id, leaderKey: leaderRow.key, playerId: player.id, damage: dealt, koCount: sim.defeatedIds.length, finalBlow,
          teamSnapshotJson: sim.team as unknown as Prisma.InputJsonValue, replayJson: JSON.parse(JSON.stringify({ log: sim.log })),
        },
      });
      if (!admin) {
        const existing = await tx.johtoRaidRanking.findUnique({ where: { eventId_playerId: { eventId: event.id, playerId: player.id } }, select: { leadersJson: true, highestSingleDamage: true } });
        const seen = new Set(Array.isArray(existing?.leadersJson) ? (existing!.leadersJson as unknown[]).filter((k): k is string => typeof k === "string") : []);
        seen.add(leaderRow.key);
        await tx.johtoRaidRanking.upsert({
          where: { eventId_playerId: { eventId: event.id, playerId: player.id } },
          create: { eventId: event.id, playerId: player.id, totalDamage: dealt, attackCount: 1, highestSingleDamage: dealt, finalBlows: finalBlow ? 1 : 0, leadersJson: [...seen], lastAttackAt: now },
          update: {
            totalDamage: { increment: dealt }, attackCount: { increment: 1 }, finalBlows: { increment: finalBlow ? 1 : 0 }, leadersJson: [...seen], lastAttackAt: now,
            highestSingleDamage: Math.max(existing?.highestSingleDamage ?? 0, dealt),
          },
        });
      }
      if (sim.defeatedIds.length > 0) {
        await tx.mascot.updateMany({ where: { id: { in: sim.defeatedIds }, playerId: player.id }, data: { arenaState: "INJURED", injuredAt: now, restingUntil: null, isEquipped: false, battleLosses: { increment: 1 } } });
        for (const m of sim.team.filter((x) => x.defeated)) {
          await tx.mascotEvent.create({ data: { mascotId: m.id, emoji: "RAID", description: `${m.name} foi derrotado por ${def.name} na Raid dos Líderes de Johto e precisa de Atendimento SUS.` } });
        }
      }
    }, { timeout: 20000 }); // o FOR UPDATE do líder serializa os ataques simultâneos
  } catch (error) {
    if (error instanceof Error && error.message === "COOLDOWN") return { ok: false, message: "Sua equipe ainda está se reagrupando." };
    if (error instanceof Error && error.message === "LEADER_ALREADY_DOWN") return { ok: false, message: `${def.name} acabou de ser derrotado por outro treinador! Recarregue a página para enfrentar o próximo líder.` };
    throw error;
  }

  const leaderDefeated = applied.after <= 0;
  if (eventDefeated) await grantJohtoRaidRewards(event.id).catch((error) => console.error("[JohtoRaid] Falha ao entregar prêmios.", error));

  const result = leaderDefeated ? "WIN" : sim.defeatedIds.length === sim.team.length ? "LOSS" : "DRAW";
  return {
    ok: true,
    message: eventDefeated ? "OS LÍDERES DE JOHTO CAÍRAM! O servidor venceu!" : leaderDefeated ? `${def.name} foi derrotado!` : `Ataque registrado contra ${def.name}.`,
    damage: applied.dealt, bossHpAfter: applied.after, defeatedMascots: sim.team.filter((m) => m.defeated).map((m) => m.name),
    team: sim.team, boss: { name: def.name, pokemonId: def.pokemonId, hpBefore: applied.before, hpAfter: applied.after, maxHp: leaderRow.hpMax, megaPhase: false, seriousModeActivated: false },
    replay: sim.log, cooldownUntil: new Date(now.getTime() + cooldownMs).toISOString(), megaJustActivated: false, seriousModeJustActivated: false,
    result, leaderDefeated, eventDefeated,
  };
}

/** Prévia dos prêmios com o ranking atual (sem entregar nada). */
export async function previewJohtoRewards(eventId: string) {
  const event = await prisma.johtoRaidEvent.findUnique({ where: { id: eventId } });
  if (!event) return [];
  const config = readRewardConfig(event.rewardConfigJson);
  const ranking = await loadRanking(eventId, config);
  const { awards } = computeJohtoAwards(ranking, config);
  const names = new Map(ranking.map((r) => [r.playerId, r.playerName]));
  return awards.map((a) => ({ ...a, playerName: names.get(a.playerId) ?? "Jogador" })).sort((a, b) => b.zc - a.zc);
}

/** Entrega os prêmios uma única vez por jogador (idempotente via rewardGranted). */
export async function grantJohtoRaidRewards(eventId: string) {
  const event = await prisma.johtoRaidEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Evento não encontrado.");
  const config = readRewardConfig(event.rewardConfigJson);
  const ranking = await loadRanking(eventId, config);
  const { awards } = computeJohtoAwards(ranking, config);
  const done = new Set((await prisma.johtoRaidRanking.findMany({ where: { eventId, rewardGranted: true }, select: { playerId: true } })).map((r) => r.playerId));
  let granted = 0;
  for (const award of awards) {
    if (done.has(award.playerId)) continue;
    await prisma.$transaction(async (tx) => {
      const claim = await tx.johtoRaidRanking.updateMany({ where: { eventId, playerId: award.playerId, rewardGranted: false }, data: { rewardGranted: true } });
      if (claim.count === 0) return;
      if (award.zc > 0) {
        await creditCoins(tx, { playerId: award.playerId, type: ZikaCoinTxType.ADMIN_ADJUSTMENT, amount: award.zc, description: "Raid dos Líderes de Johto: prêmios do servidor" });
      }
      if (award.egg) await tx.mascotEgg.create({ data: { playerId: award.playerId, type: "RARE", origin: config.eggOrigin } });
      await tx.playerNotification.createMany({
        data: [{
          playerId: award.playerId, category: "EVENT", type: "JOHTO_RAID_REWARD", title: "Os Líderes de Johto caíram!",
          body: `O servidor venceu! Seus prêmios: ${award.lines.join(" · ")}${award.egg ? " · 🥚 Ovo raro" : ""}`, href: "/combates/raid-johto",
          entityId: eventId, eventKey: `johto-raid-reward:${eventId}:${award.playerId}`,
        }],
        skipDuplicates: true,
      });
    }, { timeout: 20000 });
    granted++;
  }
  await prisma.johtoRaidEvent.update({ where: { id: eventId }, data: { rewardsGrantedAt: new Date() } });
  return { granted, total: awards.length };
}

export type JohtoAdminSummary = {
  exists: boolean; active: boolean; visible: boolean; cooldownMinutes: number; defeated: boolean; rewardsGranted: boolean;
  currentLeader: string | null; hpCurrent: number; hpMax: number; participants: number; attacks: number; endsAt: string | null;
};

/** Resumo para os controles de admin (painel e página do evento). */
export async function getJohtoAdminSummary(state?: JohtoRaidState): Promise<JohtoAdminSummary> {
  const [s, visible] = await Promise.all([state ? Promise.resolve(state) : getJohtoRaidState(null), isJohtoRaidVisibleToPlayers()]);
  return {
    exists: Boolean(s.event), active: Boolean(s.event?.active), visible, cooldownMinutes: s.event?.cooldownMinutes ?? JOHTO_DEFAULT_COOLDOWN_MIN,
    defeated: Boolean(s.event?.defeatedAt), rewardsGranted: Boolean(s.event?.rewardsGrantedAt), currentLeader: s.current?.name ?? null,
    hpCurrent: s.current?.hpCurrent ?? 0, hpMax: s.current?.hpMax ?? 0, participants: s.participants, attacks: s.totalAttacks, endsAt: s.event?.endsAt ?? null,
  };
}
