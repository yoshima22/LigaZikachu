import { getAppSession } from "@/lib/session";
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
  const session = await getAppSession();
  if (!session?.user) return null;
  const admin = isAdmin(session.user.role);

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!player) return notFound();

  const BUFF_TYPES = ["MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD"];

  const eggShopImages = await prisma.shopItem.findMany({
    where: { type: { in: ["EGG_COMMON","EGG_RARE","EGG_SPECIAL","EGG_GEN1","EGG_GEN2"] }, imageUrl: { not: null } },
    select: { type: true, imageUrl: true }
  });
  const eggImageByType: Record<string, string> = {};
  for (const e of eggShopImages) {
    const key = e.type.replace("EGG_",""); // EGG_RARE → RARE, EGG_GEN1 → GEN1
    if (e.imageUrl) eggImageByType[key] = e.imageUrl;
  }

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
      orderBy: [{ isFavorite: "desc" }, { isEquipped: "desc" }, { level: "desc" }, { id: "asc" }]
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
      where: { playerId: player.id, quantity: { gt: 0 }, item: { type: { in: BUFF_TYPES as unknown as import("@prisma/client").ShopItemType[] } } },
      include: { item: { select: { id: true, name: true, type: true } } }
    }),
  ]);

  // NÃO rodar recalculateMood no carregamento da página — causa race condition
  // com interações do usuário (sobrescreve ganhos de felicidade).
  // recalculateMood é chamado apenas dentro de interactAction (exceto para feed).

  const hasFood    = foods.some(f => f.type === "FOOD"  && f.quantity > 0);
  const hasSweet   = foods.some(f => f.type === "SWEET" && f.quantity > 0);
  const foodCount  = foods.find(f => f.type === "FOOD")?.quantity ?? 0;
  const sweetCount = foods.find(f => f.type === "SWEET")?.quantity ?? 0;

  const mascotData = mascots.map(m => ({
    id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
    level: m.level, exp: m.exp, happiness: m.happiness,
    mood: m.mood, personality: m.personality, isEquipped: m.isEquipped, isFavorite: m.isFavorite,
    statForce: m.statForce, statAgility: m.statAgility, statCharisma: m.statCharisma,
    statInstinct: m.statInstinct, statVitality: m.statVitality,
    battleWins: m.battleWins, battleLosses: m.battleLosses,
    arenaState: m.arenaState,
    bazarListed: m.bazarListed,
    injuredAt: m.injuredAt,
    restingUntil: m.restingUntil,
    hatchedAt: m.hatchedAt,
    lastInteractedAt: m.lastInteractedAt,
    lastFedAt: m.lastFedAt,
    socialCooldownUntil: m.socialCooldownUntil,
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
            <p><strong className="text-slate-300">Brincar</strong> aumenta felicidade e EXP (mais intenso, escala com nível). <strong className="text-slate-300">Carinho</strong> fortalece o vínculo gradualmente (pode ser recusado). <strong className="text-slate-300">Comida</strong> sacia fome. <strong className="text-slate-300">Doces</strong> dão grande bônus de EXP. Cooldown de <strong className="text-slate-300">3 minutos</strong> entre interações.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">🗺 Expedições</p>
            <p>Envie o mascote <strong className="text-slate-300">equipado</strong> em expedições de <strong className="text-slate-300">30min, 1h, 3h ou 6h</strong>. Quanto mais longa, mais EXP e loot melhor (6h pode trazer Ovo Especial). Os itens vão para a Caixa de Presentes.</p>
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

      {/* Chances por ovo */}
      <details className="rounded-2xl border border-border bg-slate-950/50 overflow-hidden group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white select-none">
          <span className="flex items-center gap-2">🥚 Quais Pokémon saem de cada ovo?</span>
          <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-5 py-4 space-y-4 text-xs text-slate-400 leading-relaxed">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
              <p className="font-semibold text-slate-200">🥚 Ovo Comum</p>
              <p>Pool: <strong className="text-slate-300">Todas as 9 gerações</strong> (modo aleatório — Caterpie, Sprigatito, Grookey...). Variedade máxima.</p>
              <p className="text-[10px] text-slate-500">Lendário: 1% · Um Pokémon aleatório de qualquer geração</p>
            </div>
            <div className="space-y-1 rounded-xl border border-blue-700/30 bg-blue-900/10 p-3">
              <p className="font-semibold text-blue-300">💙 Ovo Raro</p>
              <p>Pool: Starters e Pokémon populares de Gen 1–2 (Pikachu, Eevee, Dratini, Riolu, Growlithe...).</p>
              <p className="text-[10px] text-slate-500">Lendário: 1% · Foco em Pokémon cobiçados das gens clássicas</p>
            </div>
            <div className="space-y-1 rounded-xl border border-purple-700/30 bg-purple-900/10 p-3">
              <p className="font-semibold text-purple-300">💜 Ovo Especial</p>
              <p>Pool: Pokémon raros e cobiçados (Magikarp→Gyarados, Lapras, Ditto, Larvitar, Fósseis).</p>
              <p className="text-[10px] text-slate-500">Lendário: 2% — maior chance do jogo!</p>
            </div>
            <div className="space-y-1 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-3">
              <p className="font-semibold text-[#FFCB05]">⭐ Ovo de Evento</p>
              <p>Pool configurado por evento: starters, Pikachu, Eevee, Dratini — temático.</p>
              <p className="text-[10px] text-slate-500">Lendário: 0,3%</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-200">🌍 Ovos por Geração (Gen 1–9)</p>
            <p>Cada ovo de geração tem apenas Pokémon dessa geração. Você escolhe a geração ao colocar na incubadora. Lendários: 1%.</p>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {[
                ["Gen 1 · Kanto","Bulbasaur a Mew"],
                ["Gen 2 · Johto","Chikorita a Celebi"],
                ["Gen 3 · Hoenn","Treecko a Deoxys"],
                ["Gen 4 · Sinnoh","Turtwig a Arceus"],
                ["Gen 5 · Unova","Snivy a Genesect"],
                ["Gen 6 · Kalos","Chespin a Volcanion"],
                ["Gen 7 · Alola","Rowlet a Melmetal"],
                ["Gen 8 · Galar","Grookey a Calyrex"],
                ["Gen 9 · Paldea","Sprigatito a Pecharunt"],
              ].map(([gen, range]) => (
                <div key={gen} className="rounded-lg border border-border/40 bg-slate-900/50 px-2 py-1.5">
                  <p className="font-semibold text-slate-300">{gen}</p>
                  <p className="text-slate-500">{range}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
            <p className="font-semibold text-slate-200">🌀 Geração Aleatória</p>
            <p>Usa o pool de <strong className="text-slate-300">todas as 9 gerações juntas</strong>. Chance 1% de lendário.</p>
          </div>
          <div className="space-y-1 rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-3">
            <p className="font-semibold text-yellow-300">👑 Pokémon Lendários</p>
            <p>Pool incluem Articuno, Lugia, Rayquaza, Dialga, Reshiram, Xerneas, Solgaleo, Zacian, Koraidon e muitos mais. Muito raros — aproveite quando aparecerem!</p>
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
        eggImages={eggImageByType}
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
