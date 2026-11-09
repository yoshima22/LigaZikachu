// Leitura para a interface (servidor). Tudo serializável; nada de replays pesados na carga principal.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { mergeConfig, type ReiConfig } from "./config";
import { initialStandings, type MatchSummary } from "./engine";
import { buildDailyReport, type DailyReport, type ReportMatch } from "./report";
import { freezeAt, lockAt } from "./schedule";
import type { MascotAgg, MascotMatchStats } from "./scoring";
import { effectiveFormation, loadPlayerPool } from "./service";
import type { StandRow } from "./standings";
import type { DayState, Formation, MascotSnap } from "./team";

export type EditionSummary = { id: string; name: string; isTest: boolean; phase: string; mondayDate: string; participants: number; autoRun: boolean; createdAt: string };

export async function listEditions(): Promise<EditionSummary[]> {
  const rows = await prisma.reiRioEdition.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { participants: true } } } });
  return rows.map((e) => ({ id: e.id, name: e.name, isTest: e.isTest, phase: e.phase, mondayDate: e.mondayDate, participants: e._count.participants, autoRun: e.autoRun, createdAt: e.createdAt.toISOString() }));
}

export type MascotLite = { id: string; pokemonId: number; name: string; level: number };
const lite = (m: MascotSnap): MascotLite => ({ id: m.id, pokemonId: m.pokemonId, name: m.nickname || m.speciesNameOverride || getPokemonName(m.pokemonId), level: m.level });
export const snapName = (m: MascotSnap) => lite(m).name;

export type TeamView = { pid: string; name: string; isBot: boolean; formation: Formation; mascots: MascotLite[] };

export type EditionView = {
  edition: {
    id: string; name: string; isTest: boolean; phase: string; restDay: number | null; mondayDate: string; registrationOpen: boolean; autoRun: boolean;
    lockAt: string; freezeAt: string | null; doneRounds: number; nextRoundAt: string | null; championName: string | null; cfg: ReiConfig; lockDropped: string[];
  };
  rounds: { roundIndex: number; dayIndex: number; slotInDay: number; scheduledAt: string; status: string; error: string | null }[];
  standings: StandRow[];
  mascotRanking: { pid: string; owner: string; id: string; name: string; pokemonId: number; total: number; kos: number; assists: number; healing: number; mitigated: number; damageDealt: number; matches: number; wins: number; survivedBattles: number; points: MascotAgg["points"]; byRole: Record<string, number> }[];
  teams: TeamView[];
  me: null | {
    participantId: string; registered: boolean; original: Formation | null; formation: Formation | null; state: DayState | null; day: number | null;
    roster: MascotSnap[]; restPlan: Formation | null; yesterday: Formation | null; stats: { total: number; wins: number; losses: number; draws: number; byes: number };
  };
  /** Coleção do jogador (só antes do fechamento): base do montador manual. */
  pool: MascotSnap[] | null;
  recent: { id: string; roundIndex: number; aName: string; bName: string | null; winner: "A" | "B" | "DRAW" | null; scoreA: number; scoreB: number; rounds: number; a: string; b: string | null }[];
  adminParticipants: { id: string; name: string; isBot: boolean; locked: boolean; total: number }[];
};

