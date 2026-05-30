"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { ZikaCoinTxType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import { pickRarity, DUPLICATE_COINS, GENERATION_RANGES } from "@/lib/sticker-pack";

export type PackOpenResult = {
  cards: {
    nationalId: number;
    displayName: string;
    imageUrl: string | null;
    rarity: string;
    isDuplicate: boolean;
    coinsEarned: number;
  }[];
  totalCoinsEarned: number;
  error?: string;
};

export async function openStickerPack(packId: string): Promise<PackOpenResult> {
  const EMPTY: PackOpenResult = { cards: [], totalCoinsEarned: 0 };

  try {
    const actor = await getSessionUser();
    if (!actor) return { ...EMPTY, error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { ...EMPTY, error: "Jogador não encontrado." };

    const pack = await prisma.stickerPack.findUnique({ where: { id: packId } });
    if (!pack || !pack.active) return { ...EMPTY, error: "Pacote não encontrado." };

    const wallet = await getOrCreateWallet(player.id);
    if (wallet.balance < pack.price)
      return { ...EMPTY, error: `Saldo insuficiente. Você tem ${wallet.balance} ZC, o pacote custa ${pack.price} ZC.` };

    // Buscar pool de Pokémon disponíveis
    const genFilter = pack.generation ? GENERATION_RANGES[pack.generation] : null;
    const allCards = await prisma.pokemonCard.findMany({
      where: {
        active: true,
        ...(genFilter ? { nationalId: { gte: genFilter[0], lte: genFilter[1] } } : {})
      },
      select: { id: true, nationalId: true, displayName: true, imageUrl: true, rarity: true }
    });

    if (allCards.length === 0)
      return { ...EMPTY, error: "Nenhuma figurinha disponível neste pacote. Peça ao admin para importar Pokémon." };

    // Agrupar pool por raridade
    const byRarity = new Map<string, typeof allCards>();
    for (const card of allCards) {
      const list = byRarity.get(card.rarity) ?? [];
      list.push(card);
      byRarity.set(card.rarity, list);
    }

    // Já possui o jogador
    const owned = await prisma.playerSticker.findMany({
      where: { playerId: player.id },
      select: { cardId: true, quantity: true }
    });
    const ownedMap = new Map(owned.map((o) => [o.cardId, o.quantity]));

    const drawn: typeof allCards[number][] = [];
    for (let i = 0; i < pack.cardCount; i++) {
      const rarity = pickRarity(pack.rarityBoost);
      const pool = byRarity.get(rarity) ?? byRarity.get("COMMON") ?? allCards;
      const card = pool[Math.floor(Math.random() * pool.length)];
      if (card) drawn.push(card);
    }

    let totalCoinsEarned = 0;
    const resultCards: PackOpenResult["cards"] = [];

    await prisma.$transaction(async (tx) => {
      // Debitar coins pelo pacote
      await creditCoins(tx, {
        playerId: player.id,
        type: ZikaCoinTxType.STICKER_PACK_PURCHASE,
        amount: -pack.price,
        description: `Pacote: ${pack.name}`
      });

      for (const card of drawn) {
        const alreadyHas = ownedMap.has(card.id);
        const isDuplicate = alreadyHas;
        const coinsEarned = isDuplicate ? DUPLICATE_COINS[card.rarity as keyof typeof DUPLICATE_COINS] ?? 5 : 0;

        if (alreadyHas) {
          await tx.playerSticker.update({
            where: { playerId_cardId: { playerId: player.id, cardId: card.id } },
            data: { quantity: { increment: 1 } }
          });
          if (coinsEarned > 0) {
            await creditCoins(tx, {
              playerId: player.id,
              type: ZikaCoinTxType.DUPLICATE_STICKER_CONVERSION,
              amount: coinsEarned,
              description: `Duplicata: ${card.displayName}`
            });
            totalCoinsEarned += coinsEarned;
          }
        } else {
          await tx.playerSticker.create({
            data: { playerId: player.id, cardId: card.id, quantity: 1 }
          });
          ownedMap.set(card.id, 1);
        }

        resultCards.push({
          nationalId: card.nationalId,
          displayName: card.displayName,
          imageUrl: card.imageUrl,
          rarity: card.rarity,
          isDuplicate,
          coinsEarned
        });
      }
    });

    revalidatePath("/album");
    revalidatePath("/carteira");
    return { cards: resultCards, totalCoinsEarned };
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function toggleFavoriteSticker(cardId: string): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const sticker = await prisma.playerSticker.findUnique({
      where: { playerId_cardId: { playerId: player.id, cardId } }
    });
    if (!sticker) return { error: "Você não possui esta figurinha." };

    await prisma.playerSticker.update({
      where: { playerId_cardId: { playerId: player.id, cardId } },
      data: { isFavorite: !sticker.isFavorite }
    });

    revalidatePath("/album");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
