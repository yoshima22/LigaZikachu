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

      {/* Guia de tamanhos */}
      <Card>
        <p className="mb-3 font-semibold text-slate-200">📐 Tamanhos corretos de imagem</p>
        <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { tipo: "Banner de perfil", size: "1200×300px", obs: "Proporção 4:1. Será cortado em telas menores (object-cover)." },
            { tipo: "Moldura de foto", size: "128×128px PNG", obs: "Fundo TRANSPARENTE. Centro ~72×72px transparente (onde fica o avatar). Imagem maior que o avatar." },
            { tipo: "Título de perfil", size: "Sem imagem", obs: "O nome do título é exibido como texto — imagem é opcional." },
            { tipo: "Ticket ZikaLoot", size: "256×256px", obs: "Ícone decorativo quadrado, PNG ou JPG." },
          ].map((g) => (
            <div key={g.tipo} className="rounded-lg border border-border bg-slate-900/40 p-3">
              <p className="font-semibold text-slate-200 text-xs">{g.tipo}</p>
              <p className="mt-1 text-[#FFCB05] text-[11px]">{g.size}</p>
              <p className="mt-0.5 text-slate-500 text-[10px]">{g.obs}</p>
            </div>
          ))}
        </div>
      </Card>

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
          owners: i._count.ownerships,
          metadata: i.metadata ?? undefined,
          theme: i.theme ?? undefined,
          flavorText: i.flavorText ?? null,
          entranceEffect: i.entranceEffect ?? undefined,
        }))} />
      </Card>
    </div>
  );
}
