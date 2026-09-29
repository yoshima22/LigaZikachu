import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { formatBrtLocalInput } from "@/lib/brt";
import { ADMIN_LAB_RAINBOW_FEATHER_ID } from "@/lib/admin-lab-feather";
import { EggType, ShopItemType } from "@prisma/client";
import { FOOD_TYPE_LABELS, eggTypeLabel, itemTypeLabel, redeemItemCategory } from "@/lib/redeem-codes";
import { RedeemCodesAdmin } from "./redeem-codes-admin";

export const dynamic = "force-dynamic";

export default async function CodigosResgatePage() {
  await requirePlatformAdmin();
  const [codes, items] = await Promise.all([
    prisma.redeemCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { rewards: { orderBy: { id: "asc" }, include: { item: { select: { name: true } } } }, _count: { select: { redemptions: true } } },
    }),
    prisma.shopItem.findMany({
      where: { id: { not: ADMIN_LAB_RAINBOW_FEATHER_ID } },
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={14} /> Admin
      </Link>
      <h1 className="text-xl font-bold text-white">Códigos de resgate</h1>
      <RedeemCodesAdmin
        itemTypes={Object.values(ShopItemType).filter((t) => t !== "RAINBOW_FEATHER").map((t) => ({ value: t, label: itemTypeLabel(t), category: redeemItemCategory(t) }))}
        foodTypes={Object.entries(FOOD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        eggTypes={Object.values(EggType).map((t) => ({ value: t, label: eggTypeLabel(t) }))}
        items={items.map((i) => ({ ...i, category: redeemItemCategory(i.type) }))}
        codes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description ?? "",
          active: c.active,
          expiresAt: formatBrtLocalInput(c.expiresAt),
          expired: !!c.expiresAt && c.expiresAt.getTime() <= Date.now(),
          maxUses: c.maxUses,
          uses: c._count.redemptions,
          rewards: c.rewards.map((r) => ({
            kind: r.kind as "ITEM" | "ITEM_TYPE" | "EGG" | "MEGA_CHOICE" | "FOOD",
            itemId: r.itemId ?? undefined,
            itemType: r.itemType ?? undefined,
            eggType: r.eggType ?? undefined,
            quantity: r.quantity,
            label:
              r.kind === "EGG" ? eggTypeLabel(r.eggType ?? "")
              : r.kind === "FOOD" ? FOOD_TYPE_LABELS[r.itemType ?? ""] ?? "Comida"
              : r.kind === "ITEM_TYPE" ? `Tipo: ${itemTypeLabel(r.itemType ?? "")}`
              : r.kind === "MEGA_CHOICE" ? "Pedra de Mega à escolha do jogador"
              : r.item?.name ?? "Item removido",
          })),
        }))}
      />
    </div>
  );
}
