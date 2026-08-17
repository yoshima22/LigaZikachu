import { prisma } from "../src/lib/prisma";
import { runSyncBattle } from "../src/lib/sync-battle";

async function main() {
const mascots = await prisma.mascot.findMany({ take: 12, where: { level: { gte: 1 } }, select: { id: true } });
if (mascots.length < 12) throw new Error("Mascotes insuficientes para a verificacao.");
const teamA = { id: "verify-a", playerAId: "a1", playerBId: "a2" };
const teamB = { id: "verify-b", playerAId: "b1", playerBId: "b2" };
const selections = [
  { teamId: teamA.id, playerId: "a1", mascotIds: mascots.slice(0, 3).map((m) => m.id) },
  { teamId: teamA.id, playerId: "a2", mascotIds: mascots.slice(3, 6).map((m) => m.id) },
  { teamId: teamB.id, playerId: "b1", mascotIds: mascots.slice(6, 9).map((m) => m.id) },
  { teamId: teamB.id, playerId: "b2", mascotIds: mascots.slice(9, 12).map((m) => m.id) },
];
const output = await runSyncBattle({ teamA, teamB, selections, modifierId: null });
const replay = output.replayJson as { version: number; log: unknown[]; lineupA: unknown[]; lineupB: unknown[] };
console.log(JSON.stringify({
  result: output.result,
  damage: [output.teamADamage, output.teamBDamage],
  survivors: [output.survivingA, output.survivingB],
  replayVersion: replay.version,
  actions: replay.log.length,
  lineups: [replay.lineupA.length, replay.lineupB.length],
}));
await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
