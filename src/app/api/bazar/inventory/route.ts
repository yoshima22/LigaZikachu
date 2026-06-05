import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";

export async function GET() {
  try {
    const session = await getAppSession();
    if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const player = await prisma.player.findUnique({ where: { userId: session.user.id } });
    if (!player) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

    const [mascots, eggs, foods, inventoryItems, wallet, config] = await Promise.all([
      // Mascotes disponíveis (não feridos, não em expedição, não no bazar, não em equipe de arena)
      prisma.mascot.findMany({
        where: { playerId: player.id },
        select: {
          id: true, pokemonId: true, nickname: true, level: true,
          personality: true, isEquipped: true, bazarListed: true,
          arenaState: true,
          statForce: true, statAgility: true, statCharisma: true,
          statInstinct: true, statVitality: true, battleWins: true,
        },
        orderBy: [{ isEquipped: "desc" }, { level: "desc" }],
      }),
      // Ovos — excluindo os em incubação ou em escrow do bazar
      prisma.mascotEgg.findMany({
        where: {
          playerId: player.id,
          incubation: null,
          NOT: { origin: { startsWith: "bazar:" } }
        },
        select: { id: true, type: true },
      }),
      // Comida e doces
      prisma.mascotFoodItem.findMany({ where: { playerId: player.id } }),
      // TODOS os itens do PlayerInventory com dados completos do shop
      // (buffs, tickets, cosméticos, etc.)
      prisma.playerInventory.findMany({
        where: { playerId: player.id, quantity: { gt: 0 } },
        include: {
          item: {
            select: {
              id: true, name: true, type: true, rarity: true,
              price: true, description: true, imageUrl: true,
            }
          }
        },
        orderBy: [{ item: { type: "asc" } }, { item: { name: "asc" } }],
      }),
      getOrCreateWallet(player.id),
      prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } }),
    ]);

    return NextResponse.json({
      mascots,
      eggs,
      foods: foods.map(f => ({ type: f.type, quantity: f.quantity })),
      // Todos os itens do inventário com info completa do shop
      inventoryItems: inventoryItems.map(inv => ({
        inventoryId: inv.id,
        shopItemId: inv.itemId,
        type: inv.item.type,
        name: inv.item.name,
        description: inv.item.description ?? null,
        imageUrl: inv.item.imageUrl ?? null,
        rarity: inv.item.rarity,
        shopPrice: inv.item.price,
        quantity: inv.quantity,
        equipped: inv.equipped,
      })),
      balance: wallet.balance,
      listingFee: config?.listingFee ?? 10,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
