"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Backpack,
  ChevronDown,
  Clock3,
  FlaskConical,
  Footprints,
  HeartPulse,
  LockKeyhole,
  Map as MapIcon,
  MapPin,
  Mountain,
  Navigation,
  RotateCcw,
  Search,
  Shield,
  ShoppingBasket,
  Sparkles,
  Store,
  Swords,
  Trees,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import type { WorldEncounterConfig, WorldLocationConfig } from "@/world-data/types";
import type { WorldMartItem } from "@/world-data/types";
import {
  buyWorldMartItemAction,
  challengeWorldTrainerAction,
  finishWorldTravelNowAction,
  exploreWorldLocationAction,
  getWorldPartyMascotsAction,
  resetAdminWorldAction,
  restAtWorldCenterAction,
  resolveWorldEncounterAction,
  saveWorldPartyAction,
  startWorldAdventureAction,
  startWorldTravelAction,
  useWorldItemAction,
} from "./actions";
import { COMBAT_ROLE_OPTIONS, getCombatRoleLabel } from "@/lib/combat-roles";

type WorldMascot = {
  id: string;
  speciesId: number;
  name: string;
  nickname: string | null;
  sprite: string;
  level: number;
  personality: string;
  posture: string;
  stats: {
    force: number;
    agility: number;
    charisma: number;
    instinct: number;
    vitality: number;
  };
};
type PartyEntry = { mascotId: string; posture: string };
type PartyMascot = {
  id: string;
  name: string;
  sprite: string;
  level: number;
  posture: string;
  hp: number;
  maxHp: number;
  poisoned: boolean;
};

type Location = Omit<WorldLocationConfig, "encounters"> & {
  encounters: Array<WorldEncounterConfig & { name: string }>;
};
type State = {
  currentLocationId: string;
  discoveredLocationIds: string[];
  badges: string[];
  defeatedTrainerIds: string[];
  fatigue: number;
  inventory: { pokeBalls?: number; potions?: number; antidotes?: number };
  travelingToId: string | null;
  travelStartedAt: string | null;
  travelEndsAt: string | null;
  party: PartyEntry[];
} | null;
type Encounter = {
  id: string;
  pokemonId: number;
  rarity: string;
  captureChance: number;
  status: "ACTIVE" | "CAPTURED" | "ESCAPED" | "FAILED";
  roll: number | null;
  name: string;
  spriteUrl?: string;
  createdAt: string;
  resolvedAt?: string | null;
};
type Trainer = {
  id: string;
  locationId: string;
  name: string;
  title: string;
  intro: string;
  portraitUrl?: string;
  badgeId?: string;
  prerequisiteId?: string;
  firstWinReward: { pokeBalls?: number; potions?: number; antidotes?: number; zikaCoins?: number };
  team: Array<{ pokemonId: number; level: number; role: string; name: string; spriteUrl: string }>;
};
type Battle = {
  id: string;
  trainerId: string;
  trainerName: string;
  winner: string;
  rounds: number;
  reward: unknown;
  result: unknown;
  createdAt: string;
};

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

