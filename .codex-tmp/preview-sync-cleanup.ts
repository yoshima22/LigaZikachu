import { prisma } from "../src/lib/prisma";
import { toBrtDateString } from "../src/lib/date-utils";

async function main() {
  const config = await prisma.syncChallengeConfig.findUnique({ where: { id: "singleton" }, select: { registrationOpensAt: true, round1At: true } });
  if (!config?.round1At) return console.log(JSON.stringify({ enabled: false, reason: "round1At ausente" }));
  const date = toBrtDateString(config.round1At);
  const rooms = await prisma.syncEventRoom.findMany({ where: { date: { lt: date } }, select: { id: true, date: true, teams: { select: { id: true } } } });
  console.log(JSON.stringify({ enabled: config.round1At > new Date(), scheduledDate: date, oldRooms: rooms.length, roomTeams: rooms.flatMap((room) => room.teams).length }));
}

main().catch(console.error).finally(() => prisma.$disconnect());
