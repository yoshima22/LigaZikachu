import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { isAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { Coins, ShoppingBag, Settings } from "lucide-react";
import { ShopGrid } from "./_components/shop-grid";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const session = await auth();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  const [wallet, items, inventoryRows, eggCounts, foodItems] = await Promise.all([
    player ? getOrCreateWallet(player.id) : null,
    prisma.shopItem.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { rarity: "asc" }, { price: "asc" }]
    }),
    player
      ? prisma.playerInventory.findMany({
          where: { playerId: player.id },
          select: { itemId: true, quantity: true }
        })
      : [],
    player
      ? prisma.mascotEgg.groupBy({
          by: ["type"],
          where: { playerId: player.id },
          _count: { _all: true }
        })
      : [],
    player
      ? prisma.mascotFoodItem.findMany({
          where: { playerId: player.id },
          select: { type: true, quantity: true }
        })
      : []
  ]);

  const ownedIds = new Set(inventoryRows.map((r) => r.itemId));
  const countByItemId = new Map(inventoryRows.map((r) => [r.itemId, r.quantity]));

  const titles   = items.filter((i) => i.type === "TITLE");
  const banners  = items.filter((i) => i.type === "BANNER");
  const frames   = items.filter((i) => i.type === "FRAME");
  const tickets  = items.filter((i) => i.type === "ZIKALOOT_TICKET");
  const mascotItems = items.filter((i) =>
    ["EGG_COMMON", "EGG_RARE", "EGG_SPECIAL", "MASCOT_FOOD", "MASCOT_SWEET"].includes(i.type)
  );
  const eggCountByType = new Map(eggCounts.map((row) => [row.type, row._count._all]));
  const foodCountByType = new Map(foodItems.map((row) => [row.type, row.quantity]));
  for (const item of mascotItems) {
    if (item.type === "EGG_COMMON") countByItemId.set(item.id, eggCountByType.get("COMMON") ?? 0);
    if (item.type === "EGG_RARE") countByItemId.set(item.id, eggCountByType.get("RARE") ?? 0);
    if (item.type === "EGG_SPECIAL") countByItemId.set(item.id, eggCountByType.get("SPECIAL") ?? 0);
    if (item.type === "MASCOT_FOOD") countByItemId.set(item.id, foodCountByType.get("FOOD") ?? 0);
    if (item.type === "MASCOT_SWEET") countByItemId.set(item.id, foodCountByType.get("SWEET") ?? 0);
  }
  const inventoryCountRecord = Object.fromEntries(countByItemId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
          <h1 className="font-pixel text-base text-[#FFCB05]">ZikaShop</h1>
          <p className="mt-1 text-sm text-slate-400">Gaste suas ZikaCoins em títulos, banners, molduras, ovos e itens de mascote.</p>
        </div>
        <div className="flex items-center gap-3">
          {wallet && (
            <Link href="/carteira" className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-sm font-bold text-[#FFCB05]">
              <Coins size={16} />
              {wallet.balance.toLocaleString("pt-BR")} ZC
            </Link>
          )}
          {admin && (
            <Link href="/shop/admin" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
              <Settings size={14} /> Gerenciar
            </Link>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ShoppingBag size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Nenhum item disponível na loja ainda.</p>
        </div>
      ) : (
        <>
          {titles.length > 0 && (
            <ShopGrid
              title="Títulos de Perfil"
              items={titles.map((i) => ({
                ...i,
                imageUrl: i.imageUrl ?? null,
                description: i.description ?? null,
                theme: i.theme ?? "NEUTRAL",
                flavorText: i.flavorText ?? null,
                entranceEffect: i.entranceEffect ?? "NONE",
              }))}
              ownedIds={ownedIds}
              inventoryCounts={inventoryCountRecord}
              balance={wallet?.balance ?? 0}
              playerId={player?.id ?? null}
            />
          )}
          {banners.length > 0 && (
            <ShopGrid
              title="Banners de Perfil"
              items={banners.map((i) => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
              ownedIds={ownedIds}
              inventoryCounts={inventoryCountRecord}
              balance={wallet?.balance ?? 0}
              playerId={player?.id ?? null}
            />
          )}
          {frames.length > 0 && (
            <ShopGrid
              title="Molduras de Avatar"
              items={frames.map((i) => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
              ownedIds={ownedIds}
              inventoryCounts={inventoryCountRecord}
              balance={wallet?.balance ?? 0}
              playerId={player?.id ?? null}
            />
          )}
          {tickets.length > 0 && (
            <ShopGrid
              title="Tickets ZikaLoot"
              items={tickets.map((i) => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
              ownedIds={new Set()} // tickets não são únicos — sempre pode comprar mais
              inventoryCounts={inventoryCountRecord}
              balance={wallet?.balance ?? 0}
              playerId={player?.id ?? null}
            />
          )}
          {mascotItems.length > 0 && (
            <ShopGrid
              title="Mascotes: Ovos e Itens"
              items={mascotItems.map((i) => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
              ownedIds={new Set()}
              inventoryCounts={inventoryCountRecord}
              balance={wallet?.balance ?? 0}
              playerId={player?.id ?? null}
            />
          )}
        </>
      )}
    </div>
  );
}
