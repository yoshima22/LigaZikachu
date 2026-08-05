import { EggType, ZikaCoinTxType, type Prisma } from "@prisma/client";
import type { ModEffect } from "@/lib/sync-battle";

type SyncTeam = { id: string; playerAId: string; playerBId: string | null };
type SyncSelection = { teamId: string; playerId: string; mascotIds: string[] };
type SyncBattleResult = { result: string; teamADamage: number; teamBDamage: number };

const EGG_REWARD_MAP: Record<string, EggType> = {
  EGG_COMMON: EggType.COMMON,
  EGG_RARE: EggType.RARE,
  EGG_SPECIAL: EggType.SPECIAL,
  EGG_EVENT: EggType.EVENT,
  EGG_LAB: EggType.LAB,
  EGG_COMMON_CHANCE: EggType.COMMON,
};

function pokemonGeneration(id: number) {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  return 9;
}

const mascotTotal = (mascot: { statForce: number; statAgility: number; statVitality: number; statCharisma: number; statInstinct: number }) =>
  mascot.statForce + mascot.statAgility + mascot.statVitality + mascot.statCharisma + mascot.statInstinct;

export async function applySyncRoundRewardModifier(
  tx: Prisma.TransactionClient,
  modEffect: ModEffect | null,
  teamA: SyncTeam,
  teamB: SyncTeam,
  battleResult: SyncBattleResult,
  selections: SyncSelection[],
  roomId: string,
): Promise<void> {
  if (!modEffect) return;
  const effect = modEffect as Record<string, unknown>;
  const type = typeof effect.type === "string" ? effect.type : "";
  if (!type.startsWith("REWARD_")) return;

  const playersA = [teamA.playerAId, teamA.playerBId].filter((id): id is string => Boolean(id));
  const playersB = [teamB.playerAId, teamB.playerBId].filter((id): id is string => Boolean(id));
  const allPlayers = [...playersA, ...playersB];
  const aWon = battleResult.result === "TEAM_A_WIN";
  const bWon = battleResult.result === "TEAM_B_WIN";
  const winnerPlayers = aWon ? playersA : bWon ? playersB : [];

  const grantEgg = (playerId: string, eggType: EggType) => tx.mascotEgg.create({
    data: { playerId, type: eggType, origin: "Modificador da Arena Sincronizada" },
  });
  const grantCoins = async (playerId: string, amount: number) => {
    const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId } });
    if (!wallet || amount <= 0) return;
    await tx.zikaCoinWallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount }, totalEarned: { increment: amount } } });
    await tx.zikaCoinTransaction.create({ data: {
      walletId: wallet.id,
      type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance + amount,
      description: "Arena Sincronizada — bônus de modificador",
    } });
  };
  const grantItem = async (playerId: string, itemName: string) => {
    const exact = await tx.shopItem.findFirst({ where: { name: { equals: itemName, mode: "insensitive" } }, select: { id: true } });
    const item = exact ?? await tx.shopItem.findFirst({ where: { name: { contains: itemName, mode: "insensitive" } }, select: { id: true } });
    if (!item) {
      await tx.playerGift.create({ data: {
        playerId,
        type: "CUSTOM",
        title: "Recompensa da Arena Sincronizada",
        description: `Recompensa pendente: ${itemName}`,
        payload: { item: itemName, source: "sync-modifier" },
        status: "UNCLAIMED",
      } });
      return;
    }
    await tx.playerInventory.upsert({
      where: { playerId_itemId: { playerId, itemId: item.id } },
      update: { quantity: { increment: 1 } },
      create: { playerId, itemId: item.id, quantity: 1, equipped: false, source: "SYNC_MODIFIER" },
    });
  };

  if (type === "REWARD_WINNER") {
    const item = typeof effect.item === "string" ? effect.item : null;
    if (!item || winnerPlayers.length === 0) return;
    const recipients = effect.recipient === "RANDOM_WINNER"
      ? [winnerPlayers[Math.floor(Math.random() * winnerPlayers.length)]]
      : winnerPlayers;
    for (const playerId of recipients) await grantItem(playerId, item);
    return;
  }
  if (type === "REWARD_ALL") {
    const item = typeof effect.item === "string" ? effect.item : null;
    if (item) for (const playerId of allPlayers) await grantItem(playerId, item);
    return;
  }
  if (type === "REWARD_LOWEST_SCORE") {
    const item = typeof effect.item === "string" ? effect.item : null;
    if (!item) return;
    const scores = await tx.syncEventScore.findMany({ where: { roomId, playerId: { in: allPlayers } }, select: { playerId: true, wins: true, draws: true, damageDone: true } });
    const currentPoints = (playerId: string) => winnerPlayers.includes(playerId) ? 3 : (!aWon && !bWon ? 1 : 0);
    const currentDamage = (playerId: string) => playersA.includes(playerId) ? battleResult.teamADamage : battleResult.teamBDamage;
    const lowest = [...scores].sort((a, b) =>
      (a.wins * 3 + a.draws + currentPoints(a.playerId)) - (b.wins * 3 + b.draws + currentPoints(b.playerId))
      || (a.damageDone + currentDamage(a.playerId)) - (b.damageDone + currentDamage(b.playerId))
      || a.playerId.localeCompare(b.playerId)
    )[0];
    if (lowest) await grantItem(lowest.playerId, item);
    return;
  }
  if (type === "REWARD_CHANCE_WINNER") {
    const eggType = typeof effect.reward === "string" ? EGG_REWARD_MAP[effect.reward] : null;
    const chance = typeof effect.chance === "number" ? effect.chance : 0.05;
    if (eggType && winnerPlayers.length > 0 && Math.random() < chance) {
      await grantEgg(winnerPlayers[Math.floor(Math.random() * winnerPlayers.length)], eggType);
    }
    return;
  }
  if (type === "REWARD_UNDERDOG_WIN") {
    const value = typeof effect.value === "number" ? effect.value : 0;
    if (winnerPlayers.length === 0 || value <= 0) return;
    const idsA = selections.filter((selection) => selection.teamId === teamA.id).flatMap((selection) => selection.mascotIds);
    const idsB = selections.filter((selection) => selection.teamId === teamB.id).flatMap((selection) => selection.mascotIds);
    const mascots = await tx.mascot.findMany({ where: { id: { in: [...idsA, ...idsB] } }, select: {
      id: true, level: true, statForce: true, statAgility: true, statVitality: true, statCharisma: true, statInstinct: true,
    } });
    const summarize = (ids: string[]) => mascots.filter((mascot) => ids.includes(mascot.id)).reduce((sum, mascot) => ({ level: sum.level + mascot.level, stats: sum.stats + mascotTotal(mascot) }), { level: 0, stats: 0 });
    const summaryA = summarize(idsA);
    const summaryB = summarize(idsB);
    const aIsUnderdog = summaryA.level < summaryB.level || (summaryA.level === summaryB.level && summaryA.stats < summaryB.stats);
    const bIsUnderdog = summaryB.level < summaryA.level || (summaryA.level === summaryB.level && summaryB.stats < summaryA.stats);
    if ((aWon && aIsUnderdog) || (bWon && bIsUnderdog)) for (const playerId of winnerPlayers) await grantCoins(playerId, value);
    return;
  }
  if (type === "REWARD_RANDOM_PLAYER") {
    const value = typeof effect.value === "number" ? effect.value : 0;
    const playerId = allPlayers[Math.floor(Math.random() * allPlayers.length)];
    if (playerId) await grantCoins(playerId, value);
    return;
  }
  if (type === "REWARD_TOP_INSTINCT" || type === "REWARD_TOP_INSTINCT_CHANCE") {
    const chance = type === "REWARD_TOP_INSTINCT" ? 1 : (typeof effect.chance === "number" ? effect.chance : 0.2);
    const eggType = typeof effect.reward === "string" ? EGG_REWARD_MAP[effect.reward] : null;
    if (!eggType || Math.random() >= chance) return;
    const mascotIds = selections.flatMap((selection) => selection.mascotIds);
    const mascots = await tx.mascot.findMany({ where: { id: { in: mascotIds } }, select: { id: true, statInstinct: true } });
    const topInstinct = Math.max(...mascots.map((mascot) => mascot.statInstinct), -Infinity);
    const owners = new Set(selections.filter((selection) => selection.mascotIds.some((id) => mascots.some((mascot) => mascot.id === id && mascot.statInstinct === topInstinct))).map((selection) => selection.playerId));
    for (const playerId of owners) await grantEgg(playerId, eggType);
    return;
  }
  if (type === "REWARD_GEN_DIVERSITY") {
    const chance = typeof effect.value === "number" ? effect.value : 0.1;
    for (const selection of selections) {
      const mascots = await tx.mascot.findMany({ where: { id: { in: selection.mascotIds } }, select: { pokemonId: true } });
      if (new Set(mascots.map((mascot) => pokemonGeneration(mascot.pokemonId))).size >= 3 && Math.random() < chance) {
        await grantEgg(selection.playerId, EggType.COMMON);
      }
    }
  }
}
