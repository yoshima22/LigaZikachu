import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { getMiauvadaoConfig } from "@/app/(app)/bazar/actions";
import { cleanupExpiredArenaResting, syncDefeatedArenaTeams } from "@/lib/arena-z";
import { getWeeklyLeagueLockedMascotIds } from "@/lib/weekly-league-locks";

const HIDDEN_BAZAR_ITEM_TYPES = [
  "SYNC_TICKET_FIRE_LEFT",
  "SYNC_TICKET_WATER_RIGHT",
  "SYNC_TICKET_COMPLETE",
  "TRACE_MAP_SHORT",
  "TRACE_MAP_MEDIUM",
  "TRACE_MAP_LONG",
  "TRACE_MAP_WEEKLY",
  "TRACE_HUNT_TICKET",
  "TRACE_SIGNAL_FLARE",
  "TRACE_DECOY",
  "TRACE_SILENCE_POTION",
  "TRACE_ARMOR_VEST",
  "TRACE_MIST_SHIELD",
  "TRACE_INSTINCT_BOOST",
  "TRACE_GOLDEN_TICKET",
  "TRACE_SPECIAL_MAP",
] as const;

export async function GET() {
  try {
    const session = await getAppSession();
    if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!player) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

    await Promise.all([
      cleanupExpiredArenaResting(player.id),
      syncDefeatedArenaTeams(player.id),
    ]).catch(() => null);

    const weeklyLeagueLockedIds = await getWeeklyLeagueLockedMascotIds(prisma, player.id);

    const [mascots, eggs, foods, inventoryItems, wallet, config] = await Promise.all([
      // Mascotes disponíveis (não feridos, não em expedição, não no bazar, não em equipe de arena)
      prisma.mascot.findMany({
        where: {
          playerId: player.id,
          bazarListed: false,
          operationsLocked: false,
          isEquipped: false,
          arenaState: "FREE",
          id: { notIn: [...weeklyLeagueLockedIds] },
          expeditions: { none: { status: "ACTIVE" } },
          arenaTeamMembers: { none: { team: { status: "ACTIVE" } } },
        },
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
        where: {
          playerId: player.id,
          quantity: { gt: 0 },
          item: { type: { notIn: [...HIDDEN_BAZAR_ITEM_TYPES] as never[] } },
        },
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
      getMiauvadaoConfig(),
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