export function WorldModeClient({ locations, initialState, encounters, martItems, zikaCoins, trainers, battles, partyMascots }: { locations: Location[]; initialState: State; encounters: { active: Encounter | null; history: Encounter[] }; martItems: WorldMartItem[]; zikaCoins: number; trainers: Trainer[]; battles: Battle[]; partyMascots: PartyMascot[] }) {
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
  const localTrainers = trainers.filter((trainer) => trainer.locationId === current?.id);
  const needsHeal = partyMascots.some((m) => m.hp < m.maxHp || m.poisoned);
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
          <div className={`relative min-h-44 overflow-hidden p-5 ${selected.type === "FOREST" ? "bg-[radial-gradient(circle_at_top,rgba(16,185,129,.35),transparent_65%)]" : selected.type === "CITY" ? "bg-[radial-gradient(circle_at_top,rgba(34,211,238,.28),transparent_65%)]" : "bg-[radial-gradient(circle_at_top,rgba(163,230,53,.22),transparent_65%)]"}`}>
            {selected.imageUrl && <><div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${selected.imageUrl})` }} /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/15" /></>}
            <div className="relative">
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300">{selected.biome} · perigo {selected.danger}</span>
            <h2 className="mt-1 text-3xl font-black text-white">{selected.name}</h2>
            <p className="mt-3 text-xs leading-5 text-slate-300">{selected.description}</p>
            {current?.id === selected.id && <span className="mt-3 inline-flex rounded-full bg-amber-300/15 px-3 py-1 text-[9px] font-black uppercase text-amber-200">Você está aqui</span>}
            </div>
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

      {current?.activities.includes("EXPLORE") && !initialState.travelingToId && (
        <section className="overflow-hidden rounded-[2rem] border border-emerald-300/15 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,.13),transparent_35%),#060d17]">
          {encounters.active ? (
            <div className="grid items-center gap-5 p-5 md:grid-cols-[220px_1fr] md:p-7">
              <div className="relative flex min-h-52 items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle,rgba(103,232,249,.2),transparent_60%)]">
                <div className="absolute inset-x-8 bottom-8 h-8 rounded-[50%] bg-cyan-300/10 blur-md" />
                {/* O sprite existente mantém o protótipo funcional; será substituído por arte de encontro quando houver asset. */}
                <img src={encounters.active.spriteUrl} alt={encounters.active.name} className="relative h-36 w-36 object-contain [image-rendering:pixelated]" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-300">Encontro selvagem · {RARITY_LABEL[encounters.active.rarity]}</span>
                <h2 className="mt-1 text-3xl font-black text-white">Um {encounters.active.name} apareceu!</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">O encontro fica salvo até você decidir. Uma tentativa consome 1 Poké Ball; fugir não consome itens.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button disabled={pending || (initialState.inventory.pokeBalls ?? 0) < 1} onClick={() => act(() => resolveWorldEncounterAction(encounters.active!.id, "CAPTURE"), "Tentativa de captura resolvida." )} className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-300 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-40">Usar Poké Ball · {encounters.active.captureChance}%</button>
                  <button disabled={pending} onClick={() => act(() => resolveWorldEncounterAction(encounters.active!.id, "ESCAPE"), "Você deixou o mascote seguir seu caminho." )} className="rounded-xl border border-white/10 bg-white/[.04] px-5 py-3 text-xs font-black text-slate-200">Fugir</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-7">
              <div><span className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-300">Exploração local</span><h2 className="mt-1 text-2xl font-black text-white">Procure sinais em {current.shortName}</h2><p className="mt-1 text-xs text-slate-400">Horário e pesos da tabela determinam o encontro no servidor.</p></div>
              <button disabled={pending} onClick={() => act(exploreWorldLocationAction, "Você encontrou movimento por perto.")} className="rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-6 py-3 text-xs font-black text-slate-950 disabled:opacity-40"><Search className="mr-2 inline h-4 w-4" />Explorar área</button>
            </div>
          )}
          {encounters.history.length > 0 && <div className="border-t border-white/5 px-5 py-4 md:px-7"><p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Últimos encontros</p><div className="flex flex-wrap gap-2">{encounters.history.map((entry) => <span key={entry.id} className={`rounded-lg border px-2.5 py-1.5 text-[9px] ${entry.status === "CAPTURED" ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200" : "border-white/10 bg-white/[.025] text-slate-400"}`}><b>{entry.name}</b> · {entry.status === "CAPTURED" ? "Capturado" : entry.status === "ESCAPED" ? "Liberado" : "Escapou da Poké Ball"}{entry.roll ? ` · rolagem ${entry.roll}/${entry.captureChance}` : ""}</span>)}</div></div>}
        </section>
      )}

      {!initialState.travelingToId && current && (current.services.includes("CENTER") || current.services.includes("MART")) && (
        <section className="grid gap-5 lg:grid-cols-2">
          {current.services.includes("CENTER") && (
            <div className="rounded-[2rem] border border-rose-300/15 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,.14),transparent_48%),#080d18] p-6">
              <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-300/10 text-rose-300"><HeartPulse className="h-6 w-6" /></span><div><span className="text-[9px] font-black uppercase tracking-[.2em] text-rose-300">Pokémon Center</span><h2 className="text-2xl font-black text-white">Recupere-se antes da rota</h2><p className="mt-2 text-xs leading-5 text-slate-400">O descanso remove toda a fadiga acumulada e restaura o HP e as condições de toda a sua equipe da aventura.</p></div></div>
              <button disabled={pending || (initialState.fatigue === 0 && !needsHeal)} onClick={() => act(restAtWorldCenterAction, "Descanso concluído. Equipe recuperada.")} className="mt-5 w-full rounded-xl bg-gradient-to-r from-rose-300 to-pink-300 px-5 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-35">{initialState.fatigue > 0 || needsHeal ? `Descansar · remover fadiga e curar equipe` : "Equipe e fadiga já estão em ordem"}</button>
            </div>
          )}
          {current.services.includes("MART") && (
            <div className="rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.12),transparent_48%),#080d18] p-6">
              <div className="flex items-center justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">Poké Mart</span><h2 className="text-2xl font-black text-white">Suprimentos de viagem</h2></div><span className="rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs font-black text-amber-200">{zikaCoins.toLocaleString("pt-BR")} ZC</span></div>
              <div className="mt-4 space-y-2">{martItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3"><div><b className="text-xs text-white">{item.name}</b><p className="mt-0.5 text-[9px] text-slate-500">{item.description}</p></div><button disabled={pending || zikaCoins < item.price} onClick={() => act(() => buyWorldMartItemAction(item.id, 1), `${item.name} adicionado à mochila.`)} className="shrink-0 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] font-black text-amber-200 disabled:opacity-35"><ShoppingBasket className="mr-1 inline h-3.5 w-3.5" />{item.price} ZC</button></div>)}</div>
              <p className="mt-3 text-[9px] text-slate-600">Preços provisórios do protótipo, centralizados na configuração de Kanto.</p>
            </div>
          )}
        </section>
      )}

      {!initialState.travelingToId && localTrainers.length > 0 && (
        <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-300/15 bg-[#070b16] p-5 md:p-7">
          {current?.imageUrl && <><div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${current.imageUrl})` }} /><div className="absolute inset-0 bg-gradient-to-r from-[#070b16] via-[#070b16]/90 to-[#070b16]/70" /></>}
          <div className="relative">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[.22em] text-fuchsia-300">Treinadores da região</span><h2 className="mt-1 text-2xl font-black text-white">A trilha também testa sua equipe</h2><p className="mt-1 text-xs text-slate-400">O motor oficial resolve Agilidade, tipos, posturas, cura, buffs, debuffs e personalidades.</p></div><span className="rounded-full bg-white/[.04] px-3 py-1.5 text-[9px] font-bold text-slate-400">Equipe: {initialState.party.length > 0 ? `${initialState.party.length}/6 na formação` : "sem formação (usa equipados)"}</span></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">{localTrainers.map((trainer) => {
            const defeated = initialState.defeatedTrainerIds.includes(trainer.id);
            const locked = Boolean(trainer.prerequisiteId && !initialState.defeatedTrainerIds.includes(trainer.prerequisiteId));
            return <article key={trainer.id} className={`relative overflow-hidden rounded-2xl border p-4 pt-40 ${defeated ? "border-emerald-300/20 bg-emerald-950/80" : locked ? "border-white/5 bg-slate-950/85 opacity-55" : "border-fuchsia-300/20 bg-slate-950/85"}`}>
              {trainer.portraitUrl ? <img src={trainer.portraitUrl} alt={trainer.name} className="pointer-events-none absolute -right-2 top-0 h-48 w-40 object-contain object-top" /> : <div className="pointer-events-none absolute inset-x-0 top-0 flex h-40 items-center justify-center bg-[radial-gradient(circle,rgba(217,70,239,.16),transparent_65%)]"><span className="font-pixel text-5xl text-white/10">VS</span></div>}
              <div className="absolute inset-x-0 top-24 h-20 bg-gradient-to-t from-slate-950 to-transparent" />
              <div className="relative flex items-start justify-between gap-2"><div><span className="text-[8px] font-black uppercase tracking-widest text-fuchsia-300">{trainer.title}</span><h3 className="text-lg font-black text-white">{trainer.name}</h3>{trainer.badgeId && <span className="mt-1 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[8px] font-black uppercase text-amber-200">Vale a Boulder Badge</span>}</div>{defeated && <Trophy className="h-5 w-5 text-emerald-300" />}</div>
              <p className="mt-2 min-h-10 text-[10px] leading-4 text-slate-400">“{trainer.intro}”</p>
              <div className="mt-3 flex gap-2">{trainer.team.map((mascot, index) => <div key={`${trainer.id}-${index}`} className="min-w-0 flex-1 rounded-xl bg-slate-950/70 p-2 text-center"><img src={mascot.spriteUrl} alt={mascot.name} className="mx-auto h-10 w-10 object-contain [image-rendering:pixelated]" /><b className="block truncate text-[9px] text-white">{mascot.name}</b><span className="text-[8px] text-slate-500">Nv.{mascot.level}</span></div>)}</div>
              <button disabled={pending || locked || Boolean(encounters.active)} onClick={() => act(() => challengeWorldTrainerAction(trainer.id), `Batalha contra ${trainer.name} concluída.`)} className="mt-4 w-full rounded-xl bg-gradient-to-r from-fuchsia-300 to-violet-300 px-4 py-2.5 text-[10px] font-black text-slate-950 disabled:opacity-30"><Swords className="mr-1.5 inline h-3.5 w-3.5" />{locked ? "Derrote o treinador anterior" : defeated ? "Revanche sem nova recompensa" : "Desafiar treinador"}</button>
            </article>;
          })}</div>
          </div>
        </section>
      )}

      {battles.length > 0 && (
        <section className="rounded-[2rem] border border-cyan-300/15 bg-[#060c16] p-5 md:p-7">
          <span className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">Registro de batalhas</span><h2 className="mt-1 text-2xl font-black text-white">Consequências recentes</h2>
          <div className="mt-4 space-y-2">{battles.map((battle, battleIndex) => {
            const result = battle.result as { teamADamageDealt?: number; teamBDamageDealt?: number; teamASurvivors?: number; teamBSurvivors?: number; log?: Array<{ turn: number; actorName: string; targetName: string; action: string; damage: number; effect?: string }> };
            return <details key={battle.id} open={battleIndex === 0} className="group rounded-xl border border-white/8 bg-white/[.025] p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><b className={battle.winner === "A" ? "text-emerald-300" : battle.winner === "DRAW" ? "text-amber-300" : "text-rose-300"}>{battle.winner === "A" ? "Vitória" : battle.winner === "DRAW" ? "Empate" : "Derrota"}</b><span className="ml-2 text-xs text-white">contra {battle.trainerName}</span><p className="text-[9px] text-slate-500">{battle.rounds} rodadas · dano {result.teamADamageDealt ?? 0} × {result.teamBDamageDealt ?? 0} · sobreviventes {result.teamASurvivors ?? 0} × {result.teamBSurvivors ?? 0}</p></div><ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" /></summary><div className="mt-3 max-h-64 space-y-1 overflow-y-auto border-t border-white/5 pt-3">{result.log?.slice(-18).map((entry, index) => <p key={`${entry.turn}-${index}`} className="rounded-lg bg-slate-950/60 px-3 py-2 text-[9px] leading-4 text-slate-400"><b className="text-slate-200">T{entry.turn} · {entry.actorName}</b>{entry.action === "HEAL" ? ` curou ${entry.targetName} em ${entry.damage} HP.` : ` atingiu ${entry.targetName} por ${entry.damage}.`} {entry.effect}</p>)}</div></details>;
          })}</div>
        </section>
      )}

      <WorldPartyPanel
        initialParty={initialState.party}
        partyMascots={partyMascots}
        potions={initialState.inventory.potions ?? 0}
        antidotes={initialState.inventory.antidotes ?? 0}
        onSaved={() => router.refresh()}
      />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[.03] p-4">
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-300"><span><Backpack className="mr-1 inline h-3.5 w-3.5 text-amber-300" />{initialState.inventory.pokeBalls ?? 0} Poké Balls</span><span><FlaskConical className="mr-1 inline h-3.5 w-3.5 text-emerald-300" />{initialState.inventory.potions ?? 0} Potions</span><span><Clock3 className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />Chegada resolvida sob demanda, sem cron contínuo</span></div>
        <button disabled={pending} onClick={() => { if (window.confirm("Apagar todo o seu progresso de teste no World Mode?")) act(resetAdminWorldAction, "Teste do World Mode reiniciado."); }} className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-200"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Resetar protótipo</button>
      </section>
    </main>
  );
}

// Formação persistente do World Mode: até 6 mascotes do próprio jogador, com
// postura editável. Não altera a coleção principal (isEquipped intacto).
function WorldPartyPanel({
  initialParty,
  partyMascots,
  potions,
  antidotes,
  onSaved,
}: {
  initialParty: PartyEntry[];
  partyMascots: PartyMascot[];
  potions: number;
  antidotes: number;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const useItem = (kind: "POTION" | "ANTIDOTE", mascotId: string) =>
    start(async () => {
      const result = await useWorldItemAction(kind, mascotId);
      if (!result.ok) toast.error(result.error ?? "Falha ao usar item.");
      else {
        toast.success(kind === "POTION" ? "Potion usada." : "Antídoto aplicado.");
        router.refresh();
      }
    });
  const [open, setOpen] = useState(false);
  const [mascots, setMascots] = useState<WorldMascot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [party, setParty] = useState<PartyEntry[]>(initialParty);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 18;
  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    getWorldPartyMascotsAction()
      .then((rows) => setMascots(rows as WorldMascot[]))
      .catch(() => setMascots([]))
      .finally(() => {
        setLoaded(true);
        setLoading(false);
      });
  }, [open, loaded]);
  const byId = useMemo(() => new Map(mascots.map((m) => [m.id, m])), [mascots]);
  const filtered = mascots.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.nickname ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice(
    (Math.min(page, pages) - 1) * perPage,
    Math.min(page, pages) * perPage,
  );
  const inParty = (id: string) => party.some((e) => e.mascotId === id);
  const toggle = (m: WorldMascot) =>
    setParty((cur) =>
      cur.some((e) => e.mascotId === m.id)
        ? cur.filter((e) => e.mascotId !== m.id)
        : cur.length < 6
          ? [...cur, { mascotId: m.id, posture: m.posture }]
          : cur,
    );
  const setPosture = (id: string, posture: string) =>
    setParty((cur) =>
      cur.map((e) => (e.mascotId === id ? { ...e, posture } : e)),
    );
  const save = () =>
    start(async () => {
      const result = await saveWorldPartyAction(party);
      if (!result.ok) toast.error(result.error ?? "Falha ao salvar.");
      else {
        toast.success(`Equipe salva (${result.size}/6).`);
        onSaved();
      }
    });
  return (
    <section className="rounded-[2rem] border border-emerald-300/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.1),transparent_45%),#070d17] p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-300">
            Formação da aventura
          </span>
          <h2 className="mt-1 text-2xl font-black text-white">
            Sua equipe do World Mode
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Até 6 mascotes do seu acervo com postura escolhida. Não altera a
            equipe da Arena ou de outros modos.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-200"
        >
          {open ? "Fechar editor" : party.length ? "Editar equipe" : "Montar equipe"}
        </button>
      </div>

      {/* Equipe atual com HP persistente e itens de recuperação */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {partyMascots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-slate-500 sm:col-span-2 lg:col-span-3">
            Nenhuma equipe montada. Enquanto não houver, as batalhas usam seus
            mascotes equipados como fallback.
          </p>
        ) : (
          partyMascots.map((m) => {
            const pct = Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100));
            const fainted = m.hp <= 0;
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-2.5 ${fainted ? "border-rose-400/40 bg-rose-950/30" : "border-emerald-300/20 bg-emerald-300/[.05]"}`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={m.sprite}
                    alt=""
                    className={`h-10 w-10 shrink-0 object-contain [image-rendering:pixelated] ${fainted ? "opacity-40 grayscale" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[11px] text-white">{m.name}</b>
                    <span className="flex flex-wrap gap-1 text-[8px]">
                      <span className="text-emerald-200">{getCombatRoleLabel(m.posture)}</span>
                      <span className="text-slate-500">Nv.{m.level}</span>
                      {m.poisoned && <span className="text-fuchsia-300">Envenenado</span>}
                      {fainted && <span className="font-black text-rose-300">Desmaiado</span>}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct > 50 ? "#6ee7b7" : pct > 20 ? "#fcd34d" : "#fb7185",
                      }}
                    />
                  </span>
                  <small className="w-14 shrink-0 text-right text-[9px] tabular-nums text-slate-400">
                    {Math.max(0, m.hp)}/{m.maxHp}
                  </small>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    disabled={pending || potions < 1 || m.hp >= m.maxHp}
                    onClick={() => useItem("POTION", m.id)}
                    className="flex-1 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2 py-1.5 text-[9px] font-black text-emerald-200 disabled:opacity-35"
                  >
                    Potion (+{60}) · {potions}
                  </button>
                  <button
                    disabled={pending || antidotes < 1 || !m.poisoned}
                    onClick={() => useItem("ANTIDOTE", m.id)}
                    className="flex-1 rounded-lg border border-fuchsia-300/25 bg-fuchsia-300/10 px-2 py-1.5 text-[9px] font-black text-fuchsia-200 disabled:opacity-35"
                  >
                    Antídoto · {antidotes}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {open && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          {/* Selecionados com postura */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                Selecionados ({party.length}/6)
              </p>
              <button
                disabled={pending || party.length === 0}
                onClick={save}
                className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[11px] font-black text-slate-950 disabled:opacity-40"
              >
                Salvar equipe
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {party.length === 0 && (
                <p className="py-3 text-center text-[10px] text-slate-600">
                  Escolha mascotes ao lado.
                </p>
              )}
              {party.map((entry) => {
                const m = byId.get(entry.mascotId);
                return (
                  <div
                    key={entry.mascotId}
                    className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[.05] p-1.5"
                  >
                    {m && (
                      <img
                        src={m.sprite}
                        alt=""
                        className="h-8 w-8 shrink-0 object-contain [image-rendering:pixelated]"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">
                      {m ? m.nickname?.trim() || m.name : entry.mascotId.slice(0, 6)}
                    </span>
                    <select
                      value={entry.posture}
                      onChange={(e) => setPosture(entry.mascotId, e.target.value)}
                      className="max-w-[100px] rounded border border-emerald-300/30 bg-slate-900 px-1 py-1 text-[9px] font-bold text-emerald-200"
                    >
                      {COMBAT_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="text-white">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {m && (
                      <button
                        onClick={() => toggle(m)}
                        className="shrink-0 rounded p-1 text-rose-300 hover:bg-rose-400/10"
                        title="Remover"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Catálogo de mascotes */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar mascote por nome ou apelido…"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none"
            />
            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Carregando seus mascotes…
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {visible.map((m) => {
                    const picked = inParty(m.id);
                    const full = party.length >= 6 && !picked;
                    return (
                      <button
                        key={m.id}
                        disabled={full}
                        onClick={() => toggle(m)}
                        className={`rounded-xl border p-2 text-left transition disabled:opacity-40 ${picked ? "border-emerald-400 bg-emerald-400/10" : "border-slate-800 bg-slate-950 hover:border-slate-600"}`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={m.sprite}
                            alt=""
                            className="h-10 w-10 shrink-0 object-contain [image-rendering:pixelated]"
                          />
                          <div className="min-w-0">
                            <b className="block truncate text-[11px] text-white">
                              {m.nickname?.trim() || m.name}
                            </b>
                            <span className="block truncate text-[9px] text-slate-500">
                              Nv.{m.level} · {getCombatRoleLabel(m.posture)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {mascots.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Você ainda não tem mascotes.
                  </p>
                )}
                {pages > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded border border-slate-700 px-3 py-1 disabled:opacity-30"
                    >
                      Anterior
                    </button>
                    <span className="text-slate-500">
                      {Math.min(page, pages)}/{pages}
                    </span>
                    <button
                      disabled={page >= pages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-slate-700 px-3 py-1 disabled:opacity-30"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
