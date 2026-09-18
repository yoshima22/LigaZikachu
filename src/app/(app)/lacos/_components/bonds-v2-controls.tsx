"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HeartHandshake,
  LogOut,
  MapPin,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  claimRefugeRewardV2Action,
  contestBondDistanceV2Action,
  setMascotRoutineV2Action,
  setRefugeInfluenceV2Action,
  updateActiveBondV2Action,
  useBondDistanceItemV2Action,
} from "../actions";
import {
  BONDS_V2_BALANCE,
  REFUGE_LOCATIONS,
  relationEffectV2,
  type RefugeLocation,
} from "@/lib/mascot-bonds-v2";
import { getShopItemEmoji } from "@/lib/shop-config";
import type { BondOption } from "@/lib/mascot-bonds";
import { ResolveBondOptionButton } from "./bond-actions";

export function RoutineSelect({
  mascotId,
  value,
}: {
  mascotId: string;
  value: string;
}) {
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
            toast.success(
              next === "NONE" ? "Rotina removida." : "Rotina atualizada.",
            );
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

export function BondV2Buttons({
  relationId,
  active,
  transitionAt,
  startedByMe,
  charmResolvesAt,
  shielded,
}: {
  relationId: string;
  active: boolean;
  transitionAt: string | null;
  startedByMe: boolean;
  charmResolvesAt: string | null;
  shielded: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const distancing =
    active &&
    transitionAt !== null &&
    new Date(transitionAt).getTime() > Date.now();
  function run(operation: "START_DISTANCE" | "CANCEL_DISTANCE") {
    startTransition(async () => {
      const result = await updateActiveBondV2Action(relationId, operation);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          operation === "START_DISTANCE"
            ? "Afastamento iniciado. Em 24 horas, a relação será encerrada por completo."
            : "Afastamento cancelado. O vínculo continua existindo.",
        );
        router.refresh();
      }
    });
  }
  function dispute(action: "CONTEST" | "CHARM" | "SHIELD") {
    startTransition(async () => {
      const result =
        action === "CONTEST"
          ? await contestBondDistanceV2Action(relationId)
          : await useBondDistanceItemV2Action(relationId, action);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          action === "CONTEST"
            ? "won" in result && result.won
              ? "A contestação cancelou o afastamento."
              : "A contestação falhou; o prazo continua."
            : action === "CHARM"
              ? "Amuleto ativo: o prazo está pausado por 6 horas."
              : "Escudo ativo: o Amuleto foi removido e o prazo voltou a correr.",
        );
        router.refresh();
      }
    });
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {!distancing && (
        <button
          disabled={pending || !active}
          onClick={() => run("START_DISTANCE")}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          {pending ? "Processando..." : "Iniciar afastamento"}
        </button>
      )}
      {distancing && startedByMe && !charmResolvesAt && (
        <button
          disabled={pending}
          onClick={() => run("CANCEL_DISTANCE")}
          className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-50"
        >
          Cancelar meu afastamento
        </button>
      )}
      {distancing && !startedByMe && !charmResolvesAt && (
        <>
          <button
            disabled={pending}
            onClick={() => dispute("CONTEST")}
            className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-50"
          >
            Contestar afastamento · 50%
          </button>
          <button
            disabled={pending || shielded}
            onClick={() => dispute("CHARM")}
            className="rounded-md border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-1.5 text-xs text-fuchsia-200 disabled:opacity-50"
          >
            Usar Amuleto de Promessa
          </button>
        </>
      )}
      {distancing && startedByMe && charmResolvesAt && (
        <button
          disabled={pending}
          onClick={() => dispute("SHIELD")}
          className="rounded-md border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-50"
        >
          Usar Escudo do Desapego
        </button>
      )}
      {distancing && charmResolvesAt && (
        <span className="rounded-md border border-fuchsia-300/20 px-3 py-1.5 text-xs text-fuchsia-200">
          Amuleto resolve em{" "}
          {new Date(charmResolvesAt).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}

export type SceneMascot = {
  id: string;
  name: string;
  sprite: string;
  level: number;
  personality: string;
  performanceTag: string;
  owner: string;
  ownerId: string;
  own: boolean;
  location: string | null;
  startedAt: string | null;
  moveAvailableAt: string | null;
  nextActionAt: string | null;
  pendingReward: boolean;
};
export type SceneStory = {
  id: string;
  title: string;
  description: string;
  conflict: boolean;
  participants: string;
  owners: string;
  scoreDelta: number | null;
  when: string;
};
export type RefugeLocationTab = {
  location: RefugeLocation;
  occupants: SceneMascot[];
  backgroundUrl: string;
  stories: SceneStory[];
};

export function BondsV2SectionTabs({
  refuge,
  moments,
  social,
  bonds,
  inventory,
  pendingCount,
  bondCount,
  itemCount,
}: {
  refuge: ReactNode;
  moments: ReactNode;
  social: ReactNode;
  bonds: ReactNode;
  inventory: ReactNode;
  pendingCount: number;
  bondCount: number;
  itemCount: number;
}) {
  const [active, setActive] = useState<
    "REFUGE" | "MOMENTS" | "SOCIAL" | "BONDS" | "ITEMS"
  >("REFUGE");
  const tabs = [
    {
      id: "REFUGE" as const,
      icon: "🏡",
      label: "Explore o Refúgio",
      description: "Regiões e mascotes",
    },
    {
      id: "MOMENTS" as const,
      icon: "✦",
      label: "Momentos importantes",
      description: "Decisões aguardando",
      count: pendingCount,
    },
    {
      id: "SOCIAL" as const,
      icon: "◉",
      label: "Mapa social",
      description: "Grupos e treinadores",
    },
    {
      id: "BONDS" as const,
      icon: "♥",
      label: "Laços e efeitos",
      description: "Relações e histórias",
      count: bondCount,
    },
    {
      id: "ITEMS" as const,
      icon: "🎒",
      label: "Itens dos Laços",
      description: "Bolsa e negociação",
      count: itemCount,
    },
  ];
  return (
    <section className="space-y-5 font-sans">
      <nav className="sticky top-2 z-30 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#060a14]/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`min-w-[175px] flex-1 rounded-xl px-4 py-3 text-left transition ${active === tab.id ? "bg-gradient-to-r from-fuchsia-400 to-violet-400 text-slate-950 shadow-lg shadow-fuchsia-950/40" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{tab.icon}</span>
              <span className="text-sm font-semibold leading-5">
                {tab.label}
              </span>
              {typeof tab.count === "number" && (
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${active === tab.id ? "bg-slate-950/15" : "bg-white/5"}`}
                >
                  {tab.count}
                </span>
              )}
            </span>
            <span
              className={`mt-1 block pl-7 text-xs leading-4 ${active === tab.id ? "text-slate-900/70" : "text-slate-500"}`}
            >
              {tab.description}
            </span>
          </button>
        ))}
      </nav>
      <div>
        {active === "REFUGE"
          ? refuge
          : active === "MOMENTS"
            ? moments
            : active === "SOCIAL"
              ? social
              : active === "BONDS"
                ? bonds
                : inventory}
      </div>
    </section>
  );
}

const POSITIONS = [
  "left-[8%] bottom-[12%]",
  "left-[27%] bottom-[25%]",
  "left-[48%] bottom-[10%]",
  "left-[68%] bottom-[28%]",
  "left-[82%] bottom-[12%]",
  "left-[18%] bottom-[48%]",
  "left-[58%] bottom-[50%]",
  "left-[78%] bottom-[52%]",
];

export function RefugeLocationsTabs({
  locations,
  ownMascots,
}: {
  locations: RefugeLocationTab[];
  ownMascots: SceneMascot[];
}) {
  const [active, setActive] = useState<RefugeLocation>(
    locations[0]?.location ?? "GARDEN",
  );
  const current =
    locations.find((entry) => entry.location === active) ?? locations[0];
  if (!current) return null;
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 bg-slate-950/90 p-2">
        {locations.map((entry) => {
          const definition = REFUGE_LOCATIONS[entry.location];
          const selected = entry.location === current.location;
          return (
            <button
              key={entry.location}
              type="button"
              onClick={() => setActive(entry.location)}
              className={`min-w-[180px] flex-1 rounded-xl px-4 py-3 text-left font-sans transition ${selected ? "bg-fuchsia-400 text-slate-950 shadow-lg shadow-fuchsia-950/40" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  <span className="mr-2">{definition.icon}</span>
                  {definition.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? "bg-slate-950/15" : "bg-white/5"}`}
                >
                  {entry.occupants.length}
                </span>
              </span>
              <span
                className={`mt-1 block text-xs leading-4 ${selected ? "text-slate-900/70" : "text-slate-500"}`}
              >
                {definition.purpose}
              </span>
            </button>
          );
        })}
      </div>
      <div className="p-3 sm:p-4">
        <RefugeLocationScene
          key={current.location}
          {...current}
          ownMascots={ownMascots}
        />
      </div>
    </div>
  );
}

export function RefugeLocationScene({
  location,
  occupants,
  ownMascots,
  backgroundUrl,
  stories,
}: {
  location: RefugeLocation;
  occupants: SceneMascot[];
  ownMascots: SceneMascot[];
  backgroundUrl: string;
  stories: SceneStory[];
}) {
  const definition = REFUGE_LOCATIONS[location];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [occupantQuery, setOccupantQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [occupantPage, setOccupantPage] = useState(1);
  const [storyQuery, setStoryQuery] = useState("");
  const [storyKind, setStoryKind] = useState<"ALL" | "SOCIAL" | "CONFLICT">(
    "ALL",
  );
  const [storyPage, setStoryPage] = useState(1);
  const [now, setNow] = useState<number | null>(null);
  const [selectedOccupant, setSelectedOccupant] = useState<SceneMascot | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const available = useMemo(
    () =>
      ownMascots.filter(
        (mascot) =>
          mascot.name.toLowerCase().includes(query.toLowerCase()) ||
          mascot.personality.toLowerCase().includes(query.toLowerCase()),
      ),
    [ownMascots, query],
  );
  const owners = useMemo(
    () =>
      [...new Set(occupants.map((mascot) => mascot.owner))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [occupants],
  );
  const filteredOccupants = useMemo(
    () =>
      occupants.filter((mascot) => {
        const normalizedQuery = occupantQuery.trim().toLocaleLowerCase("pt-BR");
        return (
          (!normalizedQuery ||
            mascot.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery)) &&
          (ownerFilter === "ALL" || mascot.owner === ownerFilter)
        );
      }),
    [occupants, occupantQuery, ownerFilter],
  );
  const occupantsPerPage = 8;
  const occupantPages = Math.max(
    1,
    Math.ceil(filteredOccupants.length / occupantsPerPage),
  );
  const safeOccupantPage = Math.min(occupantPage, occupantPages);
  const visibleOccupants = filteredOccupants.slice(
    (safeOccupantPage - 1) * occupantsPerPage,
    safeOccupantPage * occupantsPerPage,
  );
  const filteredStories = useMemo(
    () =>
      stories.filter((story) => {
        const normalizedQuery = storyQuery.trim().toLocaleLowerCase("pt-BR");
        const matchesQuery =
          !normalizedQuery ||
          `${story.participants} ${story.owners} ${story.title} ${story.description}`
            .toLocaleLowerCase("pt-BR")
            .includes(normalizedQuery);
        const matchesKind =
          storyKind === "ALL" ||
          (storyKind === "CONFLICT" ? story.conflict : !story.conflict);
        return matchesQuery && matchesKind;
      }),
    [stories, storyKind, storyQuery],
  );
  const storiesPerPage = 9;
  const storyPages = Math.max(
    1,
    Math.ceil(filteredStories.length / storiesPerPage),
  );
  const safeStoryPage = Math.min(storyPage, storyPages);
  const visibleStories = filteredStories.slice(
    (safeStoryPage - 1) * storiesPerPage,
    safeStoryPage * storiesPerPage,
  );

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function allocate(mascotId: string) {
    startTransition(async () => {
      const result = await setMascotRoutineV2Action(mascotId, location);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${definition.label} virou a nova rotina do mascote.`);
        router.refresh();
      }
    });
  }

  function remove(mascotId: string) {
    startTransition(async () => {
      const result = await setMascotRoutineV2Action(mascotId, "NONE");
      if (result.error) toast.error(result.error);
      else {
        toast.success("Mascote retirado dos espaços públicos.");
        router.refresh();
      }
    });
  }

  function elapsed(iso: string | null) {
    if (!iso || now === null) return "Calculando...";
    const minutes = Math.max(
      0,
      Math.floor((now - new Date(iso).getTime()) / 60_000),
    );
    if (minutes < 60) return `${minutes} min nesta área`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}min nesta área`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h nesta área`;
  }

  function cooldownMinutes(iso: string | null) {
    if (!iso || now === null) return 0;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
  }
  function actionMinutes(iso: string | null) {
    if (!iso || now === null) return null;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
  }
  function influence(mascotId: string, direction: 1 | -1) {
    startTransition(async () => {
      const result = await setRefugeInfluenceV2Action(mascotId, direction);
      if (result.error) toast.error(result.error);
      else
        toast.success(
          direction > 0
            ? "Influência positiva registrada como sugestão."
            : "Influência negativa registrada como sugestão.",
        );
    });
  }
  function claim(mascotId: string) {
    startTransition(async () => {
      const result = await claimRefugeRewardV2Action(mascotId);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Você resgatou 1x ${result.name}.`);
        setSelectedOccupant(null);
        router.refresh();
      }
    });
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/20">
      <div className="relative min-h-[390px] overflow-hidden bg-slate-900">
        {backgroundUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          />
        ) : (
          <div
            className={`absolute inset-0 ${location === "GARDEN" ? "bg-[radial-gradient(circle_at_30%_30%,#39734b,#10251c_55%,#07120d)]" : location === "TRAINING" ? "bg-[radial-gradient(circle_at_70%_20%,#81441d,#29180e_55%,#100a08)]" : location === "REST" ? "bg-[radial-gradient(circle_at_50%_20%,#24467a,#121d3c_55%,#080c1c)]" : "bg-[radial-gradient(circle_at_50%_25%,#643a87,#251333_55%,#0e0815)]"}`}
          />
        )}
        <div className="absolute inset-0 bg-slate-950/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-black/65" />
        <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 shadow-xl backdrop-blur-md sm:left-5 sm:top-5">
          <div className="flex items-center gap-2">
            <span className="text-3xl drop-shadow-lg">{definition.icon}</span>
            <div>
              <h3 className="text-xl font-black text-white">
                {definition.label}
              </h3>
              <p className="text-xs font-medium text-slate-200">
                {definition.purpose}
              </p>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-[10px] leading-4 text-slate-300">
            <strong className="text-white">Impacto:</strong> {definition.impact}
          </p>
        </div>
        <div className="absolute right-5 top-5 z-20 hidden rounded-full border border-white/15 bg-slate-950/85 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur sm:block">
          <Users size={12} className="mr-1 inline" />{" "}
          {filteredOccupants.length === occupants.length
            ? occupants.length
            : `${filteredOccupants.length}/${occupants.length}`}{" "}
          habitando agora
        </div>
        {visibleOccupants.map((mascot, index) => (
          <button
            type="button"
            onClick={() => setSelectedOccupant(mascot)}
            aria-label={`Abrir ficha social de ${mascot.name}`}
            key={mascot.id}
            className={`group absolute z-10 -translate-x-1/2 ${POSITIONS[index]} transition hover:z-20 hover:scale-110 focus:z-20 focus:outline-none`}
          >
            <span className="absolute -right-3 -top-4 z-30 rounded-full border border-cyan-200/30 bg-slate-950/90 px-2 py-1 text-[8px] font-black text-cyan-200 shadow-lg">
              {mascot.pendingReward
                ? "🎁 resgatar"
                : actionMinutes(mascot.nextActionAt) === null
                  ? "agendando"
                  : actionMinutes(mascot.nextActionAt) === 0
                    ? "ação próxima"
                    : `${actionMinutes(mascot.nextActionAt)}min`}
            </span>
            <div
              className={`rounded-2xl border p-1 backdrop-blur-sm ${mascot.own ? "border-cyan-300/60 bg-cyan-950/70 shadow-lg shadow-cyan-400/20" : "border-white/25 bg-slate-950/65"}`}
            >
              <img
                src={mascot.sprite}
                alt={mascot.name}
                className="h-16 w-16 object-contain drop-shadow-[0_5px_7px_rgba(0,0,0,.8)] sm:h-20 sm:w-20"
              />
            </div>
            <div className="pointer-events-none absolute left-1/2 top-full mt-1 hidden min-w-max -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-center group-hover:block group-focus:block">
              <p className="text-[10px] font-bold text-white">
                {mascot.name} · Nv.{mascot.level}
              </p>
              <p className="text-[9px] text-slate-300">
                {mascot.owner} · {mascot.personality}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold text-cyan-200">
                {elapsed(mascot.startedAt)}
              </p>
              <p className="mt-1 text-[8px] font-bold uppercase text-fuchsia-300">
                Clique para interagir
              </p>
            </div>
          </button>
        ))}
        {filteredOccupants.length === 0 && (
          <div className="absolute inset-x-5 bottom-20 rounded-2xl border border-dashed border-white/20 bg-slate-950/80 p-5 text-center text-xs text-slate-300 backdrop-blur-md">
            {occupants.length === 0
              ? "O local está silencioso. Envie um mascote para começar a habitá-lo."
              : "Nenhum mascote corresponde aos filtros selecionados."}
          </div>
        )}
        <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between gap-3">
          <p className="rounded-full bg-black/45 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">
            Azul: seu mascote · clique em qualquer habitante para abrir sua
            ficha social
          </p>
        </div>
      </div>
      {selectedOccupant && (
        <div className="border-t border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(217,70,239,.08),rgba(2,6,23,.96))] p-4">
          <div className="flex flex-wrap items-center gap-4">
            <img
              src={selectedOccupant.sprite}
              alt=""
              className="h-20 w-20 rounded-2xl border border-white/10 bg-slate-900 object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                Ficha social do habitante
              </p>
              <h4 className="text-lg font-black text-white">
                {selectedOccupant.name} · Nv.{selectedOccupant.level}
              </h4>
              <p className="text-xs text-slate-300">
                Treinador: <strong>{selectedOccupant.owner}</strong> ·
                Personalidade: <strong>{selectedOccupant.personality}</strong>
              </p>
              <p className="mt-1 text-xs text-cyan-200">
                {elapsed(selectedOccupant.startedAt)}
              </p>
              <p className="mt-1 text-xs text-fuchsia-200">
                Tag: <strong>{selectedOccupant.performanceTag}</strong> ·
                Próxima ação:{" "}
                <strong>
                  {actionMinutes(selectedOccupant.nextActionAt) === 0
                    ? "pronta"
                    : `${actionMinutes(selectedOccupant.nextActionAt) ?? "?"} min`}
                </strong>
              </p>
              <p className="mt-2 max-w-2xl text-[10px] leading-4 text-slate-400">
                Os encontros acontecem automaticamente pelo ciclo do Refúgio.
                Consulte o diário para ver histórias deste mascote e Laços e
                efeitos para acompanhar relações formadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!selectedOccupant.own && (
                <>
                  <Link
                    href={`/jogadores/${selectedOccupant.ownerId}`}
                    className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"
                  >
                    Ver treinador
                  </Link>
                  <button
                    disabled={pending}
                    onClick={() => influence(selectedOccupant.id, 1)}
                    className="rounded-xl border border-emerald-300/20 px-3 py-2 text-xs font-bold text-emerald-200"
                  >
                    Influência positiva
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => influence(selectedOccupant.id, -1)}
                    className="rounded-xl border border-rose-300/20 px-3 py-2 text-xs font-bold text-rose-200"
                  >
                    Influência negativa
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setOccupantQuery(selectedOccupant.name);
                  setStoryQuery(selectedOccupant.name);
                  setSelectedOccupant(null);
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white"
              >
                Acompanhar histórias
              </button>
              {selectedOccupant.own && (
                <>
                  {selectedOccupant.pendingReward && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => claim(selectedOccupant.id)}
                      className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950"
                    >
                      Resgatar recurso
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      remove(selectedOccupant.id);
                      setSelectedOccupant(null);
                    }}
                    className="rounded-xl border border-rose-300/20 px-3 py-2 text-xs font-bold text-rose-200"
                  >
                    Retirar da área
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelectedOccupant(null)}
                className="rounded-xl border border-white/10 p-2 text-slate-400"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-white/10 bg-slate-950/80 p-4">
        <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-2.5 text-slate-500"
            />
            <input
              value={occupantQuery}
              onChange={(event) => {
                setOccupantQuery(event.target.value);
                setOccupantPage(1);
              }}
              placeholder="Filtrar mascote posicionado..."
              className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-300/40"
            />
          </div>
          <select
            value={ownerFilter}
            onChange={(event) => {
              setOwnerFilter(event.target.value);
              setOccupantPage(1);
            }}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/40"
          >
            <option value="ALL">Todos os donos</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900 px-2">
            <button
              type="button"
              disabled={safeOccupantPage <= 1}
              onClick={() => setOccupantPage(safeOccupantPage - 1)}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-25"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="whitespace-nowrap text-[10px] text-slate-400">
              Página {safeOccupantPage} de {occupantPages}
            </span>
            <button
              type="button"
              disabled={safeOccupantPage >= occupantPages}
              onClick={() => setOccupantPage(safeOccupantPage + 1)}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-25"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 border-t border-white/10 p-4 lg:grid-cols-[1fr_220px]">
        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-300">
                Gerenciar seus mascotes
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Até {BONDS_V2_BALANCE.publicSpaces.maxMascotsPerPlayer} em
                espaços públicos,{" "}
                {
                  BONDS_V2_BALANCE.publicSpaces
                    .maxMascotsPerPlayerInSameLocation
                }{" "}
                por área. Trocas têm{" "}
                {BONDS_V2_BALANCE.publicSpaces.moveCooldownMinutes / 60}h de
                adaptação.
              </p>
            </div>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-2.5 text-slate-500"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por nome ou personalidade..."
              className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-300/40"
            />
          </div>
          <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {available.map((mascot) => {
              const here = mascot.location === location;
              const elsewhere = mascot.location && !here;
              const cooldown = cooldownMinutes(mascot.moveAvailableAt);
              return (
                <div
                  key={mascot.id}
                  className={`flex items-center gap-2 rounded-xl border p-2 ${here ? "border-cyan-300/35 bg-cyan-300/[.08]" : "border-white/10 bg-white/[.025]"}`}
                >
                  <img
                    src={mascot.sprite}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg bg-slate-900 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-white">
                      {mascot.name}
                    </p>
                    <span className="inline-flex rounded-full bg-fuchsia-300/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-fuchsia-200">
                      {mascot.performanceTag}
                    </span>
                    <p
                      className={`truncate text-[9px] ${cooldown > 0 && !here ? "text-amber-300" : "text-slate-500"}`}
                    >
                      {here
                        ? elapsed(mascot.startedAt)
                        : cooldown > 0
                          ? `Adaptação: ${cooldown} min`
                          : elsewhere
                            ? `${REFUGE_LOCATIONS[mascot.location as RefugeLocation]?.label ?? "Outro espaço"}`
                            : "Sem espaço público"}
                    </p>
                  </div>
                  {here ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(mascot.id)}
                      title="Retirar deste espaço"
                      className="rounded-lg border border-rose-300/20 p-2 text-rose-300 hover:bg-rose-300/10 disabled:opacity-40"
                    >
                      <LogOut size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending || cooldown > 0}
                      onClick={() => allocate(mascot.id)}
                      title={
                        cooldown > 0
                          ? `Troca disponível em ${cooldown} min`
                          : `Enviar para ${definition.label}`
                      }
                      className="rounded-lg border border-cyan-300/20 p-2 text-cyan-300 hover:bg-cyan-300/10 disabled:opacity-30"
                    >
                      <MapPin size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 bg-[#050914] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-300">
              Diário desta região
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Cada área possui seu próprio histórico. Procure pelos mascotes ou
              filtre o tipo de acontecimento.
            </p>
          </div>
          <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-slate-500">
            {stories.length} relatos preservados nesta área
          </span>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-2.5 text-slate-500"
            />
            <input
              value={storyQuery}
              onChange={(event) => {
                setStoryQuery(event.target.value);
                setStoryPage(1);
              }}
              placeholder="Buscar mascote, treinador ou acontecimento..."
              className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-fuchsia-300/40"
            />
          </div>
          <select
            value={storyKind}
            onChange={(event) => {
              setStoryKind(event.target.value as typeof storyKind);
              setStoryPage(1);
            }}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-fuchsia-300/40"
          >
            <option value="ALL">Todos os acontecimentos</option>
            <option value="SOCIAL">Momentos sociais</option>
            <option value="CONFLICT">Conflitos</option>
          </select>
        </div>
        {stories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">
            Ainda não há histórias registradas neste local.
          </p>
        ) : filteredStories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">
            Nenhum relato corresponde à busca e ao filtro selecionados.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleStories.map((story) => (
                <article
                  key={story.id}
                  className={`rounded-xl border p-3 ${story.conflict ? "border-rose-400/30 bg-rose-400/[.08]" : "border-emerald-400/20 bg-emerald-400/[.06]"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-[9px] font-black uppercase tracking-wider ${story.conflict ? "text-rose-300" : "text-emerald-300"}`}
                    >
                      {story.conflict ? "⚡ Conflito" : "✦ Momento social"}
                    </p>
                    {story.scoreDelta !== null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black ${story.scoreDelta < 0 ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}
                      >
                        {story.scoreDelta > 0 ? "+" : ""}
                        {story.scoreDelta} relação
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-black text-white">
                    {story.participants}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    {story.owners} · {story.when}
                  </p>
                  <p className="mt-2 text-[10px] leading-4 text-slate-300">
                    {story.description}
                  </p>
                </article>
              ))}
            </div>
            {storyPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={safeStoryPage <= 1}
                  onClick={() => setStoryPage(safeStoryPage - 1)}
                  className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] text-slate-500">
                  Relatos {(safeStoryPage - 1) * storiesPerPage + 1}–
                  {Math.min(
                    filteredStories.length,
                    safeStoryPage * storiesPerPage,
                  )}{" "}
                  de {filteredStories.length}
                </span>
                <button
                  type="button"
                  disabled={safeStoryPage >= storyPages}
                  onClick={() => setStoryPage(safeStoryPage + 1)}
                  className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
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

export function ImportantMomentsList({
  moments,
}: {
  moments: ImportantMoment[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [context, setContext] = useState("ALL");
  const [page, setPage] = useState(1);
  const contexts = [...new Set(moments.map((moment) => moment.context))];
  const filtered = moments.filter((moment) => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return (
      (!q ||
        `${moment.title} ${moment.description} ${moment.participants}`
          .toLocaleLowerCase("pt-BR")
          .includes(q)) &&
      (context === "ALL" || moment.context === context)
    );
  });
  const perPage = 4;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-2.5 text-slate-500"
          />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar mascotes ou situação..."
            className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-amber-300/40"
          />
        </div>
        <select
          value={context}
          onChange={(event) => {
            setContext(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-amber-300/40"
        >
          <option value="ALL">Todos os locais</option>
          {contexts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
          Nenhum momento corresponde aos filtros.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((moment) => (
            <article
              key={moment.id}
              className="rounded-2xl border border-amber-300/15 bg-[linear-gradient(135deg,rgba(245,158,11,.07),rgba(15,23,42,.7))] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <img
                    src={moment.spriteA}
                    alt=""
                    className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain"
                  />
                  {moment.spriteB && (
                    <img
                      src={moment.spriteB}
                      alt=""
                      className="h-11 w-11 rounded-full border border-slate-700 bg-slate-950 object-contain"
                    />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                    {moment.context}
                  </p>
                  <h3 className="font-bold text-white">{moment.title}</h3>
                  <p className="text-[10px] text-slate-500">
                    {moment.participants}
                  </p>
                </div>
              </div>
              <p className="my-3 text-sm leading-6 text-slate-300">
                {moment.description}
              </p>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Escolha uma intenção · os resultados são mostrados antes de
                confirmar
              </p>
              <div className="grid gap-2">
                {moment.options.map((option) => (
                  <ResolveBondOptionButton
                    key={option.id}
                    eventId={moment.id}
                    option={option}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] text-slate-500">
            Decisões {(safePage - 1) * perPage + 1}–
            {Math.min(filtered.length, safePage * perPage)} de {filtered.length}
          </span>
          <button
            disabled={safePage >= pages}
            onClick={() => setPage(safePage + 1)}
            className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-25"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

const GUIDE_RELATIONS = [
  {
    score: -80,
    range: "−100 a −80",
    name: "Nêmesis",
    tone: "text-rose-300 border-rose-400/25 bg-rose-400/[.06]",
  },
  {
    score: -50,
    range: "−79 a −50",
    name: "Inimigo",
    tone: "text-orange-300 border-orange-400/25 bg-orange-400/[.06]",
  },
  {
    score: -15,
    range: "−49 a −15",
    name: "Rival",
    tone: "text-amber-300 border-amber-400/25 bg-amber-400/[.06]",
  },
  {
    score: 0,
    range: "−14 a +14",
    name: "Conhecido",
    tone: "text-slate-300 border-white/10 bg-white/[.025]",
  },
  {
    score: 15,
    range: "+15 a +39",
    name: "Colega",
    tone: "text-cyan-300 border-cyan-400/20 bg-cyan-400/[.05]",
  },
  {
    score: 40,
    range: "+40 a +79",
    name: "Amigo",
    tone: "text-emerald-300 border-emerald-400/25 bg-emerald-400/[.06]",
  },
  {
    score: 80,
    range: "+80 a +100",
    name: "Super Amigo",
    tone: "text-fuchsia-300 border-fuchsia-400/25 bg-fuchsia-400/[.06]",
  },
] as const;

const GUIDE_ITEMS = [
  [
    "BOND_SHARED_BERRY",
    "Frutinha da Partilha",
    "Horta",
    "+4 de relação principal e +2 recíproca em escolhas de cooperação.",
  ],
  [
    "BOND_CALMING_HERB",
    "Erva Apaziguadora",
    "Horta",
    "Evita até 5 pontos negativos de um conflito e registra uma trégua.",
  ],
  [
    "BOND_REVENGE_TOKEN",
    "Ficha de Revanche",
    "Treino",
    "Cria rivalidade controlada em −4 e evita uma consequência mais severa.",
  ],
  [
    "BOND_TRAINING_RIBBON",
    "Faixa de Treino em Dupla",
    "Treino",
    "+5 de relação e uma memória de parceria de treino.",
  ],
  [
    "BOND_SHARED_PILLOW",
    "Almofada Compartilhada",
    "Descanso",
    "+4 de relação e favorece uma memória de cuidado ou ensino.",
  ],
  [
    "BOND_NIGHT_TEA",
    "Chá de Boa-Noite",
    "Descanso",
    "Remove a tensão anterior e concede +2 nas duas direções.",
  ],
  [
    "BOND_YARD_TOY",
    "Brinquedo de Pátio",
    "Pátio",
    "Favorece evento com 3 ou mais mascotes e formação de grupo.",
  ],
  [
    "BOND_ILLUSTRATED_INVITATION",
    "Convite Ilustrado",
    "Pátio",
    "Escolhe o alvo preferencial do próximo encontro, sem definir seu resultado.",
  ],
  [
    "BOND_MEMORY_ALBUM",
    "Álbum de Memórias",
    "Marco",
    "Protege uma memória marcante sem alterar a pontuação.",
  ],
  [
    "BOND_TRUCE_BELL",
    "Sino de Trégua",
    "Marco",
    "Encerra um conflito limitando a mudança de relação entre −2 e +2.",
  ],
  [
    "BOND_PROMISE_CHARM",
    "Amuleto de Promessa",
    "Disputa",
    "Pausa o prazo restante; após 6h sem Escudo, cancela o afastamento com 100% de certeza.",
  ],
  [
    "BOND_PROMISE_SHIELD",
    "Escudo do Desapego",
    "Disputa",
    "Remove o Amuleto, bloqueia outro nesta disputa e retoma o prazo restante do afastamento.",
  ],
  [
    "BOND_CHALLENGE_LETTER",
    "Carta de Desafio",
    "Marco",
    "Cria uma revanche entre mascotes que já sejam Rivais ou piores.",
  ],
  [
    "BOND_TAUNT_WHISTLE",
    "Apito de Provocação",
    "Competição",
    "+35 pontos percentuais à chance de conflito no próximo Treino.",
  ],
  [
    "BOND_CHALLENGE_BOARD",
    "Quadro de Desafios",
    "Competição",
    "Procura um novo oponente compatível e favorece um novo Rival.",
  ],
  [
    "BOND_SECOND_PLACE_MEDAL",
    "Medalha de Segundo Lugar",
    "Competição",
    "Após derrota, aplica −5 do perdedor para o vencedor e registra revanche.",
  ],
  [
    "BOND_SURPASS_ME_BAND",
    "Faixa “Me Supere”",
    "Competição",
    "Aplica −4 nas duas direções e cria rivalidade saudável.",
  ],
  [
    "BOND_CRACKED_TROPHY",
    "Troféu Rachado",
    "Competição",
    "Transforma um Conhecido em Rival (−15), após uma interação prévia.",
  ],
  [
    "BOND_RIVAL_CIRCUIT_PASS",
    "Passe do Circuito Rival",
    "Competição",
    "Abre até 3 desafios separados contra oponentes diferentes.",
  ],
] as const;

export function BondsTutorial() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!window.localStorage.getItem("lacos-v2-guia-visto")) setOpen(true);
  }, []);
  function close() {
    window.localStorage.setItem("lacos-v2-guia-visto", "1");
    setOpen(false);
  }
  const pages = [
    {
      title: "Bem-vindo ao novo Refúgio",
      eyebrow: "Do sistema antigo para um mundo vivo",
      body: (
        <div>
          <p className="text-sm leading-6 text-slate-300">
            Antes, Laços eram apenas uma lista de relações. Agora seus mascotes
            ocupam espaços públicos, encontram criaturas de outros treinadores,
            produzem recursos e criam histórias mesmo quando ninguém está com a
            página aberta.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              [
                "1. Escolha uma rotina",
                "Você pode manter até 8 mascotes em espaços públicos, no máximo 3 em cada área. Cada mascote possui sua própria recarga de 2 horas para trocar ou sair.",
              ],
              [
                "2. O mundo continua vivo",
                "A cada ciclo, os habitantes podem criar histórias, relações e itens mesmo que nenhum treinador esteja com a página aberta.",
              ],
              [
                "3. Momentos importantes",
                "Alguns acontecimentos pedem sua decisão. As opções mostram custos e resultados; se você não responder, o mascote decide sem gastar seus recursos.",
              ],
              [
                "4. Amizade e rivalidade",
                "Amizades ajudam na mesma equipe e em atividades. Rivalidades aumentam motivação e dano em confrontos específicos. As duas rotas são úteis.",
              ],
              [
                "5. Dez vínculos, sem fila",
                "Cada mascote mantém somente os 10 vínculos exibidos. Interações com outras criaturas ainda geram histórias, mas não criam um 11º vínculo oculto esperando uma vaga.",
              ],
              [
                "6. Afastamento definitivo",
                "O afastamento leva 24 horas e pode ser cancelado durante o prazo. Ao concluir, a relação dos dois lados é removida por completo; somente as memórias históricas permanecem.",
              ],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
              >
                <h3 className="font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Explore o Refúgio",
      eyebrow: "Aba 1 · rotinas públicas",
      body: (
        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(REFUGE_LOCATIONS).map(([id, location]) => (
              <article
                key={id}
                className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
              >
                <h3 className="font-black text-white">
                  {location.icon} {location.label}
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  {location.impact}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-cyan-300/[.06] p-4 text-sm leading-6 text-slate-300">
            Use busca, filtros e paginação para ver habitantes e diário. Cada
            mascote mostra há quanto tempo está no local. A troca tem recarga
            individual de 2 horas.
          </p>
        </div>
      ),
    },
    {
      title: "Momentos importantes",
      eyebrow: "Aba 2 · suas decisões",
      body: (
        <div className="space-y-4 text-sm leading-6 text-slate-300">
          <p>
            Eventos comuns ficam no diário da região. Somente acontecimentos com
            impacto real aparecem aqui para você escolher como o treinador
            intervém.
          </p>
          <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-4">
            As opções mudam conforme local, relação, personalidade e contexto.
            Algumas consomem itens da Mochila; sem resposta, o mascote pode
            decidir sozinho sem gastar seus recursos.
          </p>
          <p>
            Conflitos não são necessariamente ruins: eles podem criar
            rivalidades saudáveis, Clubes da Luta e recursos competitivos.
          </p>
        </div>
      ),
    },
    {
      title: "Mapa social",
      eyebrow: "Aba 3 · treinadores e grupos",
      body: (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-300/15 p-4">
            <h3 className="font-bold text-emerald-300">Círculos de amizade</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Dois ou mais vínculos positivos em torno do mesmo mascote
              favorecem eventos coletivos e itens comuns de Laços.
            </p>
          </div>
          <div className="rounded-2xl border border-rose-300/15 p-4">
            <h3 className="font-bold text-rose-300">Clubes da Luta</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Duas ou mais rivalidades favorecem desafios, competição e itens
              próprios quando se encontram no Campo de Treino.
            </p>
          </div>
          <p className="md:col-span-2 text-sm leading-6 text-slate-300">
            Pesquise um treinador e clique no nome para abrir estatísticas,
            média das relações e todas as duplas ligadas a ele.
          </p>
        </div>
      ),
    },
    {
      title: "Laços, afastamento e disputa",
      eyebrow: "Aba 4 · gameplay e gerenciamento",
      body: (
        <div>
          <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4 text-sm leading-6 text-slate-300">
            A escala vai de <strong>−100</strong> a <strong>+100</strong>.
            Amizades oferecem cooperação; rivalidades oferecem benefícios
            competitivos. Os efeitos aparecem visualmente nos combates
            compatíveis.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {GUIDE_RELATIONS.map((relation) => (
              <article
                key={relation.name}
                className={`rounded-2xl border p-4 ${relation.tone}`}
              >
                <div className="flex justify-between gap-3">
                  <h3 className="font-black">{relation.name}</h3>
                  <span className="text-xs">{relation.range}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  {relationEffectV2(relation.score)}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-300/20 bg-amber-300/[.05] p-4 text-sm leading-6 text-slate-300">
            <p>
              <strong className="text-white">1.</strong> O afastamento começa
              com 24 horas.
            </p>
            <p>
              <strong className="text-white">2.</strong> O outro treinador pode
              contestar uma vez, com 50% de chance de cancelar.
            </p>
            <p>
              <strong className="text-white">3.</strong> O Amuleto de Promessa
              pausa as horas restantes por 6h; se não for bloqueado, preserva o
              vínculo.
            </p>
            <p>
              <strong className="text-white">4.</strong> Nessas 6h, o iniciador
              pode usar o Escudo do Desapego para remover o Amuleto, bloquear
              outro e retomar o prazo restante.
            </p>
            <p>
              <strong className="text-white">5.</strong> Ao terminar o prazo
              normal, o vínculo some dos dois lados, mas as memórias permanecem.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Saúde e doença",
      eyebrow: "Cuidados · fome e estado emocional",
      body: (
        <div className="space-y-4 text-sm leading-6 text-slate-300">
          <p className="rounded-2xl border border-lime-300/20 bg-lime-300/[.06] p-4">
            <strong className="text-lime-200">
              Um mascote só corre risco de adoecer quando duas condições
              acontecem juntas:
            </strong>{" "}
            ele está completamente faminto e também está triste (felicidade
            abaixo de 40) ou com raiva.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-bold text-white">O que não causa doença</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Ficar sem carinho, sozinho, nunca causa doença. Um mascote
                alimentado também não adoece por negligência, mesmo que esteja
                triste ou bravo.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-bold text-white">Consequências e cura</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                A doença reduz todos os cinco atributos em 40% e pode contagiar
                mascotes da mesma conta. O valor original e a redução aparecem
                no card. Use um Antídoto da ZikaShop para curar.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            A verificação acontece automaticamente pelo servidor. Alimentar e
            recuperar o estado emocional previne novos casos, mas um mascote já
            doente precisa do Antídoto.
          </p>
        </div>
      ),
    },
    {
      title: "Mochila de Laços",
      eyebrow: "Aba 5 · recursos e Bazar",
      body: (
        <div>
          <p className="mb-4 text-sm leading-6 text-slate-300">
            A Mochila reúne todos os itens sociais, inclusive os que estão
            zerados. Eles vêm das rotinas, marcos e conflitos; podem ser usados
            em decisões ou negociados entre jogadores no Bazar.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {GUIDE_ITEMS.map(([type, name, source, effect]) => (
              <article
                key={type}
                className="flex gap-3 rounded-xl border border-white/10 p-3"
              >
                <span className="text-2xl">{getShopItemEmoji(type)}</span>
                <div>
                  <h3 className="text-xs font-bold text-white">
                    {name} <span className="text-violet-300">· {source}</span>
                  </h3>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    {effect}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      ),
    },
  ];
  const current = pages[page];
  return (
    <>
      <button
        onClick={() => {
          setPage(0);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-300/15"
      >
        <BookOpen size={15} /> Guia completo do Refúgio
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-3 backdrop-blur-md"
          onClick={close}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-fuchsia-300/25 bg-[#080d1c] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-fuchsia-300">
                  {current.eyebrow}
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {current.title}
                </h2>
              </div>
              <button
                onClick={close}
                className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white"
              >
                <X size={17} />
              </button>
            </header>
            <div className="overflow-y-auto p-5">{current.body}</div>
            <footer className="flex items-center justify-between border-t border-white/10 bg-slate-950/70 p-4">
              <button
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-30"
              >
                Anterior
              </button>
              <div className="text-center">
                <p className="text-xs text-slate-400">
                  Página {page + 1} de {pages.length}
                </p>
                <div className="mt-2 flex gap-1">
                  {pages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setPage(index)}
                      aria-label={`Página ${index + 1}`}
                      className={`h-1.5 rounded-full transition-all ${index === page ? "w-6 bg-fuchsia-400" : "w-2 bg-slate-700"}`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() =>
                  page === pages.length - 1
                    ? close()
                    : setPage((value) => value + 1)
                }
                className="rounded-xl bg-fuchsia-400 px-4 py-2 text-sm font-bold text-slate-950"
              >
                {page === pages.length - 1 ? "Entendi" : "Próxima"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

export type BondItem = {
  id: string;
  a: string;
  b: string;
  owner: string;
  ownerA: string;
  ownerB: string;
  spriteA: string;
  spriteB: string;
  score: number;
  tier: string;
  effect: string;
  interactions: number;
  active: boolean;
  transitionAt: string | null;
  startedByMe: boolean;
  charmResolvesAt: string | null;
  shielded: boolean;
};

export function BondDirectoryV2({ relations }: { relations: BondItem[] }) {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("ALL");
  const [kind, setKind] = useState<"ALL" | "FRIEND" | "RIVAL" | "NEUTRAL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const perPage = 6;
  const owners = [...new Set(relations.map((relation) => relation.owner))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const filtered = relations.filter((relation) => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery =
      !term ||
      relation.a.toLocaleLowerCase("pt-BR").includes(term) ||
      relation.b.toLocaleLowerCase("pt-BR").includes(term) ||
      relation.owner.toLocaleLowerCase("pt-BR").includes(term);
    const matchesKind =
      kind === "ALL" ||
      (kind === "FRIEND"
        ? relation.score >= 15
        : kind === "RIVAL"
          ? relation.score <= -15
          : relation.score > -15 && relation.score < 15);
    return (
      relation.active &&
      matchesQuery &&
      matchesKind &&
      (owner === "ALL" || relation.owner === owner)
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice(
    (Math.min(page, pages) - 1) * perPage,
    Math.min(page, pages) * perPage,
  );
  return (
    <div className="font-sans">
      <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <h3 className="text-base font-semibold text-white">
          Como os 10 vínculos funcionam
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <InfoPill
            icon={<Sparkles size={16} />}
            title="10 relações, sem fila"
            text="Cada mascote gerencia somente os 10 vínculos exibidos. Não existe 11º vínculo esperando uma vaga."
          />
          <InfoPill
            icon={<Clock3 size={16} />}
            title="24 horas para encerrar"
            text="Iniciar afastamento abre um prazo de 24 horas. Você ainda pode desistir durante esse período."
          />
          <InfoPill
            icon={<HeartHandshake size={16} />}
            title="Encerramento completo"
            text="Ao terminar, Amigo, Conhecido ou Rival deixa de existir nas duas direções. Memórias antigas continuam apenas como histórico."
          />
        </div>
        <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100/85">
          <strong>A vaga fica livre somente quando o prazo termina.</strong>{" "}
          Nenhuma relação antiga assume o lugar automaticamente. Uma nova
          relação precisará nascer de um novo acontecimento depois que houver
          espaço.
        </p>
      </div>
      <div className="mb-3 grid gap-2 md:grid-cols-[1.2fr_.8fr_.8fr]">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar mascote, apelido ou treinador..."
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-400/50"
        />
        <select
          value={owner}
          onChange={(event) => {
            setOwner(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"
        >
          <option value="ALL">Todos os treinadores</option>
          {owners.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as typeof kind);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"
        >
          <option value="ALL">Todos os vínculos</option>
          <option value="FRIEND">Amizades</option>
          <option value="RIVAL">Rivalidades</option>
          <option value="NEUTRAL">Conhecidos</option>
        </select>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Exibindo {filtered.length} dos{" "}
        {relations.filter((relation) => relation.active).length} vínculos
        presentes. Use os filtros para consultar relações com um jogador
        específico.
      </p>
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
            Nenhum vínculo corresponde aos filtros.
          </div>
        ) : (
          visible.map((relation) => {
            const distancing =
              relation.transitionAt !== null &&
              new Date(relation.transitionAt).getTime() > Date.now();
            return (
              <article
                key={relation.id}
                className={`rounded-2xl border p-4 ${relation.score < -14 ? "border-rose-400/20 bg-rose-400/[.035]" : relation.score > 14 ? "border-emerald-400/20 bg-emerald-400/[.035]" : "border-white/10 bg-white/[.025]"}`}
              >
                <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[.05] p-3">
                    <img
                      src={relation.spriteA}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full bg-slate-900 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                        Mascote do jogador
                      </p>
                      <p className="truncate text-base font-semibold text-white">
                        {relation.a}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        Treinador: {relation.ownerA}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-slate-500">→</p>
                    <p className="text-[10px] uppercase text-slate-500">
                      sente por
                    </p>
                  </div>
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-violet-300/15 bg-violet-300/[.05] p-3">
                    <img
                      src={relation.spriteB}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full bg-slate-900 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                        Mascote encontrado
                      </p>
                      <p className="truncate text-base font-semibold text-white">
                        {relation.b}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        Treinador: {relation.ownerB}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-[105px] text-right">
                    <p className="font-semibold text-white">{relation.tier}</p>
                    <p className="text-sm text-slate-300">
                      {relation.score > 0 ? "+" : ""}
                      {relation.score}
                    </p>
                    <p className="text-xs text-slate-500">
                      {relation.interactions} interações
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${distancing ? "bg-amber-300/10 text-amber-200" : "bg-emerald-300/10 text-emerald-200"}`}
                    >
                      {distancing ? "Afastando" : "Presente"}
                    </span>
                  </div>
                </div>
                {distancing && (
                  <p className="mt-2 text-xs font-semibold text-amber-300">
                    Encerramento em{" "}
                    {new Date(relation.transitionAt!).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                <div className="my-3 rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
                    Efeito desta relação
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-300">
                    {relation.effect}
                  </p>
                </div>
                <BondV2Buttons
                  relationId={relation.id}
                  active={relation.active}
                  transitionAt={relation.transitionAt}
                  startedByMe={relation.startedByMe}
                  charmResolvesAt={relation.charmResolvesAt}
                  shielded={relation.shielded}
                />
              </article>
            );
          })
        )}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Página {Math.min(page, pages)} de {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function InfoPill({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-2 rounded-xl bg-white/[.035] p-3 text-slate-300">
      <span className="mt-0.5 text-fuchsia-300">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5">{text}</p>
      </div>
    </div>
  );
}

export function TrainerBondExplorer({ relations }: { relations: BondItem[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"ALL" | "FRIEND" | "RIVAL">("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const perPage = 5;
  const trainers = useMemo(
    () =>
      Object.values(
        relations
          .filter((relation) => relation.active)
          .reduce<Record<string, { name: string; relations: BondItem[] }>>(
            (result, relation) => {
              result[relation.ownerB] ??= {
                name: relation.ownerB,
                relations: [],
              };
              result[relation.ownerB].relations.push(relation);
              return result;
            },
            {},
          ),
      )
        .filter((trainer) => {
          const matchesQuery = trainer.name
            .toLocaleLowerCase("pt-BR")
            .includes(query.trim().toLocaleLowerCase("pt-BR"));
          const matchesKind =
            kind === "ALL" ||
            trainer.relations.some((relation) =>
              kind === "FRIEND" ? relation.score >= 15 : relation.score <= -15,
            );
          return matchesQuery && matchesKind;
        })
        .sort((a, b) => b.relations.length - a.relations.length),
    [relations, query, kind],
  );
  const pages = Math.max(1, Math.ceil(trainers.length / perPage));
  const visible = trainers.slice(
    (Math.min(page, pages) - 1) * perPage,
    Math.min(page, pages) * perPage,
  );
  const profile = trainers.find((trainer) => trainer.name === selected) ?? null;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3 text-slate-500" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
              setSelected(null);
            }}
            placeholder="Pesquisar treinador..."
            className="w-full rounded-xl border border-white/10 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-300/40"
          />
        </div>
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as typeof kind);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
        >
          <option value="ALL">Todas as relações</option>
          <option value="FRIEND">Com amizades</option>
          <option value="RIVAL">Com rivalidades</option>
        </select>
      </div>
      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
            Nenhum treinador encontrado.
          </div>
        ) : (
          visible.map((trainer) => {
            const friends = trainer.relations.filter(
              (relation) => relation.score >= 15,
            ).length;
            const rivals = trainer.relations.filter(
              (relation) => relation.score <= -15,
            ).length;
            const average = Math.round(
              trainer.relations.reduce(
                (total, relation) => total + relation.score,
                0,
              ) / trainer.relations.length,
            );
            return (
              <button
                key={trainer.name}
                type="button"
                onClick={() =>
                  setSelected(selected === trainer.name ? null : trainer.name)
                }
                className={`w-full rounded-xl border p-3 text-left transition ${selected === trainer.name ? "border-cyan-300/40 bg-cyan-300/[.07]" : "border-white/10 bg-black/20 hover:border-white/20"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {trainer.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {trainer.relations.length} relações · média{" "}
                      {average > 0 ? "+" : ""}
                      {average}
                    </p>
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300">
                      {friends} amizades
                    </span>
                    <span className="rounded-full bg-rose-400/10 px-2 py-1 text-rose-300">
                      {rivals} rivalidades
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>
          <span>
            Página {Math.min(page, pages)} de {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      {profile && (
        <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                Perfil social
              </p>
              <h3 className="text-lg font-bold text-white">
                Relações com {profile.name}
              </h3>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-full border border-white/10 p-1.5 text-slate-400"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {profile.relations.map((relation) => (
              <article
                key={relation.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.025] p-2"
              >
                <img
                  src={relation.spriteA}
                  alt=""
                  className="h-9 w-9 rounded-full bg-slate-900 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white">
                    {relation.a} <span className="text-slate-500">com</span>{" "}
                    {relation.b}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {relation.tier} · {relation.score > 0 ? "+" : ""}
                    {relation.score} · {relation.interactions} interações
                  </p>
                </div>
                <img
                  src={relation.spriteB}
                  alt=""
                  className="h-9 w-9 rounded-full bg-slate-900 object-contain"
                />
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type BondInventoryItem = {
  id: string;
  type: string;
  name: string;
  description: string;
  rarity: string;
  quantity: number;
};

export function BondInventoryV2({
  items,
}: {
  items: BondInventoryItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const router = useRouter();
  const visible = items.filter((item) =>
    `${item.name} ${item.description}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <section className="space-y-4 font-sans">
      <div className="rounded-3xl border border-violet-300/15 bg-violet-300/[.035] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
          Mochila
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          Itens dos Laços
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Itens aparecem aqui mesmo com quantidade zero. Eles são produzidos
          pelas rotinas do Refúgio, recebidos em marcos sociais e consumidos nas
          opções de Momentos importantes. Podem ser anunciados e trocados entre
          jogadores no Bazar, mas não aparecem no Miauvadão nem nas ofertas
          exclusivas.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/bazar/criar"
            className="rounded-xl bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Anunciar no Bazar
          </Link>
          <Link
            href="/bazar"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Consultar Bazar
          </Link>
        </div>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar item ou efeito..."
        className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-300/50"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-white/10 bg-slate-950/65 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{getShopItemEmoji(item.type)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {item.name}
                    </h3>
                    <p className="mt-0.5 text-xs uppercase tracking-wider text-violet-300">
                      {item.rarity}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-semibold ${item.quantity ? "bg-violet-300/15 text-violet-200" : "bg-white/5 text-slate-500"}`}
                  >
                    ×{item.quantity}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {item.description}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
