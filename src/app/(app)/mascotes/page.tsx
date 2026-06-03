import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { recalculateMood } from "@/lib/mascot";
import { MascotCard } from "./_components/mascot-card";
import { IncubatorPanel } from "./_components/incubator-panel";
import { Egg, Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MascotesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!player) return notFound();

  const [mascots, eggs, incubator, foods] = await Promise.all([
    prisma.mascot.findMany({
      where: { playerId: player.id },
      include: {
        expeditions: {
          where: { status: "ACTIVE" },
          orderBy: { startedAt: "desc" },
          take: 1
        }
      },
      orderBy: [{ isEquipped: "desc" }, { level: "desc" }]
    }),
    prisma.mascotEgg.findMany({
      where: { playerId: player.id, incubation: null },
      orderBy: { obtainedAt: "asc" }
    }),
    prisma.mascotIncubator.findUnique({
      where: { playerId: player.id },
      include: { egg: true }
    }),
    prisma.mascotFoodItem.findMany({ where: { playerId: player.id } }),
  ]);

  // Recalcula humor dos mascotes (fire-and-forget)
  void Promise.all(mascots.map(m => recalculateMood(m.id))).catch(() => {});

  const hasFood  = foods.some(f => f.type === "FOOD"  && f.quantity > 0);
  const hasSweet = foods.some(f => f.type === "SWEET" && f.quantity > 0);
  const foodCount  = foods.find(f => f.type === "FOOD")?.quantity ?? 0;
  const sweetCount = foods.find(f => f.type === "SWEET")?.quantity ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
          <h1 className="font-pixel text-base text-[#FFCB05]">Mascotes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Seus companheiros Pokémon — cuide deles, eles crescem com você.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Inventário de comida */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900/50 px-3 py-2 text-xs">
            <span>🍖</span>
            <span className="font-semibold text-slate-300">{foodCount}</span>
            <span className="text-slate-500">comida</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900/50 px-3 py-2 text-xs">
            <span>🍬</span>
            <span className="font-semibold text-slate-300">{sweetCount}</span>
            <span className="text-slate-500">doces</span>
          </div>
          <Link href="/shop" className="flex items-center gap-1.5 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20">
            <ShoppingBag size={12}/> Loja
          </Link>
        </div>
      </div>

      {/* Incubadora + Ovos */}
      <IncubatorPanel
        incubator={incubator ? {
          id: incubator.id,
          eggType: incubator.egg.type,
          startedAt: incubator.startedAt,
          finishAt: incubator.finishAt,
          hatched: incubator.hatched,
        } : null}
        eggs={eggs.map(e => ({ id: e.id, type: e.type, obtainedAt: e.obtainedAt, origin: e.origin }))}
      />

      {/* Meus Mascotes */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-200">
          <Heart size={16} className="text-[#FFCB05]" />
          Meus Mascotes
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{mascots.length}</span>
        </h2>

        {mascots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Egg size={36} className="mx-auto text-slate-600" />
            <p className="text-sm text-slate-500">Você ainda não tem mascotes.</p>
            <p className="text-xs text-slate-600">Consiga um ovo na ZikaShop ou em eventos e coloque na incubadora!</p>
            <Link href="/shop" className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
              <ShoppingBag size={12}/> Ver Ovos na Loja
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mascots.map(mascot => (
              <MascotCard
                key={mascot.id}
                mascot={{
                  id: mascot.id,
                  pokemonId: mascot.pokemonId,
                  nickname: mascot.nickname,
                  level: mascot.level,
                  exp: mascot.exp,
                  happiness: mascot.happiness,
                  mood: mascot.mood,
                  personality: mascot.personality,
                  isEquipped: mascot.isEquipped,
                  statForce: mascot.statForce,
                  statAgility: mascot.statAgility,
                  statCharisma: mascot.statCharisma,
                  statInstinct: mascot.statInstinct,
                  statVitality: mascot.statVitality,
                  hatchedAt: mascot.hatchedAt,
                  expeditions: mascot.expeditions.map(e => ({
                    id: e.id,
                    finishAt: e.finishAt,
                    status: e.status,
                  })),
                  hasFood,
                  hasSweet,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
