import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Package, Ticket } from "lucide-react";
import { InventoryClient } from "./_components/inventory-client";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const session = await getAppSession();
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

  const [inventory, syncLeftCount, syncRightCount, syncCompleteCount] = await Promise.all([
    prisma.playerInventory.findMany({
      where: { playerId: player.id },
      select: {
        id: true,
        equipped: true,
        purchasedAt: true,
        item: {
          select: {
            id: true, name: true, type: true, rarity: true,
            description: true, imageUrl: true, theme: true, flavorText: true,
          }
        }
      },
      orderBy: { purchasedAt: "desc" }
    }),
    prisma.syncTicketHalf.count({ where: { ownerId: player.id, side: "LEFT", status: { in: ["AVAILABLE", "SENT"] } } }),
    prisma.syncTicketHalf.count({ where: { ownerId: player.id, side: "RIGHT", status: { in: ["AVAILABLE", "SENT"] } } }),
    prisma.syncTicket.count({ where: { ownerId: player.id, status: { in: ["AVAILABLE", "RESERVED"] } } }),
  ]);

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
    equipped: i.equipped,
    theme: i.item.theme ?? "NEUTRAL",
    flavorText: i.item.flavorText ?? null,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
        <h1 className="font-pixel text-base text-[#FFCB05]">Meu Inventário</h1>
        <p className="mt-1 text-sm text-slate-400">Gerencie seus cosméticos e escolha o que equipar.</p>
      </div>

      {syncLeftCount + syncRightCount + syncCompleteCount > 0 && (
        <section className="rounded-2xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Ticket size={18} className="text-[#FFCB05]" />
                <h2 className="font-semibold text-slate-100">Tickets do Desafio Sincronizado</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Estes tickets usam regras proprias do evento. Monte, envie ou use na pagina do Desafio Sincronizado.
              </p>
            </div>
            <a href="/desafio-sincronizado" className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#FFD700]">
              Abrir evento
            </a>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-orange-400/20 bg-orange-500/10 p-3">
              <p className="text-xs uppercase tracking-widest text-orange-200/70">Esquerda fogo</p>
              <p className="mt-1 text-2xl font-black text-orange-100">{syncLeftCount}</p>
            </div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <p className="text-xs uppercase tracking-widest text-cyan-200/70">Direita agua</p>
              <p className="mt-1 text-2xl font-black text-cyan-100">{syncRightCount}</p>
            </div>
            <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/10 p-3">
              <p className="text-xs uppercase tracking-widest text-[#FFCB05]/70">Completos</p>
              <p className="mt-1 text-2xl font-black text-[#FFCB05]">{syncCompleteCount}</p>
            </div>
          </div>
        </section>
      )}

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