export async function getEditionView(editionId: string, playerId: string): Promise<EditionView | null> {
  const ed = await prisma.reiRioEdition.findUnique({ where: { id: editionId }, include: { rounds: { orderBy: { roundIndex: "asc" }, select: { roundIndex: true, dayIndex: true, slotInDay: true, scheduledAt: true, status: true, error: true, standingsJson: true } }, participants: true } });
  if (!ed) return null;
  const cfg = mergeConfig(ed.configJson);
  const done = ed.rounds.filter((r) => r.status === "DONE");
  const last = done[done.length - 1];
  const parts = ed.participants;
  const standings = (last?.standingsJson as unknown as StandRow[] | null) ?? initialStandings(parts.filter((p) => p.lockedAt || ed.phase === "PREPARATION").map((p) => ({ pid: p.id, name: p.displayName, isBot: p.isBot })), cfg);
  const mine = parts.find((p) => p.playerKey === playerId) ?? null;
  const nextRound = ed.rounds.find((r) => r.status !== "DONE");
  const revealed = ed.phase !== "PREPARATION";

  const ranking: EditionView["mascotRanking"] = [];
  for (const p of parts) {
    for (const a of Object.values((p.scoresJson ?? {}) as Record<string, MascotAgg>)) {
      ranking.push({ pid: p.id, owner: p.displayName, id: a.id, name: a.name, pokemonId: a.pokemonId, total: a.total, kos: a.kos, assists: a.assists, healing: Math.round(a.healing), mitigated: Math.round(a.mitigated), damageDealt: a.damageDealt, matches: a.matches, wins: a.wins, survivedBattles: a.survivedBattles, points: a.points, byRole: a.byRole });
    }
  }
  ranking.sort((a, b) => b.total - a.total);

  const teams: TeamView[] = revealed
    ? parts.filter((p) => p.rosterJson).map((p) => ({ pid: p.id, name: p.displayName, isBot: p.isBot, formation: p.originalJson as unknown as Formation, mascots: ((p.rosterJson as MascotSnap[]) ?? []).map(lite) }))
    : [];

  let meView: EditionView["me"] = null;
  if (mine) {
    const day = ed.phase === "REST" ? ed.restDay : ed.rounds.find((r) => r.status !== "DONE")?.dayIndex ?? null;
    const ds = day && day > 0 && mine.rosterJson ? await prisma.reiRioDayState.findUnique({ where: { participantId_dayIndex: { participantId: mine.id, dayIndex: ed.phase === "REST" ? Math.max(1, day - 1) : day } } }) : null;
    const prevDay = ed.phase === "REST" && day ? await prisma.reiRioDayState.findUnique({ where: { participantId_dayIndex: { participantId: mine.id, dayIndex: Math.max(1, day - 1) } } }) : null;
    const plans = (mine.dayPlansJson ?? {}) as Record<string, { formation: Formation }>;
    meView = {
      participantId: mine.id, registered: true, original: mine.originalJson as unknown as Formation,
      formation: ds ? (ds.formationJson as unknown as Formation) : (mine.originalJson as unknown as Formation),
      state: ds ? (ds.stateJson as unknown as DayState) : null, day,
      roster: (mine.rosterJson as MascotSnap[] | null) ?? [],
      restPlan: ed.phase === "REST" && ed.restDay ? plans[String(ed.restDay)]?.formation ?? null : null,
      yesterday: prevDay ? (prevDay.formationJson as unknown as Formation) : null,
      stats: { total: mine.totalScore, wins: mine.wins, losses: mine.losses, draws: mine.draws, byes: mine.byes },
    };
  }

  const pool = ed.phase === "PREPARATION" ? await loadPlayerPool(playerId) : null;

  const matches = await prisma.reiRioMatch.findMany({ where: { editionId }, orderBy: [{ roundIndex: "desc" }, { createdAt: "desc" }], take: 16, select: { id: true, roundIndex: true, participantAId: true, participantBId: true, winnerId: true, isDraw: true, summaryJson: true } });
  const nm = new Map(parts.map((p) => [p.id, p.displayName]));
  const recent: EditionView["recent"] = matches.filter((m) => m.participantBId).map((m) => {
    const s = m.summaryJson as unknown as MatchSummary;
    return { id: m.id, roundIndex: m.roundIndex, aName: nm.get(m.participantAId) ?? "?", bName: nm.get(m.participantBId!) ?? "?", winner: s.winner ?? null, scoreA: s.A?.team?.pointsTotal ?? 0, scoreB: s.B?.team?.pointsTotal ?? 0, rounds: s.rounds ?? 0, a: m.participantAId, b: m.participantBId };
  });

  const cfgJson = (ed.configJson ?? {}) as { lockDropped?: string[] };
  return {
    edition: {
      id: ed.id, name: ed.name, isTest: ed.isTest, phase: ed.phase, restDay: ed.restDay, mondayDate: ed.mondayDate, registrationOpen: ed.registrationOpen, autoRun: ed.autoRun,
      lockAt: lockAt(ed.mondayDate).toISOString(), freezeAt: ed.restDay ? freezeAt(ed.mondayDate, ed.restDay).toISOString() : null,
      doneRounds: done.length, nextRoundAt: nextRound?.scheduledAt.toISOString() ?? null, championName: ed.championKey ? nm.get(ed.championKey) ?? null : null, cfg, lockDropped: cfgJson.lockDropped ?? [],
    },
    rounds: ed.rounds.map((r) => ({ roundIndex: r.roundIndex, dayIndex: r.dayIndex, slotInDay: r.slotInDay, scheduledAt: r.scheduledAt.toISOString(), status: r.status, error: r.error })),
    standings, mascotRanking: ranking.slice(0, 60), teams, me: meView, pool, recent,
    adminParticipants: parts.map((p) => ({ id: p.id, name: p.displayName, isBot: p.isBot, locked: !!p.lockedAt, total: p.totalScore })),
  };
}

