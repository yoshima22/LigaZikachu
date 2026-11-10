// Relatório diário (puro e determinístico): tudo sai dos dados persistidos; nenhum texto inventa fatos.
import { DAY_LABELS } from "./schedule";
import type { MatchSummary } from "./engine";
import type { MascotAgg, MascotMatchStats } from "./scoring";
import type { StandRow } from "./standings";

export type ReportMatch = {
  id: string; roundIndex: number; dayIndex: number; scheduledAt: string;
  a: string; b: string | null; aName: string; bName: string | null;
  winnerId: string | null; isDraw: boolean; hasReplay: boolean;
  summary: MatchSummary | { bye: true; roundIndex: number; dayIndex: number };
  stats: { A: MascotMatchStats[]; B: MascotMatchStats[] };
};
export type ReportRound = { roundIndex: number; dayIndex: number; standings: StandRow[] | null };

export type DailyReport = {
  day: number; dayLabel: string;
  summary: {
    rank: number | null; prevRank: number | null; rankDelta: number | null; dayPoints: number; totalPoints: number;
    wins: number; losses: number; draws: number; byes: number; battles: number;
    defeatedMascots: number; kos: number; damageDealt: number; damageTaken: number; healing: number; mitigated: number;
    bestStreak: number; roundsInTop: number; slotsExhausted: number;
  };
  mascots: { id: string; name: string; pokemonId: number; roles: string[]; battles: number; dayPoints: number; weekPoints: number; kos: number; assists: number; damageDealt: number; healing: number; mitigated: number; survivedBattles: number; eventRank: number | null; sources: Record<string, number> }[];
  timeline: { matchId: string; roundIndex: number; at: string; opponent: string | null; result: "W" | "L" | "D" | "BYE"; lineup: { name: string; pokemonId: number; role: string; slot: number; startHpPct: number }[]; defeated: string[]; substitutions: { slot: number; out: string; in: string; reason: string }[]; points: number; hasReplay: boolean; exhausted: "self" | "opponent" | "both" | null; modifierPct: number; streakNote: string | null; byCategory: Record<string, number>;
    mascots: { id: string; name: string; pokemonId: number; role: string; slot: number; startHpPct: number; endHpPct: number; survived: boolean; kos: number; assists: number; damage: number; healing: number; mitigated: number; total: number; sources: Record<string, number> }[] }[];
  text: string[];
  comparison: { day: number; label: string; points: number; rank: number | null; wins: number; losses: number; kos: number; survived: number }[];
};

const mine = (m: ReportMatch, pid: string) => (m.a === pid ? "A" : "B") as "A" | "B";
const nameOf = (id: string, stats: MascotMatchStats[]) => stats.find((s) => s.id === id)?.name ?? id;

