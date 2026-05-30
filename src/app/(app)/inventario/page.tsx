import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Package } from "lucide-react";
import { InventoryClient } from "./_components/inventory-client";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const session = await auth();
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!player) return (
    <div className="py-20 text-center text-sm text-slate-500">
      Crie um perfil de jogador para acessar o inventário.
    </div>
  );

  const inventory = await prisma.playerInventory.findMany({
    where: { playerId: player.id },
    include: { item: true },
    orderBy: { purchasedAt: "desc" }
  });

  const titles  = inventory.filter((i) => i.item.type === "TITLE");
  const banners = inventory.filter((i) => i.item.type === "BANNER");
  const frames  = inventory.filter((i) => i.item.type === "FRAME");

  const mapItem = (i: typeof inventory[number]) => ({
    inventoryId: i.id,
    itemId: i.item.id,
    name: i.item.name,
    description: i.item.description ?? null,
    imageUrl: i.item.imageUrl ?? null,
    rarity: i.item.rarity,
    type: i.item.type,
    equipped: i.equipped
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
        <h1 className="font-pixel text-base text-[#FFCB05]">Meu Inventário</h1>
        <p className="mt-1 text-sm text-slate-400">Gerencie seus cosméticos e escolha o que equipar.</p>
      </div>

      {inventory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Package size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Você ainda não comprou nenhum item.</p>
          <a href="/shop" className="mt-3 inline-block text-sm text-[#FFCB05] hover:underline">Ir para a ZikaShop →</a>
        </div>
      ) : (
        <InventoryClient
          titles={titles.map(mapItem)}
          banners={banners.map(mapItem)}
          frames={frames.map(mapItem)}
        />
      )}
    </div>
  );
}