export async function loadReport(editionId: string, participantId: string, day: number): Promise<DailyReport | null> {
  const [p, rounds, matchRows, all] = await Promise.all([
    prisma.reiRioParticipant.findUnique({ where: { id: participantId } }),
    prisma.reiRioRound.findMany({ where: { editionId }, select: { roundIndex: true, dayIndex: true, scheduledAt: true, standingsJson: true }, orderBy: { roundIndex: "asc" } }),
    prisma.reiRioMatch.findMany({ where: { editionId, OR: [{ participantAId: participantId }, { participantBId: participantId }] }, select: { id: true, roundIndex: true, dayIndex: true, participantAId: true, participantBId: true, winnerId: true, isDraw: true, summaryJson: true, statsJson: true } }),
    prisma.reiRioParticipant.findMany({ where: { editionId }, select: { id: true, displayName: true, scoresJson: true } }),
  ]);
  if (!p || p.editionId !== editionId) return null;
  const names = new Map(all.map((x) => [x.id, x.displayName]));
  const at = new Map(rounds.map((r) => [r.roundIndex, r.scheduledAt.toISOString()]));
  const board: { id: string; total: number }[] = [];
  const mascotNames: Record<string, { name: string; pokemonId: number }> = {};
  for (const x of all) for (const a of Object.values((x.scoresJson ?? {}) as Record<string, MascotAgg>)) { board.push({ id: a.id, total: a.total }); mascotNames[a.id] = { name: a.name, pokemonId: a.pokemonId }; }
  const matches: ReportMatch[] = matchRows.map((m) => ({
    id: m.id, roundIndex: m.roundIndex, dayIndex: m.dayIndex, scheduledAt: at.get(m.roundIndex) ?? "", a: m.participantAId, b: m.participantBId,
    aName: names.get(m.participantAId) ?? "?", bName: m.participantBId ? names.get(m.participantBId) ?? "?" : null,
    winnerId: m.winnerId, isDraw: m.isDraw, hasReplay: !!m.participantBId, summary: m.summaryJson as never, stats: m.statsJson as unknown as { A: MascotMatchStats[]; B: MascotMatchStats[] },
  }));
  return buildDailyReport(participantId, day, matches, rounds.map((r) => ({ roundIndex: r.roundIndex, dayIndex: r.dayIndex, standings: r.standingsJson as unknown as StandRow[] | null })), (p.scoresJson ?? {}) as Record<string, MascotAgg>, board, mascotNames);
}

export async function loadReplay(matchId: string) {
  const m = await prisma.reiRioMatch.findUnique({ where: { id: matchId }, select: { editionId: true, participantAId: true, participantBId: true, winnerId: true, isDraw: true, replayJson: true, summaryJson: true } });
  if (!m || !m.participantBId) return null;
  const parts = await prisma.reiRioParticipant.findMany({ where: { id: { in: [m.participantAId, m.participantBId] } }, select: { id: true, displayName: true } });
  const nm = new Map(parts.map((p) => [p.id, p.displayName]));
  const s = m.summaryJson as unknown as MatchSummary;
  const lineup = (side: "A" | "B") => (s[side]?.lineup ?? []).map((f) => ({ id: f.id, name: f.name, pokemonId: f.pokemonId, role: f.role, maxHp: f.maxHp, startHp: f.startHp < f.maxHp ? f.startHp : undefined, ownerId: side === "A" ? m.participantAId : m.participantBId! }));
  return {
    playerAId: m.participantAId, playerBId: m.participantBId, playerAName: nm.get(m.participantAId) ?? "A", playerBName: nm.get(m.participantBId) ?? "B",
    winnerId: m.winnerId, isDraw: m.isDraw, replay: (m.replayJson ?? []) as never[], lineupA: lineup("A"), lineupB: lineup("B"),
    survivorsA: s.A?.team?.survivors ?? 0, survivorsB: s.B?.team?.survivors ?? 0, modifiers: [s.A?.modifierPct ? `${nm.get(m.participantAId)}: ${s.A.modifierPct > 0 ? "+" : ""}${s.A.modifierPct}%` : null, s.B?.modifierPct ? `${nm.get(m.participantBId)}: ${s.B.modifierPct > 0 ? "+" : ""}${s.B.modifierPct}%` : null].filter(Boolean) as string[],
  };
}


