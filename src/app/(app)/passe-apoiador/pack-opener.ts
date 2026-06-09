/**
 * Abre um sticker pack pelo nome (para o sistema de recompensas VIP).
 * Não cobra ZikaCoins — a recompensa já é gratuita.
 */

import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { ZikaCoinTxType } from "@prisma/client";
import { pickRarity, pickCardFromPool, DUPLICATE_COINS } from "@/lib/sticker-pack";

export type PackOpenResult = {
  cards: { nationalId: number; displayName: string; imageUrl: string | null; rarity: string; isDuplicate: boolean; coinsEarned: number }[];
  totalCoinsEarned: number;
  packName: string;
  error?: string;
};

const EMPTY: PackOpenResult = { cards: [], totalCoinsEarned: 0, packName: "" };

export async function openStickerPackByName(playerId: string, packName: string): Promise<PackOpenResult> {
  // Busca o pack ativo pelo nome (match parcial)
  const pack = await prisma.stickerPack.findFirst({
    where: { active: true, name: { contains: packName } },
    orderBy: { name: "asc" },
  });
  if (!pack) return { ...EMPTY, packName, error: `Pack "${packName}" não encontrado.` };

  const genFilter = pack.generation ? getGenRange(`GEN${pack.generation}`) : null;
  const allCards = await prisma.pokemonCard.findMany({
    where: {
      active: true,
      ...(genFilter ? { nationalId: { gte: genFilter[0], lte: genFilter[1] } } : {}),
    },
    select: { id: true, nationalId: true, displayName: true, imageUrl: true, rarity: true },
  });
  if (allCards.length === 0) return { ...EMPTY, packName: pack.name, error: "Nenhuma figurinha disponível." };

  const byRarity = new Map<string, typeof allCards>();
  for (const card of allCards) {
    const list = byRarity.get(card.rarity) ?? [];
    list.push(card);
    byRarity.set(card.rarity, list);
  }

  const owned = await prisma.playerSticker.findMany({ where: { playerId }, select: { cardId: true, quantity: true } });
  const ownedMap = new Map(owned.map(o => [o.cardId, o.quantity]));

  const drawn: typeof allCards[number][] = [];
  const drawnIds = new Set<string>();
  for (let i = 0; i < pack.cardCount; i++) {
    const rarity = pickRarity(pack.rarityBoost);
    const pool = byRarity.get(rarity) ?? byRarity.get("COMMON") ?? allCards;
    const card = pickCardFromPool(pool, drawnIds);
    if (card) { drawn.push(card); drawnIds.add(card.id); }
  }

  let totalCoinsEarned = 0;
  const resultCards: PackOpenResult["cards"] = [];

  await prisma.$transaction(async (tx) => {
    for (const card of drawn) {
      const isDuplicate = ownedMap.has(card.id);
      const coinsEarned = isDuplicate ? (DUPLICATE_COINS[card.rarity as keyof typeof DUPLICATE_COINS] ?? 5) : 0;

      if (isDuplicate) {
        await tx.playerSticker.update({
          where: { playerId_cardId: { playerId, cardId: card.id } },
          data: { quantity: { increment: 1 } },
        });
        if (coinsEarned > 0) {
          await creditCoins(tx, { playerId, type: ZikaCoinTxType.DUPLICATE_STICKER_CONVERSION, amount: coinsEarned, description: `Duplicata VIP: ${card.displayName}` });
          totalCoinsEarned += coinsEarned;
        }
      } else {
        await tx.playerSticker.create({ data: { playerId, cardId: card.id, quantity: 1 } });
        ownedMap.set(card.id, 1);
      }

      resultCards.push({ nationalId: card.nationalId, displayName: card.displayName, imageUrl: card.imageUrl ?? null, rarity: card.rarity, isDuplicate, coinsEarned });
    }
  });

  return { cards: resultCards, totalCoinsEarned, packName: pack.name };
}

const GENERATION_RANGES: Record<string, [number, number]> = {
  GEN1: [1, 151], GEN2: [152, 251], GEN3: [252, 386], GEN4: [387, 493],
  GEN5: [494, 649], GEN6: [650, 721], GEN7: [722, 809], GEN8: [810, 905], GEN9: [906, 1025],
};
function getGenRange(gen: string): [number, number] | null {
  return GENERATION_RANGES[gen] ?? null;
}
