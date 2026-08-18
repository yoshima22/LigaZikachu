/**
 * Refaz a chave de HOJE da Liga Semanal ativa usando o swissPairSlot corrigido
 * (com o passe de reparo anti-repetição no dia). Só roda se o dia ainda não tem
 * nenhum resultado/W.O. (partidas SCHEDULED/BYE). Replica generateDailyMatchupsAction.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { swissPairSlot, type PairingPlayer } from "../src/lib/league-pairing";

const prisma = new PrismaClient();
const brtDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function calcOdds(pA: { points: number; wins: number; damageDealt: number }, pB: { points: number; wins: number; damageDealt: number }) {
  const scoreA = pA.points * 10 + pA.wins * 5 + pA.damageDealt / 100;
  const scoreB = pB.points * 10 + pB.wins * 5 + pB.damageDealt / 100;
  const total = scoreA + scoreB;
  if (total === 0) return { oddsA: 1.9, oddsB: 1.9 };
  const round5 = (v: number) => Math.round(Math.round(v / 0.05) * 5) / 100;
  const margin = 0.92;
  return {
    oddsA: Math.max(1.1, round5(scoreA / total > 0.02 ? margin / (scoreA / total) : 8)),
    oddsB: Math.max(1.1, round5(scoreB / total > 0.02 ? margin / (scoreB / total) : 8)),
  };
}

async function main() {
  const today = brtDate();
  const league = await prisma.weeklyMascotLeague.findFirst({ where: { status: "ACTIVE" }, select: { id: true, weekKey: true } });
  if (!league) { console.log("Nenhuma liga semanal ATIVA."); return; }

  const existing = await prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId: league.id, battleDate: today } });
  if (existing.some((m) => m.status === "RESOLVED" || m.status === "WO")) {
    console.log("A chave de hoje já tem resultado/W.O. — abortando por segurança."); return;
  }

  // Reverte pontos de BYE e apaga as partidas de hoje (SCHEDULED/BYE/CANCELLED).
  for (const bye of existing.filter((m) => m.status === "BYE")) {
    await prisma.weeklyMascotLeagueParticipant.updateMany({ where: { leagueId: league.id, playerId: bye.playerAId }, data: { points: { decrement: 3 }, byes: { decrement: 1 } } });
  }
  await prisma.weeklyMascotLeagueMatch.deleteMany({ where: { leagueId: league.id, battleDate: today, status: { in: ["SCHEDULED", "BYE", "CANCELLED"] } } });

  const stored = await prisma.weeklyMascotLeagueParticipant.findMany({ where: { leagueId: league.id }, orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }] });
  const woWins = await prisma.weeklyMascotLeagueMatch.groupBy({ by: ["winnerId"], where: { leagueId: league.id, status: "WO", winnerId: { not: null } }, _count: { _all: true } });
  const freeWins = new Map(woWins.flatMap((w) => (w.winnerId ? [[w.winnerId, w._count._all] as const] : [])));
  const participants: PairingPlayer[] = stored.map((p) => ({ playerId: p.playerId, points: p.points, wins: p.wins, damageDealt: p.damageDealt, byes: p.byes, freeWins: freeWins.get(p.playerId) ?? 0, woLosses: p.woLosses }));
  if (participants.length < 2) { console.log("Menos de 2 participantes."); return; }

  // faced a partir de TODAS as partidas restantes (hoje já foi apagado).
  const prev = await prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId: league.id, playerBId: { not: null } }, select: { playerAId: true, playerBId: true } });
  const faced = new Map<string, Set<string>>();
  for (const m of prev) { if (!m.playerBId) continue; (faced.get(m.playerAId) ?? faced.set(m.playerAId, new Set()).get(m.playerAId)!).add(m.playerBId); (faced.get(m.playerBId) ?? faced.set(m.playerBId, new Set()).get(m.playerBId)!).add(m.playerAId); }

  const roundBase = await prisma.weeklyMascotLeagueMatch.count({ where: { leagueId: league.id } });
  const todayPaired = new Map<string, Set<string>>();
  const byeCount = new Map<string, number>();
  const statOf = new Map(participants.map((p) => [p.playerId, p]));

  for (const slot of [1, 2, 3]) {
    const pairings = swissPairSlot(participants, faced, todayPaired, byeCount, `${league.id}:${today}:${slot}`);
    for (const pair of pairings) {
      if (pair.bId) {
        const { oddsA, oddsB } = calcOdds(statOf.get(pair.aId)!, statOf.get(pair.bId)!);
        await prisma.weeklyMascotLeagueMatch.create({ data: { id: randomUUID(), leagueId: league.id, roundNumber: roundBase + slot, battleDate: today, battleSlot: slot, scheduledAt: new Date(), playerAId: pair.aId, playerBId: pair.bId, status: "SCHEDULED", resultJson: { oddsA, oddsB } } });
      } else {
        await prisma.weeklyMascotLeagueMatch.create({ data: { id: randomUUID(), leagueId: league.id, roundNumber: roundBase + slot, battleDate: today, battleSlot: slot, scheduledAt: new Date(), playerAId: pair.aId, status: "BYE", resolvedAt: new Date() } });
        await prisma.weeklyMascotLeagueParticipant.updateMany({ where: { leagueId: league.id, playerId: pair.aId }, data: { points: { increment: 3 }, byes: { increment: 1 } } });
      }
    }
  }

  // Confere o resultado
  const names = new Map((await prisma.player.findMany({ where: { id: { in: stored.map((s) => s.playerId) } }, select: { id: true, displayName: true } })).map((p) => [p.id, p.displayName]));
  const after = await prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId: league.id, battleDate: today }, select: { battleSlot: true, playerAId: true, playerBId: true, status: true }, orderBy: [{ battleSlot: "asc" }] });
  console.log(`Chave de hoje refeita (${league.weekKey}):`);
  for (const m of after) console.log(`  slot ${m.battleSlot}: ${names.get(m.playerAId) ?? m.playerAId} vs ${m.playerBId ? names.get(m.playerBId) ?? m.playerBId : "BYE"} [${m.status}]`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
