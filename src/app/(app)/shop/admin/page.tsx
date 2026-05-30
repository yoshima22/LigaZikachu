import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ShopAdminPanel } from "./_components/shop-admin-panel";

export const dynamic = "force-dynamic";

export default async function ShopAdminPage() {
  await requireAdmin();

  const items = await prisma.shopItem.findMany({
    orderBy: [{ type: "asc" }, { rarity: "asc" }, { name: "asc" }],
    include: { _count: { select: { ownerships: true } } }
  });

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/shop" className="hover:text-slate-300">ZikaShop</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Admin</span>
      </nav>

      <div>
        <h1 className="font-pixel text-base text-[#FFCB05]">Gerenciar ZikaShop</h1>
        <p className="mt-1 text-sm text-slate-400">Cadastre e gerencie itens da loja.</p>
      </div>

      <Card>
        <p className="mb-3 text-xs text-slate-500">
          Banners: proporção recomendada 3:1 (ex: 1500×500px). Use object-cover, imagem centralizada no mobile.
        </p>
        <ShopAdminPanel items={items.map((i) => ({
          id: i.id,
          type: i.type,
          name: i.name,
          description: i.description ?? null,
          imageUrl: i.imageUrl ?? null,
          rarity: i.rarity,
          price: i.price,
          active: i.active,
          owners: i._count.ownerships
        }))} />
      </Card>
    </div>
  );
}
