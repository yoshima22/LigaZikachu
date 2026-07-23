import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { publishLeagueTicker } from "../src/lib/league-ticker";

const prisma = new PrismaClient();

function todayBrt() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const battleDate = todayBrt();
  const league = await prisma.weeklyMascotLeague.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!league) throw new Error("Nenhuma Liga Semanal ativa.");

  const matches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { leagueId: league.id, battleDate, status: "RESOLVED" },
    select: {
      id: true, battleSlot: true, playerAId: true, playerBId: true, winnerId: true, isDraw: true,
      playerASurvivors: true, playerBSurvivors: true,
      playerADamageDealt: true, playerBDamageDealt: true,
    },
  });
  if (!matches.length) throw new Error(`Nenhum combate resolvido em ${battleDate}.`);
  const battleDateLabel = battleDate.split("-").reverse().join("/");

  const playerIds = [...new Set(matches.flatMap((match) =>
    [match.playerAId, match.playerBId].filter((id): id is string => Boolean(id)),
  ))];
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, displayName: true },
  });
  const names = new Map(players.map((player) => [player.id, player.displayName]));
  const damage = (match: typeof matches[number]) => match.playerADamageDealt + match.playerBDamageDealt;
  const gap = (match: typeof matches[number]) => Math.abs(match.playerASurvivors - match.playerBSurvivors);
  const highlights = [
    [...matches].sort((a, b) => damage(b) - damage(a))[0],
    [...matches].sort((a, b) => gap(a) - gap(b))[0],
    [...matches].sort((a, b) => b.battleSlot - a.battleSlot)[0],
  ].filter((match, index, list) => list.findIndex((item) => item.id === match.id) === index).slice(0, 3);

  await publishLeagueTicker({
    type: "WEEKLY_LEAGUE_FIGHT_DAY",
    message: `Hoje foi dia de luta na Liga Semanal! O Professor Enguiça separou alguns destaques dos confrontos de ${battleDateLabel}.`,
    href: "/combates/liga-semanal",
    eventKey: `weekly-league:fight-day:${league.id}:${battleDate}`,
    priority: 1,
    ttlHours: 18,
  });

  for (const [index, match] of highlights.entries()) {
    const playerA = names.get(match.playerAId) ?? "Um treinador";
    const playerB = match.playerBId ? names.get(match.playerBId) ?? "outro treinador" : "outro treinador";
    const winner = match.winnerId ? names.get(match.winnerId) ?? "Um treinador" : null;
    const loser = match.winnerId === match.playerAId ? playerB : playerA;
    const message = match.isDraw
      ? `${playerA} e ${playerB} empataram na Liga Semanal após causarem ${damage(match).toLocaleString("pt-BR")} de dano combinado!`
      : index === 0
        ? `${winner} derrotou ${loser} em um dos confrontos mais intensos de hoje, com ${damage(match).toLocaleString("pt-BR")} de dano combinado!`
        : `${winner} venceu ${loser} na rodada ${match.battleSlot} da Liga Semanal. O Professor Enguiça anotou tudo!`;
    await publishLeagueTicker({
      type: "WEEKLY_LEAGUE_BATTLE",
      message,
      href: "/combates/liga-semanal",
      eventKey: `weekly-league:${match.id}:today-highlight-${index}`,
      priority: 2,
      ttlHours: 18,
    });
  }
  console.log(JSON.stringify({ battleDate, published: highlights.length + 1 }));
}

main().finally(async () => prisma.$disconnect());
