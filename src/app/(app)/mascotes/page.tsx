import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { recalculateMood } from "@/lib/mascot";
import { isAdmin } from "@/lib/auth/permissions";
import { MascotList } from "./_components/mascot-list";
import { IncubatorPanel } from "./_components/incubator-panel";
import { BuffPanel } from "./_components/buff-panel";
import { Egg, ShoppingBag, ChevronDown } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MascotesPage() {
  const session = await auth();
  if (!session?.user) return null;
  const admin = isAdmin(session.user.role);

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!player) return notFound();

  const BUFF_TYPES = ["MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD"];

  const [mascots, eggs, incubator, foods, buffInventory] = await Promise.all([
    prisma.mascot.findMany({
      where: { playerId: player.id },
      include: {
        expeditions: {
          where: { status: "ACTIVE" },
          orderBy: { startedAt: "desc" },
          take: 1
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 8
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
    prisma.playerInventory.findMany({
      where: { playerId: player.id, quantity: { gt: 0 }, item: { type: { in: BUFF_TYPES as string[] } } },
      include: { item: { select: { id: true, name: true, type: true } } }
    }),
  ]);

  // Recalcula humor dos mascotes (fire-and-forget)
  void Promise.all(mascots.map(m => recalculateMood(m.id))).catch(() => {});

  const hasFood    = foods.some(f => f.type === "FOOD"  && f.quantity > 0);
  const hasSweet   = foods.some(f => f.type === "SWEET" && f.quantity > 0);
  const foodCount  = foods.find(f => f.type === "FOOD")?.quantity ?? 0;
  const sweetCount = foods.find(f => f.type === "SWEET")?.quantity ?? 0;

  const mascotData = mascots.map(m => ({
    id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
    level: m.level, exp: m.exp, happiness: m.happiness,
    mood: m.mood, personality: m.personality, isEquipped: m.isEquipped,
    statForce: m.statForce, statAgility: m.statAgility, statCharisma: m.statCharisma,
    statInstinct: m.statInstinct, statVitality: m.statVitality,
    battleWins: m.battleWins, battleLosses: m.battleLosses,
    hatchedAt: m.hatchedAt,
    lastInteractedAt: m.lastInteractedAt,
    lastFedAt: m.lastFedAt,
    expeditions: m.expeditions.map(e => ({ id: e.id, finishAt: e.finishAt, status: e.status })),
    events: m.events.map(ev => ({ id: ev.id, emoji: ev.emoji, description: ev.description, createdAt: ev.createdAt })),
    hasFood, hasSweet,
    // Admin: lista de outros mascotes para trigger de batalha/amizade
    otherMascots: admin ? mascots.filter(o => o.id !== m.id && o.playerId !== player.id).map(o => ({
      id: o.id,
      name: o.nickname ?? `Pokémon #${o.pokemonId}`,
    })) : undefined,
  }));

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
        <div className="flex items-center gap-3 flex-wrap">
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

      {/* Como funciona — explicação para o jogador */}
      <details className="rounded-2xl border border-border bg-slate-950/50 overflow-hidden group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white select-none">
          <span className="flex items-center gap-2">📖 Como funciona o sistema de mascotes?</span>
          <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-5 py-4 grid gap-4 sm:grid-cols-2 text-xs text-slate-400 leading-relaxed">
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">🥚 Ovos & Incubadora</p>
            <p>Compre ovos na ZikaShop. Coloque um ovo na incubadora e aguarde <strong className="text-slate-300">10 minutos</strong> para chocar. Cada tipo de ovo tem Pokémon diferentes.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">⭐ Nível & Evolução</p>
            <p>Seu mascote ganha EXP em partidas, vitórias, interações e expedições. Ao atingir o nível certo, ele <strong className="text-slate-300">evolui automaticamente</strong>.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">💛 Cuidados diários</p>
            <p><strong className="text-slate-300">Brincar</strong> aumenta felicidade e EXP. <strong className="text-slate-300">Carinho</strong> pode ser recusado pelo mascote. <strong className="text-slate-300">Comida</strong> sacia fome. <strong className="text-slate-300">Doces</strong> dão bônus de EXP. Há cooldown de 5 minutos entre interações.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">🗺 Expedições</p>
            <p>Envie o mascote <strong className="text-slate-300">equipado</strong> em expedições de 1h. Ele pode trazer ovos, comida, doces ou ZikaCoins. Os itens vão para a Caixa de Presentes.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">📊 Status</p>
            <p>Acompanhe <strong className="text-slate-300">Fome</strong> (alimentar quando com fome), <strong className="text-slate-300">Humor</strong> (afeta interações disponíveis) e <strong className="text-slate-300">Desafio</strong> (indica o estado competitivo). Botões são desabilitados quando a ação não está disponível.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">💪 Stats</p>
            <p>Cada mascote tem 5 atributos que crescem com o nível. Passe o mouse sobre eles para ver para que servem. A personalidade influencia quais crescem mais rápido.</p>
          </div>
        </div>
      </details>

      {/* Itens especiais (buffs) */}
      {buffInventory.length > 0 && (
        <BuffPanel
          buffs={buffInventory.map(b => ({ id: b.item.id, name: b.item.name, type: b.item.type, quantity: b.quantity }))}
          mascots={mascotData.map(m => ({ id: m.id, name: m.nickname ?? `Pokémon #${m.pokemonId}`, isEquipped: m.isEquipped }))}
        />
      )}

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
        canSkipIncubation={admin}
      />

      {/* Meus Mascotes com paginação e filtros */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-200">🐾 Meus Mascotes</h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{mascots.length}</span>
        </div>

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
          <MascotList mascots={mascotData} isAdmin={admin} />
        )}
      </div>
    </div>
  );
}
