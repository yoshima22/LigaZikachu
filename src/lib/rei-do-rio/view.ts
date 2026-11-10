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
import { pairRound, type StandRow } from "./standings";
import type { DayState, Formation, MascotSnap } from "./team";

export type EditionSummary = { id: string; name: string; isTest: boolean; phase: string; mondayDate: string; participants: number; autoRun: boolean; createdAt: string };

export async function listEditions(): Promise<EditionSummary[]> {
  const rows = await prisma.reiRioEdition.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { participants: true } } } });
  return rows.map((e) => ({ id: e.id, name: e.name, isTest: e.isTest, phase: e.phase, mondayDate: e.mondayDate, participants: e._count.participants, autoRun: e.autoRun, createdAt: e.createdAt.toISOString() }));
}

export type MascotLite = { id: string; pokemonId: number; name: string; level: number };
const lite = (m: MascotSnap): MascotLite => ({ id: m.id, pokemonId: m.pokemonId, name: m.nickname || m.speciesNameOverride || getPokemonName(m.pokemonId), level: m.level });
export const snapName = (m: MascotSnap) => lite(m).name;

/** Visão pública de uma equipe: só estrutura (slot/postura/nome/nível). Nunca HP, atributos ou estratégia. */
export type TeamView = { pid: string; name: string; isBot: boolean; formation: { slots: { role: string; mascotIds: string[] }[] }; day: number | null; mascots: MascotLite[] };

export type MatchRow = {
  id: string; roundIndex: number; a: string; b: string | null; aName: string; bName: string | null;
  winner: "A" | "B" | "DRAW" | null; scoreA: number; scoreB: number; rounds: number; exhausted: "A" | "B" | "BOTH" | null; bye: boolean;
};
export type Highlight = { key: string; label: string; icon: string; unit: string; top: { id: string; name: string; pokemonId: number; owner: string; pid: string; value: number }[] };
export type TodayRound = {
  roundIndex: number; slotInDay: number; at: string; status: string;
  /** Rodada já resolvida: resultados. */
  matches: MatchRow[] | null;
  /** Próxima rodada: confrontos já definidos (mesma conta do processamento real). Rodadas mais distantes: null (a definir). */
  pairs: { a: string; b: string | null; aName: string; bName: string | null }[] | null;
};

