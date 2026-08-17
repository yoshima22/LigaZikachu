import { ZikaCoinTxType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { creditCoins } from "../src/lib/zikacoins";

const WEEK_KEY = "2026-W31";
const CORRECTION_DESCRIPTION = "Correção de colocação da Liga Semanal 2026-W31";
const FINALIZATION_START = new Date("2026-07-31T23:30:00.000Z");
const FINALIZATION_END = new Date("2026-07-31T23:33:00.000Z");

async function main() {
const league = await prisma.weeklyMascotLeague.findUnique({
  where: { weekKey: WEEK_KEY },
  include: { participants: true },
});
if (!league) throw new Error(`Liga ${WEEK_KEY} não encontrada.`);

const players = await prisma.player.findMany({
  where: { id: { in: league.participants.map((participant) => participant.playerId) } },
  select: { id: true, displayName: true },
});
const playerById = new Map(players.map((player) => [player.id, player]));
const playerByName = new Map(players.map((player) => [player.displayName, player]));

const ranking = [...league.participants].sort((a, b) =>
  b.points - a.points
  || b.wins - a.wins
  || b.damageDealt - a.damageDealt
  || b.survivorsScore - a.survivorsScore
  || a.damageTaken - b.damageTaken,
);
const rankByPlayerId = new Map(ranking.map((participant, index) => [participant.playerId, index + 1]));
const expectedTop = ["Moisés", "Glauco", "Shira"];
const actualTop = ranking.slice(0, 3).map((participant) => playerById.get(participant.playerId)?.displayName);
if (JSON.stringify(actualTop) !== JSON.stringify(expectedTop)) {
  throw new Error(`Topo inesperado: ${actualTop.join(", ")}`);
}

const changedPlacements = ranking
  .map((participant, index) => ({
    playerId: participant.playerId,
    player: playerById.get(participant.playerId)?.displayName ?? participant.playerId,
    before: participant.finalRank,
    after: index + 1,
  }))
  .filter((entry) => entry.before !== entry.after);

const gifts = await prisma.playerGift.findMany({
  where: {
    playerId: { in: league.participants.map((participant) => participant.playerId) },
    createdAt: { gte: FINALIZATION_START, lte: FINALIZATION_END },
  },
});
const participationGifts = gifts.filter((gift) => gift.title === "Liga Semanal: Ovo de Evento");
const surpriseGifts = gifts.filter((gift) => gift.title.startsWith("Caixa Surpresa:"));
if (participationGifts.length !== ranking.length || surpriseGifts.length !== 6) {
  throw new Error(`Presentes inesperados: participação=${participationGifts.length}, caixas=${surpriseGifts.length}.`);
}

const glauco = playerByName.get("Glauco");
const moises = playerByName.get("Moisés");
if (!glauco || !moises) throw new Error("Glauco ou Moisés não encontrado.");
const transferableBox = surpriseGifts
  .filter((gift) => gift.playerId === glauco.id && gift.status === "UNCLAIMED")
  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
if (!transferableBox) throw new Error("Nenhuma caixa não resgatada de Glauco disponível para transferência.");

const coinAdjustments = new Map<string, number>([
  ["Luiz", 100],
  ["Eduardo Borges", -100],
  ["Lukas P", 100],
  ["Amigo da Infelicidade", -100],
]);

await prisma.$transaction(async (tx) => {
  for (const participant of ranking) {
    await tx.weeklyMascotLeagueParticipant.update({
      where: { id: participant.id },
      data: { finalRank: rankByPlayerId.get(participant.playerId) },
    });
  }
  await tx.weeklyMascotLeague.update({
    where: { id: league.id },
    data: { championPlayerId: moises.id },
  });

  await tx.playerGift.update({
    where: { id: transferableBox.id },
    data: { playerId: moises.id },
  });

  for (const gift of participationGifts) {
    const rank = rankByPlayerId.get(gift.playerId);
    await tx.playerGift.update({
      where: { id: gift.id },
      data: { description: `Prêmio de participação válida - ${rank}º lugar.` },
    });
  }
  for (const gift of surpriseGifts) {
    const ownerId = gift.id === transferableBox.id ? moises.id : gift.playerId;
    const rank = rankByPlayerId.get(ownerId);
    await tx.playerGift.update({
      where: { id: gift.id },
      data: { description: `Conteúdo da caixa do ${rank}º lugar da Liga Semanal.` },
    });
  }

  for (const [name, amount] of coinAdjustments) {
    const player = playerByName.get(name);
    if (!player) throw new Error(`Jogador ${name} não encontrado.`);
    const alreadyApplied = await tx.zikaCoinTransaction.count({
      where: { wallet: { playerId: player.id }, description: CORRECTION_DESCRIPTION },
    });
    if (alreadyApplied === 0) {
      await creditCoins(tx, {
        playerId: player.id,
        type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
        amount,
        description: CORRECTION_DESCRIPTION,
      });
    }
  }

  await tx.leagueTickerEvent.updateMany({
    where: { eventKey: `weekly-league-champion:${league.id}` },
    data: { expiresAt: new Date() },
  });
  await tx.leagueTickerEvent.upsert({
    where: { eventKey: `weekly-league-champion-correction:${league.id}` },
    create: {
      type: "WEEKLY_LEAGUE_CHAMPION_CORRECTION",
      message: "Correção da Liga Semanal: Moisés foi o campeão da semana. Parabéns!",
      href: "/combates/liga-semanal",
      eventKey: `weekly-league-champion-correction:${league.id}`,
      priority: 12,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
    update: {
      message: "Correção da Liga Semanal: Moisés foi o campeão da semana. Parabéns!",
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  await tx.auditLog.create({
    data: {
      entityType: "weekly_mascot_league",
      entityId: league.id,
      action: "weekly_league.placements_repaired",
      before: {
        championPlayerId: league.championPlayerId,
        placements: changedPlacements.map(({ playerId, player, before }) => ({ playerId, player, rank: before })),
      },
      after: {
        championPlayerId: moises.id,
        champion: moises.displayName,
        placements: changedPlacements.map(({ playerId, player, after }) => ({ playerId, player, rank: after })),
        transferredGiftId: transferableBox.id,
        coinAdjustments: Object.fromEntries(coinAdjustments),
      },
    },
  });
}, { timeout: 30_000, maxWait: 10_000 });

console.log(JSON.stringify({
  leagueId: league.id,
  champion: moises.displayName,
  changedPlacements,
  transferredGift: { id: transferableBox.id, title: transferableBox.title, from: "Glauco", to: "Moisés" },
  coinAdjustments: Object.fromEntries(coinAdjustments),
}, null, 2));

await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
