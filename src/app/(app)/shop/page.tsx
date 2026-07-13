import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { isAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { Coins, ShoppingBag, Settings } from "lucide-react";
import { ShopGrid } from "./_components/shop-grid";
import { ShopTabs, TAB_ICONS } from "./_components/shop-tabs";
import { EGG_SHOP_TO_EGG_TYPE, LEAGUE_SHOP_ITEM_TYPES, MASCOT_SHOP_ITEM_TYPES, MEGA_STONE_SHOP_ITEM_TYPES } from "@/lib/shop-config";
import { getActiveShopItems, invalidateShopCache } from "@/lib/shop-cache";
import { isMegaStoneShopUnlocked } from "@/lib/mega-shop";
import { LEAGUE_ITEMS } from "@/app/(app)/combates/liga-semanal/constants";
import type { EggType } from "@prisma/client";
import { getActiveRaidSabotages, readSabotageNumber } from "@/lib/raid-event";

export const dynamic = "force-dynamic";

async function ensureWeeklyLeagueItems() {
  const active = await prisma.shopItem.count({ where: { active: true, type: { in: LEAGUE_ITEMS.map((item) => item.type) as never[] } } });
  if (active >= LEAGUE_ITEMS.length) return;
  for (const item of LEAGUE_ITEMS) {
    const existing = await prisma.shopItem.findFirst({ where: { type: item.type as never }, select: { id: true } });
    if (existing) await prisma.shopItem.update({ where: { id: existing.id }, data: { name: item.name, description: item.description, price: item.price, active: true } });
    else await prisma.shopItem.create({ data: { type: item.type as never, name: item.name, description: item.description, price: item.price, active: true } });
  }
  await invalidateShopCache();
}

export default async function ShopPage() {
  const session = await getAppSession();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);
  await ensureWeeklyLeagueItems();

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  const [wallet, rawItems, inventoryRows, eggCounts, foodItems, raidSabotages] = await Promise.all([
    player ? getOrCreateWallet(player.id) : null,
    getActiveShopItems(),
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
      : [],
    getActiveRaidSabotages("ZIKASHOP"),
  ]);
  const priceSabotage = raidSabotages.find((s) => s.sabotageType === "INCREASE_PRICE");
  const priceIncreasePct = priceSabotage ? readSabotageNumber(priceSabotage.effectJson, "priceIncreasePct", 10) : 0;
  const megaUnlocked = await isMegaStoneShopUnlocked();
  const safeRawItems = rawItems.filter((item) =>
    admin ||
    megaUnlocked ||
    !MEGA_STONE_SHOP_ITEM_TYPES.includes(item.type as typeof MEGA_STONE_SHOP_ITEM_TYPES[number])
  );
  const items = priceIncreasePct > 0
    ? safeRawItems.map((item) => ({
        ...item,
        price: Math.max(1, Math.ceil(item.price * (1 + priceIncreasePct / 100))),
        description: `${item.description ?? ""}${item.description ? " " : ""}[Ordem da Trapaça: preço adulterado +${priceIncreasePct}%]`,
      }))
    : safeRawItems;

  const ownedIds = new Set(inventoryRows.map((r) => r.itemId));
  const countByItemId = new Map(inventoryRows.map((r) => [r.itemId, r.quantity]));

  const titles   = items.filter((i) => i.type === "TITLE");
  const banners  = items.filter((i) => i.type === "BANNER");
  const frames   = items.filter((i) => i.type === "FRAME");
  const tickets  = items.filter((i) => i.type === "ZIKALOOT_TICKET");
  const megaItems = items.filter((i) => MEGA_STONE_SHOP_ITEM_TYPES.includes(i.type as typeof MEGA_STONE_SHOP_ITEM_TYPES[number]));
  const leagueItems = items.filter((i) => LEAGUE_SHOP_ITEM_TYPES.includes(i.type as typeof LEAGUE_SHOP_ITEM_TYPES[number]));
  const mascotItems = items.filter((i) =>
    MASCOT_SHOP_ITEM_TYPES.includes(i.type as typeof MASCOT_SHOP_ITEM_TYPES[number]) &&
    !LEAGUE_SHOP_ITEM_TYPES.includes(i.type as typeof LEAGUE_SHOP_ITEM_TYPES[number]) &&
    !MEGA_STONE_SHOP_ITEM_TYPES.includes(i.type as typeof MEGA_STONE_SHOP_ITEM_TYPES[number])
  );
  // Buffs ficam na mesma seção de Doces e Comidas — contar do inventário
  const buffInventory = inventoryRows.filter(r => {
    const item = items.find(i => i.id === r.itemId);
    return item && MASCOT_SHOP_ITEM_TYPES.includes(item.type as typeof MASCOT_SHOP_ITEM_TYPES[number]);
  });
  for (const row of buffInventory) {
    countByItemId.set(row.itemId, row.quantity);
  }
  const eggCountByType = new Map(eggCounts.map((row) => [row.type, row._count._all]));
  const foodCountByType = new Map(foodItems.map((row) => [row.type, row.quantity]));
  for (const item of mascotItems) {
    const eggType = EGG_SHOP_TO_EGG_TYPE[item.type];
    if (eggType) countByItemId.set(item.id, eggCountByType.get(eggType as EggType) ?? 0);
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

      {priceSabotage && (
        <div className="rounded-2xl border border-purple-500/35 bg-purple-500/10 p-4">
          <p className="text-[10px] uppercase tracking-widest text-purple-300">Interferência na loja</p>
          <p className="mt-1 text-sm font-bold text-slate-100">{priceSabotage.title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {priceSabotage.description ?? `Os preços foram adulterados em +${priceIncreasePct}%.`}
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ShoppingBag size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Nenhum item disponível na loja ainda.</p>
        </div>
      ) : (
        <ShopTabs tabs={[
          {
            id: "cosmeticos", label: "Cosméticos", icon: TAB_ICONS.titles,
            count: titles.length + banners.length + frames.length,
            content: (
              <div className="space-y-8">
                {titles.length > 0 && <ShopGrid title="Títulos de Perfil"
                  items={titles.map(i => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null, theme: i.theme ?? "NEUTRAL", flavorText: i.flavorText ?? null, entranceEffect: i.entranceEffect ?? "NONE" }))}
                  ownedIds={ownedIds} inventoryCounts={inventoryCountRecord} balance={wallet?.balance ?? 0} playerId={player?.id ?? null} />}
                {banners.length > 0 && <ShopGrid title="Banners de Perfil"
                  items={banners.map(i => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
                  ownedIds={ownedIds} inventoryCounts={inventoryCountRecord} balance={wallet?.balance ?? 0} playerId={player?.id ?? null} />}
                {frames.length > 0 && <ShopGrid title="Molduras de Avatar"
                  items={frames.map(i => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
                  ownedIds={ownedIds} inventoryCounts={inventoryCountRecord} balance={wallet?.balance ?? 0} playerId={player?.id ?? null} />}
              </div>
            ),
          },
          {
            id: "mascotes", label: "Mascotes & Ovos", icon: TAB_ICONS.mascots,
            count: mascotItems.length,
            content: mascotItems.length > 0 ? (
              <ShopGrid title="Ovos, Comida e Buffs de Mascote"
                items={mascotItems.map(i => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
                ownedIds={new Set()} inventoryCounts={inventoryCountRecord} balance={wallet?.balance ?? 0} playerId={player?.id ?? null} />
            ) : null,
          },
          {
            id: "liga-semanal", label: "Liga Semanal", icon: TAB_ICONS.buffs,
            count: leagueItems.length,
            content: leagueItems.length > 0 ? (
              <ShopGrid title="Itens táticos da Liga Semanal"
                items={leagueItems.map(i => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
                ownedIds={new Set()} inventoryCounts={inventoryCountRecord} balance={wallet?.balance ?? 0} playerId={player?.id ?? null} />
            ) : null,
          },
          ...((megaItems.length > 0 && (megaUnlocked || admin)) ? [{
            id: "mega", label: "Mega Evolução", icon: TAB_ICONS.buffs,
            count: megaItems.length,
            content: (
              <ShopGrid title="Pedras de Mega Evolução"
                items={megaItems.map(i => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
                ownedIds={new Set()} inventoryCounts={inventoryCountRecord} balance={wallet?.balance ?? 0} playerId={player?.id ?? null} />
            ),
          }] : []),
          {
            id: "tickets", label: "Tickets ZikaLoot", icon: TAB_ICONS.tickets,
            count: tickets.length,
            content: tickets.length > 0 ? (
              <ShopGrid title="Tickets ZikaLoot"
                items={tickets.map(i => ({ ...i, imageUrl: i.imageUrl ?? null, description: i.description ?? null }))}
                ownedIds={new Set()} inventoryCounts={inventoryCountRecord} balance={wallet?.balance ?? 0} playerId={player?.id ?? null} />
            ) : null,
          },
        ]} />
      )}
    </div>
  );
}
