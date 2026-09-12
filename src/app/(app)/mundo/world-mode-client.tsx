"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Backpack,
  Clock3,
  FlaskConical,
  Footprints,
  LockKeyhole,
  Map as MapIcon,
  MapPin,
  Mountain,
  Navigation,
  RotateCcw,
  Shield,
  Sparkles,
  Store,
  Trees,
} from "lucide-react";
import { toast } from "sonner";
import type { WorldEncounterConfig, WorldLocationConfig } from "@/world-data/types";
import {
  finishWorldTravelNowAction,
  resetAdminWorldAction,
  startWorldAdventureAction,
  startWorldTravelAction,
} from "./actions";

type Location = Omit<WorldLocationConfig, "encounters"> & {
  encounters: Array<WorldEncounterConfig & { name: string }>;
};
type State = {
  currentLocationId: string;
  discoveredLocationIds: string[];
  badges: string[];
  fatigue: number;
  inventory: { pokeBalls?: number; potions?: number; antidotes?: number };
  travelingToId: string | null;
  travelStartedAt: string | null;
  travelEndsAt: string | null;
} | null;

const TYPE_STYLE: Record<string, { icon: typeof MapPin; color: string }> = {
  TOWN: { icon: MapPin, color: "#fbbf24" },
  CITY: { icon: MapPin, color: "#67e8f9" },
  ROUTE: { icon: Footprints, color: "#a3e635" },
  FOREST: { icon: Trees, color: "#34d399" },
  CAVE: { icon: Mountain, color: "#c4b5fd" },
};
const SERVICE_LABEL: Record<string, string> = {
  CENTER: "Pokémon Center",
  MART: "Poké Mart",
  GYM: "Ginásio",
  LAB: "Laboratório",
  STORAGE: "Armazenamento",
};
const ACTIVITY_LABEL: Record<string, string> = {
  EXPLORE: "Explorar",
  CAPTURE: "Procurar mascotes",
  TRAINER_BATTLE: "Enfrentar treinadores",
  ITEM_SEARCH: "Buscar itens",
  DELIVERY: "Entregas",
};
const RARITY_LABEL: Record<string, string> = {
  COMMON: "Comum",
  UNCOMMON: "Incomum",
  RARE: "Raro",
  VERY_RARE: "Muito raro",
  SPECIAL: "Especial",
};

