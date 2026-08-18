/**
 * Recalcula os agregados dos participantes das ligas ATIVAS a partir das partidas,
 * aplicando a regra "W/O conta como BYE" (+3 pontos, 0 vitórias). Corrige a tabela
 * do dia atual sem depender do histórico de increments/decrements.
 *
 * Uso: node --env-file=.env -r ts-node/register scripts/recompute-league-standings.ts
 * (ou o runner de TS usado no projeto)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function recomputeRush(leagueId: string) {
  const [participants, matches] = await Promise.all([
    prisma.rushLeagueParticipant.findMany({ where: { leagueId } }),
    prisma.rushLeagueMatch.findMany({ where: { leagueId } }),
  ]);
  const agg = new Map(participants.map((p) => [p.playerId, { points: 0, wins: 0, losses: 0, draws: 0, survivorsScore: 0, damageDealt: 0, damageTaken: 0 }]));
  const add = (id: string | null | undefined, f: (a: NonNullable<ReturnType<typeof agg.get>>) => void) => { if (id && agg.has(id)) f(agg.get(id)!); };

  for (const m of matches) {
    if (m.status === "BYE") { add(m.playerAId, (a) => { a.points += 3; }); continue; }
    if (m.status === "WO") {
      // W/O = BYE: vencedor +3 pontos, 0 vitórias; perdedor +1 derrota.
      add(m.winnerId, (a) => { a.points += 3; });
      add(m.loserId, (a) => { a.losses += 1; });
      // Caso "ambos sem equipe": sem winner/loser definidos → ambos derrota.
      if (!m.winnerId && !m.loserId) { add(m.playerAId, (a) => a.losses++); add(m.playerBId, (a) => a.losses++); }
      continue;
    }
    if (m.status !== "RESOLVED") continue;
    const sideA = { id: m.playerAId, dealt: m.playerADamageDealt, taken: m.playerBDamageDealt, surv: m.playerASurvivors };
    const sideB = { id: m.playerBId, dealt: m.playerBDamageDealt, taken: m.playerADamageDealt, surv: m.playerBSurvivors };
    for (const s of [sideA, sideB]) add(s.id, (a) => { a.survivorsScore += s.surv; a.damageDealt += s.dealt; a.damageTaken += s.taken; });
    if (m.isDraw) { add(m.playerAId, (a) => { a.points += 1; a.draws++; }); add(m.playerBId, (a) => { a.points += 1; a.draws++; }); }
    else { add(m.winnerId, (a) => { a.points += 3; a.wins++; }); add(m.loserId, (a) => { a.losses++; }); }
  }

  await prisma.$transaction([...agg.entries()].map(([playerId, a]) =>
    prisma.rushLeagueParticipant.update({ where: { leagueId_playerId: { leagueId, playerId } }, data: a })));
  return agg.size;
}

async function recomputeWeekly(leagueId: string) {
  const [participants, matches] = await Promise.all([
    prisma.weeklyMascotLeagueParticipant.findMany({ where: { leagueId } }),
    prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId } }),
  ]);
  const agg = new Map(participants.map((p) => [p.playerId, { points: 0, wins: 0, losses: 0, draws: 0, woLosses: 0, byes: 0, survivorsScore: 0, damageDealt: 0, damageTaken: 0 }]));
  const add = (id: string | null | undefined, f: (a: NonNullable<ReturnType<typeof agg.get>>) => void) => { if (id && agg.has(id)) f(agg.get(id)!); };

  for (const m of matches) {
    if (m.status === "BYE") { add(m.playerAId, (a) => { a.points += 3; a.byes++; }); continue; }
    if (m.status === "WO") {
      // W/O = BYE: vencedor +3 pontos, +1 bye (0 vitórias); perdedor +1 woLoss.
      add(m.winnerId, (a) => { a.points += 3; a.byes++; });
      add(m.loserId, (a) => { a.woLosses++; });
      continue;
    }
    if (m.status !== "RESOLVED") continue;
    const sideA = { id: m.playerAId, dealt: m.playerADamageDealt, taken: m.playerADamageTaken, surv: m.playerASurvivors };
    const sideB = { id: m.playerBId, dealt: m.playerBDamageDealt, taken: m.playerBDamageTaken, surv: m.playerBSurvivors };
    for (const s of [sideA, sideB]) add(s.id, (a) => { a.survivorsScore += s.surv; a.damageDealt += s.dealt; a.damageTaken += s.taken; });
    if (m.isDraw) { add(m.playerAId, (a) => { a.points += 1; a.draws++; }); add(m.playerBId, (a) => { a.points += 1; a.draws++; }); }
    else { add(m.winnerId, (a) => { a.points += 3; a.wins++; }); add(m.loserId, (a) => { a.losses++; }); }
  }

  await prisma.$transaction([...agg.entries()].map(([playerId, a]) =>
    prisma.weeklyMascotLeagueParticipant.update({ where: { leagueId_playerId: { leagueId, playerId } }, data: a })));
  return agg.size;
}

async function main() {
  const rushLeagues = await prisma.rushLeague.findMany({ where: { status: "ACTIVE" }, select: { id: true, weekKey: true } });
  for (const l of rushLeagues) console.log(`[rush] ${l.weekKey}: recalculados ${await recomputeRush(l.id)} participantes`);

  const weeklyLeagues = await prisma.weeklyMascotLeague.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  for (const l of weeklyLeagues) console.log(`[weekly] ${l.id}: recalculados ${await recomputeWeekly(l.id)} participantes`);

  if (!rushLeagues.length && !weeklyLeagues.length) console.log("Nenhuma liga ATIVA para recalcular.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