export function buildDailyReport(pid: string, day: number, matches: ReportMatch[], rounds: ReportRound[], aggs: Record<string, MascotAgg>, leaderboard: { id: string; total: number }[], mascotNames: Record<string, { name: string; pokemonId: number }>): DailyReport {
  const mineAll = matches.filter((m) => m.a === pid || m.b === pid).sort((x, y) => x.roundIndex - y.roundIndex);
  const today = mineAll.filter((m) => m.dayIndex === day);
  const rankAfter = (d: number) => {
    const r = [...rounds].filter((x) => x.dayIndex === d && x.standings).sort((p, q) => q.roundIndex - p.roundIndex)[0];
    return r?.standings?.find((s) => s.pid === pid)?.rank ?? null;
  };
  const rank = rankAfter(day);
  const prevRank = day > 1 ? rankAfter(day - 1) : null;

  const acc = { wins: 0, losses: 0, draws: 0, byes: 0, kos: 0, dmg: 0, taken: 0, heal: 0, mit: 0, pts: 0, exhausted: 0 };
  const perMascot = new Map<string, DailyReport["mascots"][number]>();
  let streak = 0, best = 0;
  const timeline: DailyReport["timeline"] = [];
  for (const m of today) {
    if (!m.b) { acc.byes++; timeline.push({ matchId: m.id, roundIndex: m.roundIndex, at: m.scheduledAt, opponent: null, result: "BYE", lineup: [], defeated: [], substitutions: [], points: 0, hasReplay: false, exhausted: null, modifierPct: 0, streakNote: null, byCategory: {}, mascots: [] }); continue; }
    const s = m.summary as MatchSummary;
    const side = mine(m, pid);
    const me = side === "A" ? s.A : s.B!;
    const stats = side === "A" ? m.stats.A : m.stats.B;
    const result: "W" | "L" | "D" = m.isDraw ? "D" : m.winnerId === pid ? "W" : "L";
    if (result === "W") { acc.wins++; streak++; best = Math.max(best, streak); } else { streak = 0; if (result === "L") acc.losses++; else acc.draws++; }
    acc.kos += me.team.kos; acc.dmg += me.team.damageDealt; acc.taken += me.team.damageTaken; acc.heal += me.team.healing; acc.pts += me.team.pointsTotal;
    acc.mit += stats.reduce((a, x) => a + x.mitigated, 0);
    acc.exhausted = Math.max(acc.exhausted, me.exhaustedSlots);
    for (const st of stats) {
      const e = perMascot.get(st.id) ?? { id: st.id, name: st.name, pokemonId: st.pokemonId, roles: [], battles: 0, dayPoints: 0, weekPoints: 0, kos: 0, assists: 0, damageDealt: 0, healing: 0, mitigated: 0, survivedBattles: 0, eventRank: null, sources: {} };
      e.battles++; e.dayPoints += st.total; e.kos += st.kos; e.assists += st.assists; e.damageDealt += st.damageDealt; e.healing += st.healing; e.mitigated += st.mitigated; e.survivedBattles += st.survived ? 1 : 0;
      if (!e.roles.includes(st.role)) e.roles.push(st.role);
      for (const [k, v] of Object.entries(st.points)) e.sources[k] = (e.sources[k] ?? 0) + v;
      perMascot.set(st.id, e);
    }
    timeline.push({
      matchId: m.id, roundIndex: m.roundIndex, at: m.scheduledAt, opponent: side === "A" ? m.bName : m.aName, result,
      lineup: me.lineup.map((f) => ({ name: f.name, pokemonId: f.pokemonId, role: f.role, slot: f.slot, startHpPct: Math.round((f.startHp / Math.max(1, f.maxHp)) * 100) })),
      defeated: stats.filter((x) => !x.survived).map((x) => x.name),
      substitutions: me.substitutions.map((x) => ({ slot: x.slot, out: nameOf(x.out, stats), in: mascotNames[x.in]?.name ?? x.in, reason: x.reason === "DEFEATED" ? "derrotado" : "ferido" })),
      points: me.team.pointsTotal, hasReplay: m.hasReplay && !s.exhausted, modifierPct: me.modifierPct,
      exhausted: !s.exhausted ? null : s.exhausted === "BOTH" ? "both" : s.exhausted === side ? "self" : "opponent",
      streakNote: me.modifierPct < 0 ? `Pressão do Trono: ${me.winStreak} vitórias seguidas (${me.modifierPct}% de Força, Instinto, Vitalidade e Carisma)` : me.modifierPct > 0 ? `Calor da Lareira: ${me.lossStreak} derrotas seguidas (+${me.modifierPct}% nos mesmos atributos)` : null,
      byCategory: stats.reduce<Record<string, number>>((acc, x) => { for (const [k, v] of Object.entries(x.points)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {}),
      mascots: stats.map((x) => ({ id: x.id, name: x.name, pokemonId: x.pokemonId, role: x.role, slot: x.slot, startHpPct: Math.round((x.startHp / Math.max(1, me.lineup.find((f) => f.id === x.id)?.maxHp ?? x.startHp)) * 100), endHpPct: Math.round((x.endHp / Math.max(1, me.lineup.find((f) => f.id === x.id)?.maxHp ?? x.endHp)) * 100), survived: x.survived, kos: x.kos, assists: x.assists, damage: Math.round(x.damageDealt), healing: Math.round(x.healing), mitigated: Math.round(x.mitigated), total: x.total, sources: x.points })).sort((p, q) => q.total - p.total),
    });
  }
  const rankOf = new Map([...leaderboard].sort((a, b) => b.total - a.total).map((x, i) => [x.id, i + 1]));
  const mascots = [...perMascot.values()].map((e) => ({ ...e, weekPoints: aggs[e.id]?.total ?? 0, eventRank: rankOf.get(e.id) ?? null })).sort((a, b) => b.dayPoints - a.dayPoints);
  const defeated = new Set(timeline.flatMap((t) => t.defeated)).size;
  const roundsInTop = rounds.filter((r) => r.dayIndex === day && (r.standings?.find((s) => s.pid === pid)?.topStreak ?? 0) > 0).length;

  const text: string[] = [];
  const fights = acc.wins + acc.losses + acc.draws;
  if (fights > 0) text.push(`Seu time venceu ${acc.wins} das ${fights} batalhas de ${DAY_LABELS[day]?.toLowerCase() ?? "hoje"}${acc.draws ? ` (${acc.draws} empate${acc.draws > 1 ? "s" : ""})` : ""}.`);
  if (acc.byes) text.push(`Você folgou em ${acc.byes} rodada${acc.byes > 1 ? "s" : ""} por falta de adversário — sem pontos nem desgaste.`);
  const top = mascots[0];
  if (top && top.dayPoints > 0) text.push(`Seu mascote mais eficiente foi ${top.name}, com ${(top.dayPoints / 100).toFixed(1)} pontos${top.kos ? ` e ${top.kos} KO${top.kos > 1 ? "s" : ""}` : ""}.`);
  const sup = [...mascots].sort((a, b) => b.healing + b.mitigated - (a.healing + a.mitigated))[0];
  if (sup && sup.healing + sup.mitigated > 0) text.push(`${sup.name} sustentou o time (${Math.round(sup.healing)} de cura e ${Math.round(sup.mitigated)} de dano absorvido).`);
  const noTeam = timeline.filter((t) => t.exhausted === "self");
  if (noTeam.length) text.push(`Em ${noTeam.length} rodada${noTeam.length > 1 ? "s" : ""} (${noTeam.map((t) => new Date(t.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })).join(", ")}) sua equipe ficou sem mascotes em pé e perdeu por falta de mascotes, sem luta. Todos voltam com HP cheio na noite.`);
  if (acc.exhausted > 0) text.push(`${acc.exhausted === 1 ? "Um slot ficou" : `${acc.exhausted} slots ficaram`} sem reservas ao longo do dia.`);
  if (roundsInTop > 0) text.push(`Você passou ${roundsInTop} rodada${roundsInTop > 1 ? "s" : ""} entre os primeiros colocados.`);
  if (best >= 2) text.push(`Melhor sequência do dia: ${best} vitórias seguidas.`);
  if (rank && prevRank && rank !== prevRank) text.push(rank < prevRank ? `Você subiu ${prevRank - rank} posição(ões) e fechou o dia em ${rank}º.` : `Você caiu ${rank - prevRank} posição(ões) e fechou o dia em ${rank}º.`);
  if (!text.length) text.push("Sem batalhas registradas para este dia.");

  const comparison = Array.from({ length: Math.max(day, 1) }, (_, i) => i + 1).map((d) => {
    const ms = mineAll.filter((m) => m.dayIndex === d && m.b);
    let w = 0, l = 0, k = 0, p = 0, sv = 0;
    for (const m of ms) {
      const side = mine(m, pid); const s = m.summary as MatchSummary; const me = side === "A" ? s.A : s.B!;
      if (m.winnerId === pid) w++; else if (!m.isDraw) l++;
      k += me.team.kos; p += me.team.pointsTotal; sv += me.team.survivors;
    }
    return { day: d, label: DAY_LABELS[d] ?? `Dia ${d}`, points: p, rank: rankAfter(d), wins: w, losses: l, kos: k, survived: sv };
  });

  return {
    day, dayLabel: DAY_LABELS[day] ?? `Dia ${day}`,
    summary: { rank, prevRank, rankDelta: rank && prevRank ? prevRank - rank : null, dayPoints: acc.pts, totalPoints: Object.values(aggs).reduce((a, x) => a + x.total, 0), wins: acc.wins, losses: acc.losses, draws: acc.draws, byes: acc.byes, battles: fights, defeatedMascots: defeated, kos: acc.kos, damageDealt: acc.dmg, damageTaken: acc.taken, healing: acc.heal, mitigated: acc.mit, bestStreak: best, roundsInTop, slotsExhausted: acc.exhausted },
    mascots, timeline, text, comparison,
  };
}
