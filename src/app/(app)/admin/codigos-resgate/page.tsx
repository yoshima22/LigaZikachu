import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { formatBrtLocalInput } from "@/lib/brt";
import { ADMIN_LAB_RAINBOW_FEATHER_ID } from "@/lib/admin-lab-feather";
import { redeemItemCategory } from "@/lib/redeem-codes";
import { RedeemCodesAdmin } from "./redeem-codes-admin";

export const dynamic = "force-dynamic";

export default async function CodigosResgatePage() {
  await requirePlatformAdmin();
  const [codes, items] = await Promise.all([
    prisma.redeemCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { rewards: { include: { item: { select: { name: true } } } }, _count: { select: { redemptions: true } } },
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
          rewards: c.rewards.map((r) => ({ itemId: r.itemId, name: r.item.name, quantity: r.quantity })),
        }))}
      />
    </div>
  );
}