export type EditionView = {
  edition: {
    id: string; name: string; isTest: boolean; phase: string; restDay: number | null; mondayDate: string; registrationOpen: boolean; autoRun: boolean;
    lockAt: string; freezeAt: string | null; doneRounds: number; nextRoundAt: string | null; championName: string | null; cfg: ReiConfig; lockDropped: string[];
    participantCount: number; minParticipants: number; canceledReason: string | null;
  };
  /** Foto de perfil por participante (null = sem foto; bots nunca têm). */
  avatars: Record<string, string | null>;
  /** Destaques da edição por categoria (top 3 mascotes). */
  highlights: Highlight[];
  /** Combates do dia (resolvidos, próximos confrontos e rodadas a definir). */
  today: { day: number; rounds: TodayRound[] } | null;
  rounds: { roundIndex: number; dayIndex: number; slotInDay: number; scheduledAt: string; status: string; error: string | null }[];
  standings: StandRow[];
  /** Composição dos pontos por jogador (centésimos por categoria) e nº de lutas — explica a classificação. */
  breakdown: Record<string, { points: Record<string, number>; fights: number }>;
  mascotRanking: { pid: string; owner: string; id: string; name: string; pokemonId: number; total: number; kos: number; assists: number; healing: number; mitigated: number; damageDealt: number; matches: number; wins: number; survivedBattles: number; points: MascotAgg["points"]; byRole: Record<string, number> }[];
  teams: TeamView[];
  me: null | {
    participantId: string; registered: boolean; original: Formation | null; formation: Formation | null; state: DayState | null; day: number | null;
    roster: MascotSnap[]; restPlan: Formation | null; yesterday: Formation | null; stats: { total: number; wins: number; losses: number; draws: number; byes: number };
  };
  /** Coleção do jogador (só antes do fechamento): base do montador manual. */
  pool: MascotSnap[] | null;
  recent: { id: string; roundIndex: number; aName: string; bName: string | null; winner: "A" | "B" | "DRAW" | null; scoreA: number; scoreB: number; rounds: number; a: string; b: string | null; exhausted: "A" | "B" | "BOTH" | null }[];
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
  const breakdown: EditionView["breakdown"] = {};
  for (const p of parts) {
    const bd = (breakdown[p.id] = { points: { damage: 0, ko: 0, support: 0, resilience: 0, win: 0, leadership: 0 } as Record<string, number>, fights: p.wins + p.losses + p.draws });
    for (const a of Object.values((p.scoresJson ?? {}) as Record<string, MascotAgg>)) {
      for (const [k, v] of Object.entries(a.points)) bd.points[k] = (bd.points[k] ?? 0) + v;
      ranking.push({ pid: p.id, owner: p.displayName, id: a.id, name: a.name, pokemonId: a.pokemonId, total: a.total, kos: a.kos, assists: a.assists, healing: Math.round(a.healing), mitigated: Math.round(a.mitigated), damageDealt: a.damageDealt, matches: a.matches, wins: a.wins, survivedBattles: a.survivedBattles, points: a.points, byRole: a.byRole });
    }
  }
  ranking.sort((a, b) => b.total - a.total);

  // Formação efetiva do dia (a congelada às 08h), não a de segunda. Em descanso, os planos do próximo dia seguem ocultos.
  const dayRows = revealed ? await prisma.reiRioDayState.findMany({ where: { participant: { editionId } }, select: { participantId: true, dayIndex: true, formationJson: true } }) : [];
  const latest = new Map<string, { day: number; f: Formation }>();
  for (const d of dayRows) { const cur = latest.get(d.participantId); if (!cur || d.dayIndex > cur.day) latest.set(d.participantId, { day: d.dayIndex, f: d.formationJson as unknown as Formation }); }
  const teams: TeamView[] = revealed
    ? parts.filter((p) => p.rosterJson).map((p) => {
        const cur = latest.get(p.id);
        const f = cur?.f ?? (p.originalJson as unknown as Formation);
        return { pid: p.id, name: p.displayName, isBot: p.isBot, formation: { slots: f.slots.map((s) => ({ role: s.role, mascotIds: s.mascotIds })) }, day: cur?.day ?? null, mascots: ((p.rosterJson as MascotSnap[]) ?? []).map(lite) };
      })
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

  const nm = new Map(parts.map((p) => [p.id, p.displayName]));
  const recent = (await queryMatchRows(Prisma.sql`"editionId" = ${editionId} AND "participantBId" IS NOT NULL`, "DESC", 16, 0, nm));

  // Fotos de perfil: só URLs (nunca data-URL base64, que pesaria no egress).
  const realKeys = parts.filter((p) => !p.isBot).map((p) => p.playerKey);
  const avatars: Record<string, string | null> = Object.fromEntries(parts.map((p) => [p.id, null]));
  if (realKeys.length) {
    const rows = await prisma.$queryRaw<{ id: string; url: string | null }[]>`SELECT "id", CASE WHEN "avatarUrl" LIKE 'http%' THEN "avatarUrl" END AS url FROM "players" WHERE "id" = ANY(${realKeys})`;
    const byKey = new Map(rows.map((r) => [r.id, r.url]));
    for (const p of parts) if (!p.isBot) avatars[p.id] = byKey.get(p.playerKey) ?? null;
  }

  const highlights = buildHighlights(ranking);

  // Combates do dia: o dia da próxima rodada pendente (ou o último dia, se acabou).
  let today: EditionView["today"] = null;
  if (ed.phase !== "PREPARATION" && ed.phase !== "CANCELED") {
    const day = nextRound?.dayIndex ?? ed.rounds[ed.rounds.length - 1]?.dayIndex ?? 1;
    const dayRounds = ed.rounds.filter((r) => r.dayIndex === day);
    const dayRows = await queryMatchRows(Prisma.sql`"editionId" = ${editionId} AND "dayIndex" = ${day}`, "ASC", 400, 0, nm);
    let pairsFor: { roundIndex: number; pairs: NonNullable<TodayRound["pairs"]> } | null = null;
    if (nextRound && ed.phase !== "FINISHED") {
      const prev = nextRound.roundIndex > 1 ? ed.rounds[nextRound.roundIndex - 2] : null;
      const snapshot = prev ? (prev.standingsJson as unknown as StandRow[] | null) : initialStandings(parts.filter((p) => p.rosterJson).map((p) => ({ pid: p.id, name: p.displayName, isBot: p.isBot })), cfg);
      if (snapshot && (!prev || prev.status === "DONE")) {
        const past = (await prisma.reiRioMatch.findMany({ where: { editionId }, select: { participantAId: true, participantBId: true, dayIndex: true } })).map((m) => ({ a: m.participantAId, b: m.participantBId, day: m.dayIndex }));
        const pairs = pairRound(snapshot, past, nextRound.dayIndex, `${editionId}:r${nextRound.roundIndex}`);
        pairsFor = { roundIndex: nextRound.roundIndex, pairs: pairs.map((x) => ({ a: x.aId, b: x.bId, aName: nm.get(x.aId) ?? "?", bName: x.bId ? nm.get(x.bId) ?? "?" : null })) };
      }
    }
    today = {
      day,
      rounds: dayRounds.map((r) => ({
        roundIndex: r.roundIndex, slotInDay: r.slotInDay, at: r.scheduledAt.toISOString(), status: r.status,
        matches: r.status === "DONE" ? dayRows.filter((m) => m.roundIndex === r.roundIndex) : null,
        pairs: pairsFor?.roundIndex === r.roundIndex ? pairsFor.pairs : null,
      })),
    };
  }

  const cfgJson = (ed.configJson ?? {}) as { lockDropped?: string[]; canceledReason?: string };
  return {
    edition: {
      id: ed.id, name: ed.name, isTest: ed.isTest, phase: ed.phase, restDay: ed.restDay, mondayDate: ed.mondayDate, registrationOpen: ed.registrationOpen, autoRun: ed.autoRun,
      lockAt: lockAt(ed.mondayDate).toISOString(), freezeAt: ed.restDay ? freezeAt(ed.mondayDate, ed.restDay).toISOString() : null,
      doneRounds: done.length, nextRoundAt: nextRound?.scheduledAt.toISOString() ?? null, championName: ed.championKey ? nm.get(ed.championKey) ?? null : null, cfg, lockDropped: cfgJson.lockDropped ?? [],
      participantCount: parts.length, minParticipants: cfg.minParticipants, canceledReason: cfgJson.canceledReason ?? null,
    },
    avatars, highlights, today,
    rounds: ed.rounds.map((r) => ({ roundIndex: r.roundIndex, dayIndex: r.dayIndex, slotInDay: r.slotInDay, scheduledAt: r.scheduledAt.toISOString(), status: r.status, error: r.error })),
    standings, breakdown, mascotRanking: ranking.slice(0, 120), teams, me: meView, pool, recent,
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



type RawMatch = { id: string; roundIndex: number; a: string; b: string | null; winner: string | null; sa: number | null; sb: number | null; rounds: number | null; exhausted: string | null; bye: string | null };

/** Resumo dos combates sem carregar o JSON inteiro (só os campos necessários, extraídos no banco). */
async function queryMatchRows(where: Prisma.Sql, dir: "ASC" | "DESC", limit: number, offset: number, names: Map<string, string>): Promise<MatchRow[]> {
  const order = Prisma.raw(dir);
  const rows = await prisma.$queryRaw<RawMatch[]>`
    SELECT "id", "roundIndex", "participantAId" AS a, "participantBId" AS b,
      "summaryJson"->>'winner' AS winner, ("summaryJson"->'A'->'team'->>'pointsTotal')::int AS sa, ("summaryJson"->'B'->'team'->>'pointsTotal')::int AS sb,
      ("summaryJson"->>'rounds')::int AS rounds, "summaryJson"->>'exhausted' AS exhausted, "summaryJson"->>'bye' AS bye
    FROM "rdr_matches" WHERE ${where} ORDER BY "roundIndex" ${order}, "createdAt" ${order} LIMIT ${limit} OFFSET ${offset}`;
  return rows.map((m) => ({
    id: m.id, roundIndex: m.roundIndex, a: m.a, b: m.b, aName: names.get(m.a) ?? "?", bName: m.b ? names.get(m.b) ?? "?" : null,
    winner: m.bye ? null : ((m.winner as MatchRow["winner"]) ?? null), scoreA: m.sa ?? 0, scoreB: m.sb ?? 0, rounds: m.rounds ?? 0,
    exhausted: (m.exhausted as MatchRow["exhausted"]) ?? null, bye: !!m.bye,
  }));
}

/** Histórico paginado: combates de um dia (opcionalmente de uma rodada e/ou de um participante). */
export async function loadDayMatches(editionId: string, day: number, opts: { round?: number | null; participantId?: string | null; page?: number; pageSize?: number } = {}) {
  const pageSize = Math.max(1, Math.min(30, opts.pageSize ?? 10));
  const page = Math.max(1, opts.page ?? 1);
  const mine = opts.participantId ? Prisma.sql`AND ("participantAId" = ${opts.participantId} OR "participantBId" = ${opts.participantId})` : Prisma.sql`AND "participantBId" IS NOT NULL`;
  const roundSql = opts.round ? Prisma.sql`AND "roundIndex" = ${opts.round}` : Prisma.empty;
  const where = Prisma.sql`"editionId" = ${editionId} AND "dayIndex" = ${day} ${roundSql} ${mine}`;
  const [parts, total] = await Promise.all([
    prisma.reiRioParticipant.findMany({ where: { editionId }, select: { id: true, displayName: true } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "rdr_matches" WHERE ${where}`,
  ]);
  const names = new Map(parts.map((p) => [p.id, p.displayName]));
  const count = Number(total[0]?.n ?? 0);
  const items = await queryMatchRows(where, "ASC", pageSize, (page - 1) * pageSize, names);
  return { total: count, page, pageSize, pageCount: Math.max(1, Math.ceil(count / pageSize)), items };
}

function buildHighlights(ranking: EditionView["mascotRanking"]): Highlight[] {
  const defs: { key: string; label: string; icon: string; unit: string; val: (m: EditionView["mascotRanking"][number]) => number }[] = [
    { key: "points", label: "Mais pontos", icon: "👑", unit: "pts", val: (m) => m.total / 100 },
    { key: "damage", label: "Maior dano", icon: "⚔️", unit: "dano", val: (m) => m.damageDealt },
    { key: "kos", label: "Mais KOs", icon: "💥", unit: "KOs", val: (m) => m.kos },
    { key: "assists", label: "Mais assistências", icon: "🤝", unit: "assist.", val: (m) => m.assists },
    { key: "support", label: "Melhor suporte", icon: "💚", unit: "cura+absorção", val: (m) => m.healing + m.mitigated },
    { key: "survival", label: "Mais resistente", icon: "🛡️", unit: "lutas em pé", val: (m) => m.survivedBattles },
  ];
  return defs.map((d) => ({
    key: d.key, label: d.label, icon: d.icon, unit: d.unit,
    top: [...ranking].map((m) => ({ id: m.id, name: m.name, pokemonId: m.pokemonId, owner: m.owner, pid: m.pid, value: Math.round(d.val(m) * 10) / 10 })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 3),
  })).filter((h) => h.top.length > 0);
}
