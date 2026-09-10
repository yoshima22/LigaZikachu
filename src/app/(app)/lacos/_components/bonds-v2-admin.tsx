import { Activity, Archive, Brain, HeartHandshake, Home, LockKeyhole, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { REFUGE_LOCATIONS, relationEffectV2, relationTierV2, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { normalizeBondOptions } from "@/lib/mascot-bonds";
import { BondV2Buttons, RoutineSelect, SimulateRefugeButton } from "./bonds-v2-controls";
import { ResolveBondOptionButton } from "./bond-actions";

function mascotName(mascot: { pokemonId: number; nickname: string | null }) {
  return mascot.nickname ?? getPokemonName(mascot.pokemonId);
}

export async function BondsV2Admin({ playerId }: { playerId: string }) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const [mascots, relations, memories, pendingEvents, recentEvents] = await Promise.all([
    prisma.mascot.findMany({
      where: { playerId },
      orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
      take: 30,
      select: { id: true, pokemonId: true, nickname: true, level: true, personality: true, happiness: true, mood: true, routine: { select: { locationType: true, status: true, accumulatedUnits: true } } },
    }),
    prisma.mascotRelation.findMany({
      where: { mascotA: { playerId } }, orderBy: [{ isActive: "desc" }, { isProtected: "desc" }, { updatedAt: "desc" }], take: 30,
      select: { id: true, relationshipScore: true, isActive: true, isProtected: true, interactionCount: true, updatedAt: true, mascotA: { select: { pokemonId: true, nickname: true } }, mascotB: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } } },
    }),
    prisma.mascotBondMemory.findMany({
      where: { mascotA: { playerId } }, orderBy: { createdAt: "desc" }, take: 20,
      include: { mascotA: { select: { pokemonId: true, nickname: true } }, mascotB: { select: { pokemonId: true, nickname: true } } },
    }),
    prisma.mascotSocialEvent.findMany({
      where: { ownerId: playerId, status: "PENDING" }, orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }], take: 8,
      include: { mascotA: { select: { pokemonId: true, nickname: true } }, mascotB: { select: { pokemonId: true, nickname: true } } },
    }),
    prisma.mascotSocialEvent.count({ where: { ownerId: playerId, createdAt: { gte: since } } }),
  ]);

  const changedRelations = relations.filter((relation) => relation.updatedAt >= since).length;
  const activeCount = relations.filter((relation) => relation.isActive).length;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.24),transparent_40%),linear-gradient(135deg,#070d1d,#120826)] p-6 shadow-2xl shadow-fuchsia-950/20">
        <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-amber-200"><LockKeyhole size={12} /> Prévia exclusiva do admin</div>
        <p className="text-xs font-black uppercase tracking-[.25em] text-fuchsia-300">Laços 2.0 · vida social dos mascotes</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-black text-white">O Refúgio está começando a ganhar vida.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Teste rotinas, relações direcionais, memórias e a separação entre amizade e rivalidade. Nenhum jogador comum vê esta versão e os novos bônus ainda não interferem nos combates ou na economia.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[{ label: "Acontecimentos", value: recentEvents, icon: Activity }, { label: "Relações mudaram", value: changedRelations, icon: HeartHandshake }, { label: "Laços ativos", value: activeCount, icon: Sparkles }, { label: "Decisões aguardando", value: pendingEvents.length, icon: Brain }].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3"><Icon size={15} className="text-fuchsia-300" /><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p></div>
          ))}
        </div>
      </header>

      <section>
        <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Controle sem obrigação diária</p><h2 className="text-xl font-black text-white">Momentos importantes</h2><p className="mt-1 text-xs text-slate-500">Se você não responder, a preferência social atual resolve o acontecimento sem gastar recursos.</p></div>
        {pendingEvents.length === 0 ? <Empty text="Nenhuma decisão importante aguarda resposta." /> : <div className="grid gap-3 lg:grid-cols-2">{pendingEvents.map((event) => <article key={event.id} className="rounded-2xl border border-amber-300/15 bg-[linear-gradient(135deg,rgba(245,158,11,.07),rgba(15,23,42,.7))] p-4"><div className="flex items-center gap-3"><div className="flex -space-x-2"><img src={getSpriteUrl(event.mascotA.pokemonId)} alt="" className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain" />{event.mascotB && <img src={getSpriteUrl(event.mascotB.pokemonId)} alt="" className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain" />}</div><div><p className="text-[10px] uppercase tracking-wider text-amber-300">{event.sourceType} · {event.isImportant ? "momento decisivo" : "decisão social"}</p><h3 className="font-bold text-white">{event.title}</h3></div></div><p className="my-3 text-sm leading-6 text-slate-300">{event.description}</p><div className="grid gap-2">{normalizeBondOptions(event.optionsJson).map((option) => <ResolveBondOptionButton key={option.id} eventId={event.id} option={option} />)}</div></article>)}</div>}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300">Rotinas persistentes</p><h2 className="text-xl font-black text-white">Refúgio</h2></div><p className="max-w-lg text-right text-xs text-slate-500">O mascote retorna à rotina quando estiver livre. Nesta prévia, a simulação gera memória e evolução social, sem entregar recompensas reais.</p></div>
        <div className="grid gap-3 lg:grid-cols-4">
          {(Object.entries(REFUGE_LOCATIONS) as Array<[RefugeLocation, (typeof REFUGE_LOCATIONS)[RefugeLocation]]>).map(([key, location]) => {
            const occupants = mascots.filter((mascot) => mascot.routine?.locationType === key);
            return <article key={key} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-start justify-between"><span className="text-2xl">{location.icon}</span><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-400">{occupants.length}/{location.capacity}</span></div>
              <h3 className="mt-2 font-bold text-white">{location.label}</h3><p className="mt-1 min-h-8 text-xs text-slate-500">{location.purpose}</p>
              <div className="my-3 flex min-h-10 items-center -space-x-2">{occupants.map((mascot) => <img key={mascot.id} src={getSpriteUrl(mascot.pokemonId)} alt={mascotName(mascot)} title={mascotName(mascot)} className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 object-contain" />)}{occupants.length === 0 && <span className="text-[11px] text-slate-600">Nenhum mascote alocado</span>}</div>
              <SimulateRefugeButton location={key} />
            </article>;
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="mb-4 flex items-center gap-2"><Home size={17} className="text-cyan-300" /><div><h2 className="font-bold text-white">Moradores e rotinas</h2><p className="text-xs text-slate-500">Amostra dos 30 mascotes prioritários da conta administrativa.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{mascots.map((mascot) => <div key={mascot.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[.025] p-2.5"><img src={getSpriteUrl(mascot.pokemonId)} alt={mascotName(mascot)} className="h-11 w-11 object-contain" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{mascotName(mascot)} <span className="font-normal text-slate-500">Nv.{mascot.level}</span></p><p className="mb-1.5 text-[10px] text-slate-500">{mascot.personality} · felicidade {mascot.happiness}</p><RoutineSelect mascotId={mascot.id} value={mascot.routine?.locationType ?? "NONE"} /></div></div>)}</div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-white">Laços ativos e adormecidos</h2><span className="text-xs text-slate-500">máximo sugerido: 10 por mascote</span></div><div className="space-y-2">{relations.length === 0 ? <Empty text="Ainda não existem relações nesta conta." /> : relations.map((relation) => { const score = relation.relationshipScore; return <article key={relation.id} className={`rounded-2xl border p-3 ${relation.isActive ? "border-fuchsia-400/20 bg-fuchsia-400/[.04]" : "border-white/5 bg-slate-950/50 opacity-70"}`}><div className="flex gap-3"><div className="flex -space-x-2"><img src={getSpriteUrl(relation.mascotA.pokemonId)} alt="" className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 object-contain" /><img src={getSpriteUrl(relation.mascotB.pokemonId)} alt="" className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 object-contain" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-white">{mascotName(relation.mascotA)} → {mascotName(relation.mascotB)}</p><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase text-slate-400">{relation.isActive ? "Ativo" : "Adormecido"}</span></div><p className="text-[11px] text-slate-500">{relation.mascotB.player.displayName} · {relation.interactionCount} interações</p></div><div className="text-right"><p className={score < -14 ? "font-bold text-rose-300" : score > 14 ? "font-bold text-emerald-300" : "font-bold text-slate-300"}>{relationTierV2(score)}</p><p className="text-xs text-slate-500">{score > 0 ? "+" : ""}{score}</p></div></div><p className="my-2 text-xs leading-5 text-slate-400">{relationEffectV2(score)}</p><BondV2Buttons relationId={relation.id} active={relation.isActive} protectedBond={relation.isProtected} /></article>; })}</div></div>
        <div><div className="mb-3 flex items-center gap-2"><Archive size={16} className="text-amber-300" /><h2 className="font-bold text-white">Diário social</h2></div><div className="relative space-y-3 border-l border-fuchsia-400/20 pl-4">{memories.length === 0 ? <Empty text="Simule um momento no Refúgio para iniciar o diário." /> : memories.map((memory) => <article key={memory.id} className="relative rounded-xl border border-white/10 bg-slate-950/70 p-3 before:absolute before:-left-[21px] before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-fuchsia-400"><p className="text-[10px] uppercase tracking-wider text-fuchsia-300">{memory.sourceType} · intensidade {memory.intensity}</p><h3 className="mt-1 text-sm font-bold text-white">{memory.title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{memory.description}</p><p className="mt-2 text-[10px] text-slate-600">{memory.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></article>)}</div></div>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{text}</div>; }