function remainingLabel(endsAt: string | null, now: number) {
  if (!endsAt) return "";
  const seconds = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function WorldModeClient({ locations, initialState }: { locations: Location[]; initialState: State }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(initialState?.currentLocationId ?? "pallet-town");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!initialState?.travelEndsAt) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (new Date(initialState.travelEndsAt!).getTime() <= Date.now()) router.refresh();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [initialState?.travelEndsAt, router]);
  const byId = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const selected = byId.get(selectedId) ?? locations[0];
  const current = initialState ? byId.get(initialState.currentLocationId) : null;
  const reachable = new Set(current?.connections.map((connection) => connection.to) ?? []);
  const act = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "Ação recusada.");
      else toast.success(success);
      router.refresh();
    });

  if (!initialState) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.22),transparent_36%),radial-gradient(circle_at_80%_30%,rgba(34,211,238,.16),transparent_32%),#06111b] px-6 py-16 text-center shadow-2xl">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative">
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-amber-200">Protótipo exclusivo do admin</span>
            <h1 className="mt-5 text-4xl font-black text-white sm:text-6xl">Sua jornada começa em Kanto.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">O World Mode transforma cada cidade e rota em uma unidade de gameplay. Esta primeira construção cobre o caminho de Pallet até Pewter.</p>
            <button disabled={pending} onClick={() => act(startWorldAdventureAction, "Aventura iniciada em Pallet Town.")} className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-7 py-4 text-sm font-black text-slate-950 shadow-[0_0_35px_rgba(52,211,153,.25)] disabled:opacity-50">Registrar aventura</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 px-3 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-emerald-300/15 bg-gradient-to-r from-[#071522] to-[#111026] p-5">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-300">World Mode · Kanto · protótipo administrativo</span>
          <h1 className="mt-1 text-3xl font-black text-white">Do laboratório à primeira insígnia</h1>
          <p className="mt-1 text-xs text-slate-400">Fundação navegável do mapa. Exploração, capturas, serviços e Brock serão conectados nas próximas etapas.</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300"><Shield className="mr-1 inline h-3.5 w-3.5 text-amber-300" /> {initialState.badges.length} insígnias</span>
          <span className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300"><Footprints className="mr-1 inline h-3.5 w-3.5 text-emerald-300" /> {initialState.fatigue} fadiga</span>
        </div>
      </header>

      {initialState.travelingToId && (
        <section className="rounded-3xl border border-cyan-300/25 bg-[linear-gradient(120deg,rgba(6,182,212,.14),rgba(15,23,42,.92))] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300"><Navigation className="h-6 w-6 animate-pulse" /></span>
              <div><p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Em viagem</p><h2 className="text-xl font-black text-white">Rumo a {byId.get(initialState.travelingToId)?.name}</h2></div>
            </div>
            <div className="flex items-center gap-3"><b className="font-pixel text-2xl text-amber-300">{remainingLabel(initialState.travelEndsAt, now)}</b><button disabled={pending} onClick={() => act(finishWorldTravelNowAction, "Viagem concluída pelo debug.")} className="rounded-xl border border-fuchsia-300/30 bg-fuchsia-300/10 px-4 py-2 text-xs font-black text-fuchsia-200">Debug · chegar agora</button></div>
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.75fr)]">
        <section className="relative min-h-[620px] overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_25%_70%,rgba(16,185,129,.16),transparent_30%),radial-gradient(circle_at_70%_20%,rgba(56,189,248,.13),transparent_35%),#050c16]">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(103,232,249,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,.1)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="absolute left-5 top-5 z-20"><p className="text-[9px] font-black uppercase tracking-[.25em] text-cyan-300">Mapa regional</p><h2 className="text-2xl font-black text-white">Sul de Kanto</h2></div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {locations.flatMap((location) => location.connections.filter((connection) => location.id < connection.to).map((connection) => {
              const target = byId.get(connection.to)!;
              const active = initialState.discoveredLocationIds.includes(location.id) && (initialState.discoveredLocationIds.includes(target.id) || reachable.has(target.id));
              return <line key={`${location.id}-${target.id}`} x1={location.map.x} y1={location.map.y} x2={target.map.x} y2={target.map.y} stroke={active ? "#67e8f9" : "#334155"} strokeWidth={active ? 0.7 : 0.4} strokeDasharray={active ? "0" : "2 2"} vectorEffect="non-scaling-stroke" />;
            }))}
          </svg>
          {locations.map((location) => {
            const discovered = initialState.discoveredLocationIds.includes(location.id);
            const available = reachable.has(location.id);
            const here = current?.id === location.id;
            const style = TYPE_STYLE[location.type] ?? TYPE_STYLE.TOWN;
            const Icon = style.icon;
            return <button key={location.id} onClick={() => setSelectedId(location.id)} style={{ left: `${location.map.x}%`, top: `${location.map.y}%`, color: style.color }} className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center transition ${discovered || available ? "opacity-100" : "opacity-40"}`}>
              <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border bg-slate-950/90 shadow-xl transition group-hover:scale-110 ${here ? "ring-4 ring-amber-300/25" : ""}`} style={{ borderColor: here ? "#fbbf24" : style.color }}><Icon className="h-5 w-5" />{here && <i className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-300" />}</span>
              <b className="mt-1 block whitespace-nowrap text-[10px] text-white">{discovered || available ? location.shortName : "???"}</b>
            </button>;
          })}
          <div className="absolute bottom-5 left-5 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[9px] text-slate-400"><MapIcon className="mr-1 inline h-3 w-3" /> Clique em um ponto para inspecionar. Viaje apenas por conexões adjacentes.</div>
        </section>

        <aside className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80">
          <div className={`relative min-h-44 p-5 ${selected.type === "FOREST" ? "bg-[radial-gradient(circle_at_top,rgba(16,185,129,.35),transparent_65%)]" : selected.type === "CITY" ? "bg-[radial-gradient(circle_at_top,rgba(34,211,238,.28),transparent_65%)]" : "bg-[radial-gradient(circle_at_top,rgba(163,230,53,.22),transparent_65%)]"}`}>
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300">{selected.biome} · perigo {selected.danger}</span>
            <h2 className="mt-1 text-3xl font-black text-white">{selected.name}</h2>
            <p className="mt-3 text-xs leading-5 text-slate-300">{selected.description}</p>
            {current?.id === selected.id && <span className="mt-3 inline-flex rounded-full bg-amber-300/15 px-3 py-1 text-[9px] font-black uppercase text-amber-200">Você está aqui</span>}
          </div>
          <div className="space-y-5 p-5">
            <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Serviços</p><div className="mt-2 flex flex-wrap gap-2">{selected.services.length ? selected.services.map((service) => <span key={service} className="rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-2 py-1 text-[10px] text-cyan-100"><Store className="mr-1 inline h-3 w-3" />{SERVICE_LABEL[service]}</span>) : <span className="text-xs text-slate-600">Nenhum serviço nesta rota.</span>}</div></div>
            <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">O que poderá acontecer aqui</p><div className="mt-2 grid grid-cols-2 gap-2">{selected.activities.map((activity) => <span key={activity} className="rounded-xl bg-white/[.035] px-3 py-2 text-[10px] text-slate-300"><Sparkles className="mr-1 inline h-3 w-3 text-fuchsia-300" />{ACTIVITY_LABEL[activity]}</span>)}</div></div>
            {selected.encounters.length > 0 && <details className="rounded-xl border border-white/10 bg-white/[.02] p-3"><summary className="cursor-pointer text-[10px] font-black text-emerald-300">Prévia da tabela de encontros</summary><div className="mt-3 grid grid-cols-2 gap-2">{selected.encounters.map((encounter) => <span key={`${encounter.speciesId}-${encounter.timeOfDay}`} className="rounded-lg bg-slate-950 px-2 py-1.5 text-[9px] text-slate-300"><b className="block text-white">{encounter.name}</b>{RARITY_LABEL[encounter.rarity]} · peso {encounter.weight}</span>)}</div></details>}
            {reachable.has(selected.id) && !initialState.travelingToId && <button disabled={pending} onClick={() => act(() => startWorldTravelAction(selected.id), `Viagem iniciada para ${selected.name}.`)} className="w-full rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-50"><Navigation className="mr-2 inline h-4 w-4" />Viajar para {selected.shortName}<ArrowRight className="ml-2 inline h-4 w-4" /></button>}
            {!reachable.has(selected.id) && current?.id !== selected.id && <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-[10px] text-slate-500"><LockKeyhole className="mr-1 inline h-3 w-3" /> Chegue primeiro a uma localização conectada.</p>}
          </div>
        </aside>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[.03] p-4">
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-300"><span><Backpack className="mr-1 inline h-3.5 w-3.5 text-amber-300" />{initialState.inventory.pokeBalls ?? 0} Poké Balls</span><span><FlaskConical className="mr-1 inline h-3.5 w-3.5 text-emerald-300" />{initialState.inventory.potions ?? 0} Potions</span><span><Clock3 className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />Chegada resolvida sob demanda, sem cron contínuo</span></div>
        <button disabled={pending} onClick={() => { if (window.confirm("Apagar todo o seu progresso de teste no World Mode?")) act(resetAdminWorldAction, "Teste do World Mode reiniciado."); }} className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-200"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Resetar protótipo</button>
      </section>
    </main>
  );
}
