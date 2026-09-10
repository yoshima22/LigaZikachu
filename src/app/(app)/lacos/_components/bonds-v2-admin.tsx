import { Activity, Archive, Brain, HeartHandshake, LockKeyhole, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { REFUGE_LOCATIONS, relationEffectV2, relationTierV2, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { normalizeBondOptions } from "@/lib/mascot-bonds";
import { BondDirectoryV2, BondsTutorial, RefugeLocationScene } from "./bonds-v2-controls";
import { ResolveBondOptionButton } from "./bond-actions";

function mascotName(mascot: { pokemonId: number; nickname: string | null }) {
  return mascot.nickname ?? getPokemonName(mascot.pokemonId);
}

export async function BondsV2Admin({ playerId }: { playerId: string }) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const [mascots, publicRoutines, relations, memories, pendingEvents, recentEvents, settings] = await Promise.all([
    prisma.mascot.findMany({
      where: { playerId },
      orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
      take: 60,
      select: {
        id: true, pokemonId: true, nickname: true, level: true, personality: true,
        routine: { select: { locationType: true } },
      },
    }),
    prisma.mascotRoutine.findMany({
      where: { status: "ACTIVE" },
      orderBy: { lastProcessedAt: "desc" },
      take: 80,
      select: {
        locationType: true,
        mascot: { select: { id: true, pokemonId: true, nickname: true, level: true, personality: true, playerId: true, player: { select: { displayName: true } } } },
      },
    }),
    prisma.mascotRelation.findMany({
      where: { mascotA: { playerId } },
      orderBy: [{ isActive: "desc" }, { isProtected: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        id: true, relationshipScore: true, isActive: true, isProtected: true, interactionCount: true, updatedAt: true,
        mascotA: { select: { pokemonId: true, nickname: true } },
        mascotB: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
      },
    }),
    prisma.mascotBondMemory.findMany({
      where: { OR: [{ mascotA: { playerId } }, { mascotB: { playerId } }] },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: { mascotA: { select: { pokemonId: true, nickname: true } }, mascotB: { select: { pokemonId: true, nickname: true } } },
    }),
    prisma.mascotSocialEvent.findMany({
      where: { ownerId: playerId, status: "PENDING" },
      orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { mascotA: { select: { pokemonId: true, nickname: true } }, mascotB: { select: { pokemonId: true, nickname: true } } },
    }),
    prisma.mascotSocialEvent.count({ where: { ownerId: playerId, createdAt: { gte: since } } }),
    prisma.siteContent.findUnique({ where: { id: "bonds-v2-settings" }, select: { data: true } }),
  ]);

  const rawSettings = settings?.data && typeof settings.data === "object" && !Array.isArray(settings.data)
    ? settings.data as Record<string, unknown>
    : {};
  const backgrounds = rawSettings.backgrounds && typeof rawSettings.backgrounds === "object" && !Array.isArray(rawSettings.backgrounds)
    ? rawSettings.backgrounds as Record<string, unknown>
    : {};
  const changedRelations = relations.filter((relation) => relation.updatedAt >= since).length;
  const activeCount = relations.filter((relation) => relation.isActive).length;
  const ownMascots = mascots.map((mascot) => ({
    id: mascot.id,
    name: mascotName(mascot),
    sprite: getSpriteUrl(mascot.pokemonId),
    level: mascot.level,
    personality: mascot.personality,
    owner: "Você",
    own: true,
    location: mascot.routine?.locationType ?? null,
  }));
  const bondItems = relations.map((relation) => ({
    id: relation.id,
    a: mascotName(relation.mascotA),
    b: mascotName(relation.mascotB),
    owner: relation.mascotB.player.displayName,
    spriteA: getSpriteUrl(relation.mascotA.pokemonId),
    spriteB: getSpriteUrl(relation.mascotB.pokemonId),
    score: relation.relationshipScore,
    tier: relationTierV2(relation.relationshipScore),
    effect: relationEffectV2(relation.relationshipScore),
    interactions: relation.interactionCount,
    active: relation.isActive,
    protectedBond: relation.isProtected,
  }));

  return <div className="space-y-8">
    <header className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.24),transparent_40%),linear-gradient(135deg,#070d1d,#120826)] p-6 shadow-2xl shadow-fuchsia-950/20">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-amber-200"><LockKeyhole size={12} className="mr-1 inline" /> Prévia exclusiva do admin</div>
        <BondsTutorial />
      </div>
      <p className="text-xs font-black uppercase tracking-[.25em] text-fuchsia-300">Laços 2.0 · vida social dos mascotes</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-black text-white">Veja onde eles vivem. Entenda por que se importam.</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">O Refúgio é público: mascotes de treinadores diferentes dividem lugares, criam histórias e transformam convivência em amizade, rivalidade e memórias.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Acontecimentos", value: recentEvents, icon: Activity },
          { label: "Relações mudaram", value: changedRelations, icon: HeartHandshake },
          { label: "Laços ativos", value: activeCount, icon: Sparkles },
          { label: "Decisões aguardando", value: pendingEvents.length, icon: Brain },
        ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3"><Icon size={15} className="text-fuchsia-300" /><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p></div>)}
      </div>
    </header>

    <section>
      <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300">Espaços públicos e persistentes</p><h2 className="text-2xl font-black text-white">Explore o Refúgio</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Cada local favorece acontecimentos diferentes. Procure um mascote, envie-o para uma rotina e observe quem está dividindo o espaço com ele.</p></div>
      <div className="grid gap-6 2xl:grid-cols-2">
        {(Object.keys(REFUGE_LOCATIONS) as RefugeLocation[]).map((location) => {
          const occupants = publicRoutines.filter((routine) => routine.locationType === location).map((routine) => ({
            id: routine.mascot.id,
            name: mascotName(routine.mascot),
            sprite: getSpriteUrl(routine.mascot.pokemonId),
            level: routine.mascot.level,
            personality: routine.mascot.personality,
            owner: routine.mascot.playerId === playerId ? "Você" : routine.mascot.player.displayName,
            own: routine.mascot.playerId === playerId,
            location,
          }));
          return <RefugeLocationScene key={location} location={location} occupants={occupants} ownMascots={ownMascots} backgroundUrl={typeof backgrounds[location] === "string" ? backgrounds[location] : ""} />;
        })}
      </div>
    </section>

    <section>
      <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Escolhas que mudam histórias</p><h2 className="text-xl font-black text-white">Momentos importantes</h2><p className="mt-1 text-xs text-slate-500">Acontecimentos comuns entram no diário. Somente decisões de impacto pedem sua intervenção.</p></div>
      {pendingEvents.length === 0 ? <Empty text="Nenhuma decisão importante aguarda resposta." /> : <div className="grid gap-3 lg:grid-cols-2">{pendingEvents.map((event) => <article key={event.id} className="rounded-2xl border border-amber-300/15 bg-[linear-gradient(135deg,rgba(245,158,11,.07),rgba(15,23,42,.7))] p-4"><div className="flex items-center gap-3"><div className="flex -space-x-2"><img src={getSpriteUrl(event.mascotA.pokemonId)} alt="" className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain" />{event.mascotB && <img src={getSpriteUrl(event.mascotB.pokemonId)} alt="" className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain" />}</div><div><p className="text-[10px] uppercase tracking-wider text-amber-300">{event.sourceType} · {event.isImportant ? "momento decisivo" : "decisão social"}</p><h3 className="font-bold text-white">{event.title}</h3></div></div><p className="my-3 text-sm leading-6 text-slate-300">{event.description}</p><div className="grid gap-2">{normalizeBondOptions(event.optionsJson).map((option) => <ResolveBondOptionButton key={option.id} eventId={event.id} option={option} />)}</div></article>)}</div>}
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <div><div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-fuchsia-300">Rede social dos mascotes</p><h2 className="text-xl font-black text-white">Laços e efeitos</h2><p className="mt-1 text-xs text-slate-500">Relações são direcionais: o que um mascote sente pode não ser correspondido.</p></div><BondDirectoryV2 relations={bondItems} /></div>
      <div><div className="mb-3 flex items-center gap-2"><Archive size={16} className="text-amber-300" /><div><h2 className="font-bold text-white">Histórias do Refúgio</h2><p className="text-xs text-slate-500">O diário explica por que cada relação mudou.</p></div></div><div className="relative space-y-3 border-l border-fuchsia-400/20 pl-4">{memories.length === 0 ? <Empty text="Simule um momento no Refúgio para iniciar o diário." /> : memories.map((memory) => <article key={memory.id} className="relative rounded-xl border border-white/10 bg-slate-950/70 p-3 before:absolute before:-left-[21px] before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-fuchsia-400"><p className="text-[10px] uppercase tracking-wider text-fuchsia-300">{memory.sourceType} · intensidade {memory.intensity}</p><h3 className="mt-1 text-sm font-bold text-white">{memory.title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{memory.description}</p><div className="mt-2 rounded-lg bg-white/[.025] px-2 py-1.5 text-[10px] text-slate-500">{mascotName(memory.mascotA)}{memory.mascotB ? ` com ${mascotName(memory.mascotB)}` : ""} · {memory.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div></article>)}</div></div>
    </section>
  </div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{text}</div>;
}
