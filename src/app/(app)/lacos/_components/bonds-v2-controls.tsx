"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, ChevronLeft, ChevronRight, Clock3, HeartHandshake, ImagePlus, LogOut, MapPin, RefreshCw, Search, Sparkles, Users, X } from "lucide-react";
import { refreshPendingRefugeOptionsV2Action, saveRefugeBackgroundV2Action, setMascotRoutineV2Action, simulateRefugeV2Action, updateActiveBondV2Action } from "../actions";
import { BONDS_V2_BALANCE, REFUGE_LOCATIONS, relationEffectV2, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { getShopItemEmoji } from "@/lib/shop-config";
import type { BondOption } from "@/lib/mascot-bonds";
import { ImageUpload } from "@/components/ui/image-upload";
import { ResolveBondOptionButton } from "./bond-actions";

export function RoutineSelect({ mascotId, value }: { mascotId: string; value: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as RefugeLocation | "NONE";
        startTransition(async () => {
          const result = await setMascotRoutineV2Action(mascotId, next);
          if (result.error) toast.error(result.error);
          else {
            toast.success(next === "NONE" ? "Rotina removida." : "Rotina atualizada.");
            router.refresh();
          }
        });
      }}
      className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-fuchsia-400/50 disabled:opacity-50"
    >
      <option value="NONE">Sem rotina</option>
      <option value="GARDEN">🌱 Horta</option>
      <option value="TRAINING">🥊 Campo de Treino</option>
      <option value="REST">🌙 Descanso</option>
      <option value="YARD">✨ Pátio</option>
    </select>
  );
}

export function SimulateRefugeButton({ location }: { location: RefugeLocation }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await simulateRefugeV2Action(location);
        if (result.error) toast.error(result.error);
        else {
          toast.success(result.importantEventCreated ? "Momento importante criado. Veja a aba de decisões." : (result.message ?? "Momento processado e registrado no diário."));
          router.refresh();
        }
      })}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? "Processando..." : "Simular momento"}
    </button>
  );
}

