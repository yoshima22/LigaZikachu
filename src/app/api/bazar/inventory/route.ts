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

    const [mascots, eggs, foods, wallet, config] = await Promise.all([
      prisma.mascot.findMany({
        where: { playerId: player.id },
        select: {
          id: true, pokemonId: true, nickname: true, level: true,
          personality: true, isEquipped: true, bazarListed: true,
          statForce: true, statAgility: true, statCharisma: true,
          statInstinct: true, statVitality: true, battleWins: true,
        },
        orderBy: [{ isEquipped: "desc" }, { level: "desc" }],
      }),
      prisma.mascotEgg.findMany({
        where: { playerId: player.id, incubation: null, NOT: { origin: { startsWith: "bazar:" } } },
        select: { id: true, type: true },
      }),
      prisma.mascotFoodItem.findMany({ where: { playerId: player.id } }),
      getOrCreateWallet(player.id),
      prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } }),
    ]);

    return NextResponse.json({
      mascots,
      eggs,
      foods: foods.map(f => ({ type: f.type, quantity: f.quantity })),
      balance: wallet.balance,
      listingFee: config?.listingFee ?? 10,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