export function BondV2Buttons({ relationId, active, transitionAt }: { relationId: string; active: boolean; transitionAt: string | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const distancing = active && transitionAt !== null && new Date(transitionAt).getTime() > Date.now();
  function run(operation: "START_DISTANCE" | "CANCEL_DISTANCE" | "RECONNECT") {
    startTransition(async () => {
      const result = await updateActiveBondV2Action(relationId, operation);
      if (result.error) toast.error(result.error);
      else {
        toast.success(operation === "START_DISTANCE" ? "Afastamento iniciado. Ele será concluído em 24 horas se nada reaproximar a dupla." : operation === "CANCEL_DISTANCE" ? "Afastamento cancelado. O vínculo continua presente." : "Reencontro concluído. O vínculo voltou a participar da vida social.");
        router.refresh();
      }
    });
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <button disabled={pending} onClick={() => run(active ? (distancing ? "CANCEL_DISTANCE" : "START_DISTANCE") : "RECONNECT")} className={`rounded-md border px-2 py-1 text-[10px] disabled:opacity-50 ${distancing ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
        {pending ? "Processando..." : active ? distancing ? "Cancelar afastamento" : "Iniciar afastamento" : "Tentar reencontro"}
      </button>
    </div>
  );
}

export type SceneMascot = { id: string; name: string; sprite: string; level: number; personality: string; owner: string; own: boolean; location: string | null; startedAt: string | null; moveAvailableAt: string | null };
export type SceneStory = { id: string; title: string; description: string; conflict: boolean; participants: string; owners: string; scoreDelta: number | null; when: string };
export type RefugeLocationTab = { location: RefugeLocation; occupants: SceneMascot[]; backgroundUrl: string; stories: SceneStory[] };

export function BondsV2SectionTabs({ refuge, moments, social, bonds, pendingCount, bondCount }: { refuge: ReactNode; moments: ReactNode; social: ReactNode; bonds: ReactNode; pendingCount: number; bondCount: number }) {
  const [active, setActive] = useState<"REFUGE" | "MOMENTS" | "SOCIAL" | "BONDS">("REFUGE");
  const tabs = [
    { id: "REFUGE" as const, icon: "🏡", label: "Explore o Refúgio", description: "Regiões e mascotes" },
    { id: "MOMENTS" as const, icon: "✦", label: "Momentos importantes", description: "Decisões aguardando", count: pendingCount },
    { id: "SOCIAL" as const, icon: "◉", label: "Mapa social", description: "Grupos e treinadores" },
    { id: "BONDS" as const, icon: "♥", label: "Laços e efeitos", description: "Relações e histórias", count: bondCount },
  ];
  return <section className="space-y-5">
    <nav className="sticky top-2 z-30 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#060a14]/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
      {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActive(tab.id)} className={`min-w-[190px] flex-1 rounded-xl px-4 py-3 text-left transition ${active === tab.id ? "bg-gradient-to-r from-fuchsia-400 to-violet-400 text-slate-950 shadow-lg shadow-fuchsia-950/40" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className="flex items-center gap-2"><span className="text-base">{tab.icon}</span><span className="text-xs font-black">{tab.label}</span>{typeof tab.count === "number" && <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-black ${active === tab.id ? "bg-slate-950/15" : "bg-white/5"}`}>{tab.count}</span>}</span><span className={`mt-1 block pl-7 text-[9px] ${active === tab.id ? "text-slate-900/65" : "text-slate-600"}`}>{tab.description}</span></button>)}
    </nav>
    <div>{active === "REFUGE" ? refuge : active === "MOMENTS" ? moments : active === "SOCIAL" ? social : bonds}</div>
  </section>;
}

const POSITIONS = [
  "left-[8%] bottom-[12%]", "left-[27%] bottom-[25%]", "left-[48%] bottom-[10%]", "left-[68%] bottom-[28%]",
  "left-[82%] bottom-[12%]", "left-[18%] bottom-[48%]", "left-[58%] bottom-[50%]", "left-[78%] bottom-[52%]",
];

export function RefugeLocationsTabs({ locations, ownMascots }: { locations: RefugeLocationTab[]; ownMascots: SceneMascot[] }) {
  const [active, setActive] = useState<RefugeLocation>(locations[0]?.location ?? "GARDEN");
  const current = locations.find((entry) => entry.location === active) ?? locations[0];
  if (!current) return null;
  return <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
    <div className="flex gap-1 overflow-x-auto border-b border-white/10 bg-slate-950/90 p-2">
      {locations.map((entry) => { const definition = REFUGE_LOCATIONS[entry.location]; const selected = entry.location === current.location; return <button key={entry.location} type="button" onClick={() => setActive(entry.location)} className={`min-w-[170px] flex-1 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-fuchsia-400 text-slate-950 shadow-lg shadow-fuchsia-950/40" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className="flex items-center justify-between gap-2"><span className="text-sm font-black"><span className="mr-2">{definition.icon}</span>{definition.label}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${selected ? "bg-slate-950/15" : "bg-white/5"}`}>{entry.occupants.length}</span></span><span className={`mt-1 block text-[9px] ${selected ? "text-slate-900/70" : "text-slate-600"}`}>{definition.purpose}</span></button>; })}
    </div>
    <div className="p-3 sm:p-4"><RefugeLocationScene key={current.location} {...current} ownMascots={ownMascots} /></div>
  </div>;
}

export function RefugeLocationScene({ location, occupants, ownMascots, backgroundUrl, stories }: { location: RefugeLocation; occupants: SceneMascot[]; ownMascots: SceneMascot[]; backgroundUrl: string; stories: SceneStory[] }) {
  const definition = REFUGE_LOCATIONS[location];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [occupantQuery, setOccupantQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [occupantPage, setOccupantPage] = useState(1);
  const [storyQuery, setStoryQuery] = useState("");
  const [storyKind, setStoryKind] = useState<"ALL" | "SOCIAL" | "CONFLICT">("ALL");
  const [storyPage, setStoryPage] = useState(1);
  const [now, setNow] = useState<number | null>(null);
  const [image, setImage] = useState(backgroundUrl);
  const [pending, startTransition] = useTransition();
  const available = useMemo(() => ownMascots.filter((mascot) => mascot.name.toLowerCase().includes(query.toLowerCase()) || mascot.personality.toLowerCase().includes(query.toLowerCase())), [ownMascots, query]);
  const owners = useMemo(() => [...new Set(occupants.map((mascot) => mascot.owner))].sort((a, b) => a.localeCompare(b, "pt-BR")), [occupants]);
  const filteredOccupants = useMemo(() => occupants.filter((mascot) => {
    const normalizedQuery = occupantQuery.trim().toLocaleLowerCase("pt-BR");
    return (!normalizedQuery || mascot.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery)) && (ownerFilter === "ALL" || mascot.owner === ownerFilter);
  }), [occupants, occupantQuery, ownerFilter]);
  const occupantsPerPage = 8;
  const occupantPages = Math.max(1, Math.ceil(filteredOccupants.length / occupantsPerPage));
  const safeOccupantPage = Math.min(occupantPage, occupantPages);
  const visibleOccupants = filteredOccupants.slice((safeOccupantPage - 1) * occupantsPerPage, safeOccupantPage * occupantsPerPage);
  const filteredStories = useMemo(() => stories.filter((story) => {
    const normalizedQuery = storyQuery.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !normalizedQuery || `${story.participants} ${story.owners} ${story.title} ${story.description}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    const matchesKind = storyKind === "ALL" || (storyKind === "CONFLICT" ? story.conflict : !story.conflict);
    return matchesQuery && matchesKind;
  }), [stories, storyKind, storyQuery]);
  const storiesPerPage = 9;
  const storyPages = Math.max(1, Math.ceil(filteredStories.length / storiesPerPage));
  const safeStoryPage = Math.min(storyPage, storyPages);
  const visibleStories = filteredStories.slice((safeStoryPage - 1) * storiesPerPage, safeStoryPage * storiesPerPage);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function allocate(mascotId: string) {
    startTransition(async () => {
      const result = await setMascotRoutineV2Action(mascotId, location);
      if (result.error) toast.error(result.error); else {
        toast.success(`${definition.label} virou a nova rotina do mascote.`);
        router.refresh();
      }
    });
  }

  function remove(mascotId: string) {
    startTransition(async () => {
      const result = await setMascotRoutineV2Action(mascotId, "NONE");
      if (result.error) toast.error(result.error); else {
        toast.success("Mascote retirado dos espaços públicos.");
        router.refresh();
      }
    });
  }

  function elapsed(iso: string | null) {
    if (!iso || now === null) return "Calculando...";
    const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
    if (minutes < 60) return `${minutes} min nesta área`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}min nesta área`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h nesta área`;
  }

  function cooldownMinutes(iso: string | null) {
    if (!iso || now === null) return 0;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
  }

  return <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/20">
    <div className="relative min-h-[390px] overflow-hidden bg-slate-900">
      {backgroundUrl ? <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${backgroundUrl})` }} /> : <div className={`absolute inset-0 ${location === "GARDEN" ? "bg-[radial-gradient(circle_at_30%_30%,#39734b,#10251c_55%,#07120d)]" : location === "TRAINING" ? "bg-[radial-gradient(circle_at_70%_20%,#81441d,#29180e_55%,#100a08)]" : location === "REST" ? "bg-[radial-gradient(circle_at_50%_20%,#24467a,#121d3c_55%,#080c1c)]" : "bg-[radial-gradient(circle_at_50%_25%,#643a87,#251333_55%,#0e0815)]"}`} />}
      <div className="absolute inset-0 bg-slate-950/45" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-black/65" />
      <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 shadow-xl backdrop-blur-md sm:left-5 sm:top-5"><div className="flex items-center gap-2"><span className="text-3xl drop-shadow-lg">{definition.icon}</span><div><h3 className="text-xl font-black text-white">{definition.label}</h3><p className="text-xs font-medium text-slate-200">{definition.purpose}</p></div></div><p className="mt-2 max-w-2xl text-[10px] leading-4 text-slate-300"><strong className="text-white">Impacto:</strong> {definition.impact}</p></div>
      <div className="absolute right-5 top-5 z-20 hidden rounded-full border border-white/15 bg-slate-950/85 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur sm:block"><Users size={12} className="mr-1 inline" /> {filteredOccupants.length === occupants.length ? occupants.length : `${filteredOccupants.length}/${occupants.length}`} habitando agora</div>
      {visibleOccupants.map((mascot, index) => <div key={mascot.id} className={`group absolute z-10 -translate-x-1/2 ${POSITIONS[index]} transition hover:z-20 hover:scale-110`}><div className={`rounded-2xl border p-1 backdrop-blur-sm ${mascot.own ? "border-cyan-300/60 bg-cyan-950/70 shadow-lg shadow-cyan-400/20" : "border-white/25 bg-slate-950/65"}`}><img src={mascot.sprite} alt={mascot.name} className="h-16 w-16 object-contain drop-shadow-[0_5px_7px_rgba(0,0,0,.8)] sm:h-20 sm:w-20" /></div><div className="pointer-events-none absolute left-1/2 top-full mt-1 hidden min-w-max -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-center group-hover:block"><p className="text-[10px] font-bold text-white">{mascot.name} · Nv.{mascot.level}</p><p className="text-[9px] text-slate-300">{mascot.owner} · {mascot.personality}</p><p className="mt-0.5 text-[9px] font-semibold text-cyan-200">{elapsed(mascot.startedAt)}</p></div></div>)}
      {filteredOccupants.length === 0 && <div className="absolute inset-x-5 bottom-20 rounded-2xl border border-dashed border-white/20 bg-slate-950/80 p-5 text-center text-xs text-slate-300 backdrop-blur-md">{occupants.length === 0 ? "O local está silencioso. Envie um mascote para começar a habitá-lo." : "Nenhum mascote corresponde aos filtros selecionados."}</div>}
      <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between gap-3"><p className="rounded-full bg-black/45 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">Azul: seu mascote · passe o mouse para conhecer os visitantes</p><SimulateRefugeButton location={location} /></div>
    </div>
    <div className="border-t border-white/10 bg-slate-950/80 p-4"><div className="grid gap-2 md:grid-cols-[1fr_220px_auto]"><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-500" /><input value={occupantQuery} onChange={(event) => { setOccupantQuery(event.target.value); setOccupantPage(1); }} placeholder="Filtrar mascote posicionado..." className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-300/40" /></div><select value={ownerFilter} onChange={(event) => { setOwnerFilter(event.target.value); setOccupantPage(1); }} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/40"><option value="ALL">Todos os donos</option>{owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select><div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900 px-2"><button type="button" disabled={safeOccupantPage <= 1} onClick={() => setOccupantPage(safeOccupantPage - 1)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-25"><ChevronLeft size={14} /></button><span className="whitespace-nowrap text-[10px] text-slate-400">Página {safeOccupantPage} de {occupantPages}</span><button type="button" disabled={safeOccupantPage >= occupantPages} onClick={() => setOccupantPage(safeOccupantPage + 1)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-25"><ChevronRight size={14} /></button></div></div></div>
    <div className="grid gap-4 border-t border-white/10 p-4 lg:grid-cols-[1fr_220px]">
      <div><div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-300">Gerenciar seus mascotes</p><p className="mt-1 text-[10px] text-slate-500">Até {BONDS_V2_BALANCE.publicSpaces.maxMascotsPerPlayer} em espaços públicos, {BONDS_V2_BALANCE.publicSpaces.maxMascotsPerPlayerInSameLocation} por área. Trocas têm {BONDS_V2_BALANCE.publicSpaces.moveCooldownMinutes / 60}h de adaptação.</p></div></div><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome ou personalidade..." className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-300/40" /></div><div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">{available.map((mascot) => { const here = mascot.location === location; const elsewhere = mascot.location && !here; const cooldown = cooldownMinutes(mascot.moveAvailableAt); return <div key={mascot.id} className={`flex items-center gap-2 rounded-xl border p-2 ${here ? "border-cyan-300/35 bg-cyan-300/[.08]" : "border-white/10 bg-white/[.025]"}`}><img src={mascot.sprite} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-slate-900 object-contain" /><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-white">{mascot.name}</p><p className={`truncate text-[9px] ${cooldown > 0 && !here ? "text-amber-300" : "text-slate-500"}`}>{here ? elapsed(mascot.startedAt) : cooldown > 0 ? `Adaptação: ${cooldown} min` : elsewhere ? `${REFUGE_LOCATIONS[mascot.location as RefugeLocation]?.label ?? "Outro espaço"}` : "Sem espaço público"}</p></div>{here ? <button type="button" disabled={pending} onClick={() => remove(mascot.id)} title="Retirar deste espaço" className="rounded-lg border border-rose-300/20 p-2 text-rose-300 hover:bg-rose-300/10 disabled:opacity-40"><LogOut size={13} /></button> : <button type="button" disabled={pending || cooldown > 0} onClick={() => allocate(mascot.id)} title={cooldown > 0 ? `Troca disponível em ${cooldown} min` : `Enviar para ${definition.label}`} className="rounded-lg border border-cyan-300/20 p-2 text-cyan-300 hover:bg-cyan-300/10 disabled:opacity-30"><MapPin size={13} /></button>}</div>; })}</div></div>
      <details className="group rounded-xl border border-white/10 bg-white/[.025] p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-bold text-slate-300"><ImagePlus size={14} /> Cenário do local</summary><div className="mt-3"><ImageUpload value={image} onChange={setImage} label="Background personalizado" hint="Recomendado: 1600×900, JPG ou WEBP." compress maxWidth={1800} maxHeight={1000} /><button disabled={pending || image === backgroundUrl} onClick={() => startTransition(async () => { const result = await saveRefugeBackgroundV2Action(location, image); if (result.error) toast.error(result.error); else toast.success("Cenário salvo."); })} className="mt-2 w-full rounded-lg bg-fuchsia-400 px-3 py-2 text-[10px] font-black text-slate-950 disabled:opacity-40">Salvar cenário</button></div></details>
    </div>
    <div className="border-t border-white/10 bg-[#050914] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-300">Diário desta região</p><p className="mt-1 text-xs text-slate-400">Cada área possui seu próprio histórico. Procure pelos mascotes ou filtre o tipo de acontecimento.</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-slate-500">{stories.length} relatos preservados nesta área</span></div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px]"><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-500" /><input value={storyQuery} onChange={(event) => { setStoryQuery(event.target.value); setStoryPage(1); }} placeholder="Buscar mascote, treinador ou acontecimento..." className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-fuchsia-300/40" /></div><select value={storyKind} onChange={(event) => { setStoryKind(event.target.value as typeof storyKind); setStoryPage(1); }} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-fuchsia-300/40"><option value="ALL">Todos os acontecimentos</option><option value="SOCIAL">Momentos sociais</option><option value="CONFLICT">Conflitos</option></select></div>
      {stories.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">Ainda não há histórias registradas neste local.</p> : filteredStories.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">Nenhum relato corresponde à busca e ao filtro selecionados.</p> : <><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{visibleStories.map((story) => <article key={story.id} className={`rounded-xl border p-3 ${story.conflict ? "border-rose-400/30 bg-rose-400/[.08]" : "border-emerald-400/20 bg-emerald-400/[.06]"}`}><div className="flex items-start justify-between gap-2"><p className={`text-[9px] font-black uppercase tracking-wider ${story.conflict ? "text-rose-300" : "text-emerald-300"}`}>{story.conflict ? "⚡ Conflito" : "✦ Momento social"}</p>{story.scoreDelta !== null && <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${story.scoreDelta < 0 ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{story.scoreDelta > 0 ? "+" : ""}{story.scoreDelta} relação</span>}</div><p className="mt-2 text-xs font-black text-white">{story.participants}</p><p className="text-[9px] text-slate-500">{story.owners} · {story.when}</p><p className="mt-2 text-[10px] leading-4 text-slate-300">{story.description}</p></article>)}</div>{storyPages > 1 && <div className="mt-3 flex items-center justify-center gap-3"><button type="button" disabled={safeStoryPage <= 1} onClick={() => setStoryPage(safeStoryPage - 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"><ChevronLeft size={14} /></button><span className="text-[10px] text-slate-500">Relatos {((safeStoryPage - 1) * storiesPerPage) + 1}–{Math.min(filteredStories.length, safeStoryPage * storiesPerPage)} de {filteredStories.length}</span><button type="button" disabled={safeStoryPage >= storyPages} onClick={() => setStoryPage(safeStoryPage + 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"><ChevronRight size={14} /></button></div>}</>}
    </div>
  </article>;
}

export type ImportantMoment = {
  id: string;
  title: string;
  description: string;
  context: string;
  participants: string;
  spriteA: string;
  spriteB: string | null;
  options: BondOption[];
};

export function ImportantMomentsList({ moments }: { moments: ImportantMoment[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const [context, setContext] = useState("ALL");
  const [page, setPage] = useState(1);
  const contexts = [...new Set(moments.map((moment) => moment.context))];
  const filtered = moments.filter((moment) => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return (!q || `${moment.title} ${moment.description} ${moment.participants}`.toLocaleLowerCase("pt-BR").includes(q)) && (context === "ALL" || moment.context === context);
  });
  const perPage = 4;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  return <div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3"><p className="max-w-2xl text-[10px] leading-4 text-slate-400">As opções são montadas pelo local, tipo de acontecimento e mascotes envolvidos. Decisões antigas podem manter o modelo anterior até serem renovadas.</p><button disabled={refreshing} onClick={() => startRefresh(async () => { const result = await refreshPendingRefugeOptionsV2Action(); if (result.error) toast.error(result.error); else { toast.success(result.updated ? `${result.updated} momento(s) receberam novas opções.` : "Todas as decisões já usam opções modulares."); router.refresh(); } })} className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/[.07] px-3 py-2 text-[10px] font-bold text-fuchsia-200 disabled:opacity-40"><RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Renovar decisões antigas</button></div>
    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px]"><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-500" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar mascotes ou situação..." className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-amber-300/40" /></div><select value={context} onChange={(event) => { setContext(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-amber-300/40"><option value="ALL">Todos os locais</option>{contexts.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Nenhum momento corresponde aos filtros.</div> : <div className="grid gap-3 lg:grid-cols-2">{visible.map((moment) => <article key={moment.id} className="rounded-2xl border border-amber-300/15 bg-[linear-gradient(135deg,rgba(245,158,11,.07),rgba(15,23,42,.7))] p-4"><div className="flex items-center gap-3"><div className="flex -space-x-2"><img src={moment.spriteA} alt="" className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain" />{moment.spriteB && <img src={moment.spriteB} alt="" className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain" />}</div><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{moment.context}</p><h3 className="font-bold text-white">{moment.title}</h3><p className="text-[10px] text-slate-500">{moment.participants}</p></div></div><p className="my-3 text-sm leading-6 text-slate-300">{moment.description}</p><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Escolha uma intenção · os resultados são mostrados antes de confirmar</p><div className="grid gap-2">{moment.options.map((option) => <ResolveBondOptionButton key={option.id} eventId={moment.id} option={option} />)}</div></article>)}</div>}
    {pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"><ChevronLeft size={14} /></button><span className="text-[10px] text-slate-500">Decisões {((safePage - 1) * perPage) + 1}–{Math.min(filtered.length, safePage * perPage)} de {filtered.length}</span><button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"><ChevronRight size={14} /></button></div>}
  </div>;
}

const GUIDE_RELATIONS = [
  { score: -80, range: "−100 a −80", name: "Nêmesis", tone: "text-rose-300 border-rose-400/25 bg-rose-400/[.06]" },
  { score: -50, range: "−79 a −50", name: "Inimigo", tone: "text-orange-300 border-orange-400/25 bg-orange-400/[.06]" },
  { score: -15, range: "−49 a −15", name: "Rival", tone: "text-amber-300 border-amber-400/25 bg-amber-400/[.06]" },
  { score: 0, range: "−14 a +14", name: "Conhecido", tone: "text-slate-300 border-white/10 bg-white/[.025]" },
  { score: 15, range: "+15 a +39", name: "Colega", tone: "text-cyan-300 border-cyan-400/20 bg-cyan-400/[.05]" },
  { score: 40, range: "+40 a +79", name: "Amigo", tone: "text-emerald-300 border-emerald-400/25 bg-emerald-400/[.06]" },
  { score: 80, range: "+80 a +100", name: "Super Amigo", tone: "text-fuchsia-300 border-fuchsia-400/25 bg-fuchsia-400/[.06]" },
] as const;

const GUIDE_ITEMS = [
  ["BOND_SHARED_BERRY", "Frutinha da Partilha", "Horta", "+4 de relação principal e +2 recíproca em escolhas de cooperação."],
  ["BOND_CALMING_HERB", "Erva Apaziguadora", "Horta", "Evita até 5 pontos negativos de um conflito e registra uma trégua."],
  ["BOND_REVENGE_TOKEN", "Ficha de Revanche", "Treino", "Cria rivalidade controlada em −4 e evita uma consequência mais severa."],
  ["BOND_TRAINING_RIBBON", "Faixa de Treino em Dupla", "Treino", "+5 de relação e uma memória de parceria de treino."],
  ["BOND_SHARED_PILLOW", "Almofada Compartilhada", "Descanso", "+4 de relação e favorece uma memória de cuidado ou ensino."],
  ["BOND_NIGHT_TEA", "Chá de Boa-Noite", "Descanso", "Remove a tensão anterior e concede +2 nas duas direções."],
  ["BOND_YARD_TOY", "Brinquedo de Pátio", "Pátio", "Favorece evento com 3 ou mais mascotes e formação de grupo."],
  ["BOND_ILLUSTRATED_INVITATION", "Convite Ilustrado", "Pátio", "Escolhe o alvo preferencial do próximo encontro, sem definir seu resultado."],
  ["BOND_MEMORY_ALBUM", "Álbum de Memórias", "Marco", "Protege uma memória marcante sem alterar a pontuação."],
  ["BOND_TRUCE_BELL", "Sino de Trégua", "Marco", "Encerra um conflito limitando a mudança de relação entre −2 e +2."],
  ["BOND_PROMISE_CHARM", "Amuleto de Promessa", "Marco", "Protege um Laço Ativo contra arquivamento automático por 30 dias."],
  ["BOND_CHALLENGE_LETTER", "Carta de Desafio", "Marco", "Cria uma revanche entre mascotes que já sejam Rivais ou piores."],
  ["BOND_TAUNT_WHISTLE", "Apito de Provocação", "Competição", "+35 pontos percentuais à chance de conflito no próximo Treino."],
  ["BOND_CHALLENGE_BOARD", "Quadro de Desafios", "Competição", "Procura um novo oponente compatível e favorece um novo Rival."],
  ["BOND_SECOND_PLACE_MEDAL", "Medalha de Segundo Lugar", "Competição", "Após derrota, aplica −5 do perdedor para o vencedor e registra revanche."],
  ["BOND_SURPASS_ME_BAND", "Faixa “Me Supere”", "Competição", "Aplica −4 nas duas direções e cria rivalidade saudável."],
  ["BOND_CRACKED_TROPHY", "Troféu Rachado", "Competição", "Transforma um Conhecido em Rival (−15), após uma interação prévia."],
  ["BOND_RIVAL_CIRCUIT_PASS", "Passe do Circuito Rival", "Competição", "Abre até 3 desafios separados contra oponentes diferentes."],
] as const;

export function BondsTutorial() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"START" | "RELATIONS" | "LOCATIONS" | "ITEMS">("START");
  const tabs = [["START", "Começando"], ["RELATIONS", "Relações e combate"], ["LOCATIONS", "Espaços públicos"], ["ITEMS", "Itens dos Laços"]] as const;
  return <><button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-300/15"><BookOpen size={15} /> Guia completo do Refúgio</button>{open && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}><div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-fuchsia-300/25 bg-[#080d1c] shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#080d1c]/95 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-fuchsia-300">Guia do Refúgio</p><h2 className="text-xl font-black text-white">A vida social dos seus mascotes</h2><p className="mt-1 text-xs text-slate-400">Rotinas, relações, benefícios e recursos — tudo em um só lugar.</p></div><button onClick={() => setOpen(false)} className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white"><X size={17} /></button></div><nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-slate-950/70 p-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`min-w-max flex-1 rounded-xl px-3 py-2 text-[11px] font-bold transition ${tab === id ? "bg-fuchsia-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{label}</button>)}</nav><div className="overflow-y-auto p-5">
    {tab === "START" && <div className="grid gap-4 md:grid-cols-2">{[
      ["1. Escolha uma rotina", "Você pode manter até 8 mascotes em espaços públicos, no máximo 3 em cada área. Cada mascote possui sua própria recarga de 2 horas para trocar ou sair."],
      ["2. O mundo continua vivo", "A cada ciclo, os habitantes podem criar histórias, relações e itens mesmo que nenhum treinador esteja com a página aberta."],
      ["3. Momentos importantes", "Alguns acontecimentos pedem sua decisão. As opções mostram custos e resultados; se você não responder, o mascote decide sem gastar seus recursos."],
      ["4. Amizade e rivalidade", "Amizades ajudam na mesma equipe e em atividades. Rivalidades aumentam motivação e dano em confrontos específicos. As duas rotas são úteis."],
      ["5. Vínculos presentes", "Até 10 vínculos participam da vida atual do mascote. Ao iniciar um afastamento, a relação ainda leva 24 horas para esfriar e uma nova interação pode reaproximar a dupla."],
      ["6. Distância e reencontro", "Relações distantes preservam pontuação, sentimentos e memórias. Para trazê-las de volta, os dois mascotes precisam conviver por 2 horas no mesmo espaço público."],
    ].map(([title, text]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><h3 className="font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}</div>}
    {tab === "RELATIONS" && <div><div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4 text-xs leading-5 text-slate-300">A pontuação vai de <strong>−100</strong> a <strong>+100</strong>. Os efeitos dependem da dupla exata, somente vínculos presentes contam e bônus iguais não acumulam. Nos replays, uma ligação visual identifica os Laços ativados.</div><div className="grid gap-3 md:grid-cols-2">{GUIDE_RELATIONS.map((relation) => <article key={relation.name} className={`rounded-2xl border p-4 ${relation.tone}`}><div className="flex items-center justify-between gap-3"><h3 className="font-black">{relation.name}</h3><span className="rounded-full bg-black/25 px-2 py-1 text-[10px] font-bold">{relation.range}</span></div><p className="mt-2 text-xs leading-5 text-slate-300">{relationEffectV2(relation.score)}</p></article>)}</div><div className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-400/10 to-rose-400/10 p-4 text-xs leading-5 text-slate-300"><strong className="text-emerald-300">Amizade</strong> não é sempre melhor: ao enfrentar um amigo existe hesitação no primeiro ataque. <strong className="text-rose-300">Rivalidade</strong> não é punição: Rivais cooperam ofensivamente; Inimigos e Nêmesis, porém, criam atrito real quando são colocados na mesma equipe.</div></div>}
    {tab === "LOCATIONS" && <div><div className="grid gap-4 md:grid-cols-2">{Object.entries(REFUGE_LOCATIONS).map(([id, location]) => <article key={id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-center gap-3"><span className="text-3xl">{location.icon}</span><div><h3 className="font-black text-white">{location.label}</h3><p className="text-[10px] uppercase tracking-wider text-fuchsia-300">{location.purpose}</p></div></div><p className="mt-3 text-xs leading-5 text-slate-300">{location.impact}</p></article>)}</div><div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-5 text-slate-400">Os locais são públicos: seus mascotes encontram mascotes de outros treinadores. Personalidade, histórico e área escolhida alteram o tom das histórias. Cada ciclo pode produzir até o limite diário de recursos exclusivos daquela área.</div></div>}
    {tab === "ITEMS" && <div><div className="mb-4 rounded-2xl border border-violet-300/15 bg-violet-300/[.05] p-4 text-xs leading-5 text-slate-300">Itens dos Laços são usados em decisões sociais e podem ser negociados entre jogadores no <strong>Bazar</strong>. Eles não aparecem no Miauvadão nem nas ofertas exclusivas.</div><div className="grid gap-2 md:grid-cols-2">{GUIDE_ITEMS.map(([type, name, source, effect]) => <article key={type} className="flex gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3"><span className="text-2xl">{getShopItemEmoji(type)}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-bold text-white">{name}</h3><span className="rounded-full bg-violet-300/10 px-2 py-0.5 text-[9px] font-bold text-violet-200">{source}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-400">{effect}</p></div></article>)}</div></div>}
  </div></div></div>}</>;
}

type BondItem = { id: string; a: string; b: string; owner: string; spriteA: string; spriteB: string; score: number; tier: string; effect: string; interactions: number; active: boolean; transitionAt: string | null };

export function BondDirectoryV2({ relations }: { relations: BondItem[] }) {
  const [mode, setMode] = useState<"ACTIVE" | "DORMANT">("ACTIVE");
  const [page, setPage] = useState(1);
  const perPage = 6;
  const filtered = relations.filter((relation) => relation.active === (mode === "ACTIVE"));
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);
  return <div><div className="mb-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3"><div className="grid gap-2 sm:grid-cols-3"><InfoPill icon={<Sparkles size={14} />} title="Vínculo presente" text="Participa de histórias e ativa efeitos. Até 10 por mascote." /><InfoPill icon={<Clock3 size={14} />} title="Afastamento com peso" text="Leva 24 horas e uma nova interação pode impedir que a relação esfrie." /><InfoPill icon={<HeartHandshake size={14} />} title="Reencontro" text="Vínculos distantes voltam após 2 horas juntos no mesmo espaço público." /></div><p className="mt-2 rounded-lg bg-cyan-300/[.06] px-3 py-2 text-[10px] leading-4 text-cyan-100/80"><strong>Nenhum vínculo é apagado.</strong> Pontuação, memórias e histórico permanecem. O estado distante representa falta de convivência, não um botão que elimina sentimentos.</p></div><div className="mb-3 flex rounded-xl border border-white/10 bg-slate-950 p-1">{(["ACTIVE", "DORMANT"] as const).map((item) => <button key={item} onClick={() => { setMode(item); setPage(1); }} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mode === item ? "bg-fuchsia-400 text-slate-950" : "text-slate-400"}`}>{item === "ACTIVE" ? `Presentes (${relations.filter((r) => r.active).length})` : `Distantes (${relations.filter((r) => !r.active).length})`}</button>)}</div><div className="space-y-2">{visible.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Nenhum vínculo nesta categoria.</div> : visible.map((relation) => { const distancing = relation.active && relation.transitionAt !== null && new Date(relation.transitionAt).getTime() > Date.now(); return <article key={relation.id} className={`rounded-2xl border p-3 ${relation.score < -14 ? "border-rose-400/20 bg-rose-400/[.035]" : relation.score > 14 ? "border-emerald-400/20 bg-emerald-400/[.035]" : "border-white/10 bg-white/[.025]"}`}><div className="flex gap-3"><div className="flex -space-x-2"><img src={relation.spriteA} alt="" className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 object-contain" /><img src={relation.spriteB} alt="" className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 object-contain" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{relation.a} → {relation.b}</p><p className="text-[10px] text-slate-500">{relation.owner} · {relation.interactions} interações</p>{distancing && <p className="mt-1 text-[9px] font-bold text-amber-300">Afastamento conclui em {new Date(relation.transitionAt!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>}</div><div className="text-right"><p className="font-bold text-white">{relation.tier}</p><p className="text-xs text-slate-500">{relation.score > 0 ? "+" : ""}{relation.score}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${distancing ? "bg-amber-300/10 text-amber-200" : relation.active ? "bg-emerald-300/10 text-emerald-200" : "bg-slate-500/10 text-slate-400"}`}>{distancing ? "Afastando" : relation.active ? "Presente" : "Distante"}</span></div></div><div className="my-2 rounded-lg border border-white/5 bg-black/20 p-2"><p className="text-[9px] font-bold uppercase tracking-wider text-fuchsia-300">Impacto atual</p><p className="mt-1 text-xs leading-5 text-slate-400">{relation.effect}</p></div><BondV2Buttons relationId={relation.id} active={relation.active} transitionAt={relation.transitionAt} /></article>; })}</div>{pages > 1 && <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronLeft size={14} /></button><span>Página {Math.min(page, pages)} de {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronRight size={14} /></button></div>}</div>;
}

function InfoPill({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-2 rounded-xl bg-white/[.035] p-2 text-slate-400"><span className="mt-0.5 text-fuchsia-300">{icon}</span><div><p className="text-[10px] font-bold text-white">{title}</p><p className="text-[9px]">{text}</p></div></div>; }
