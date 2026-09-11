"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Bot,
  CheckCircle2,
  Copy,
  Gamepad2,
  History,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  ARENA_DRAFT_RULES,
  DRAFT_PERSONALITIES,
  DRAFT_POSTURES,
  DRAFT_STAT_KEYS,
  type ArenaDraftPet,
} from "@/lib/arena-draft";
import { PERSONALITY_LABEL, TYPE_LABELS_PT } from "@/lib/mascot-data";
import {
  cancelDraftQueueAction,
  createDraftChallengeAction,
  answerDraftChallengeAction,
  deleteDraftPresetAction,
  duplicateDraftPresetAction,
  joinDraftQueueAction,
  saveDraftPresetAction,
} from "./actions";

type Species = {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  isMega: boolean;
};
type Preset = {
  id: string;
  name: string;
  isReady: boolean;
  pets: ArenaDraftPet[];
  updatedAt: string;
};
type Match = {
  id: string;
  state: string;
  opponent: string | null;
  createdAt: string;
  incoming?: boolean;
};
const postureLabels: Record<string, string> = {
  DEFENDER: "Defensor",
  ATTACKER: "Atacante",
  FLANK: "Flanco",
  GUARDIAN: "Guardião",
  HEALER: "Cuidador",
  ENCOURAGER: "Encorajador",
  OPPORTUNIST: "Oportunista",
  DUELIST: "Duelista",
  SABOTEUR: "Sabotador",
  SCOUT: "Batedor",
  PROVOKER: "Provocador",
  SPECIALIST: "Especialista",
  SURVIVOR: "Sobrevivente",
};

export function ArenaDraftClient({
  species,
  presets,
  activeMatch,
  history,
  leaderboard,
  players,
  isAdmin,
}: {
  species: Species[];
  presets: Preset[];
  activeMatch: Match | null;
  history: Array<Match & { result: string }>;
  leaderboard: Array<{
    playerId: string;
    name: string;
    wins: number;
    losses: number;
    draws: number;
    matches: number;
    rating: number;
    winRate: number;
  }>;
  players: Array<{ id: string; name: string }>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"HOME" | "BUILD" | "PLAY" | "RANK">("HOME");
  const [selectedId, setSelectedId] = useState<string | null>(
    presets[0]?.id ?? null,
  );
  const selected = presets.find((p) => p.id === selectedId);
  const [name, setName] = useState(selected?.name ?? "Meu primeiro draft");
  const [pets, setPets] = useState<ArenaDraftPet[]>(selected?.pets ?? []);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [megaFilter, setMegaFilter] = useState<"ALL" | "MEGA" | "COMMON">(
    "ALL",
  );
  const [catalogOrder, setCatalogOrder] = useState<"NAME" | "ID">("NAME");
  const [catalogPage, setCatalogPage] = useState(1);
  const [challengeQuery, setChallengeQuery] = useState("");
  const [challengePresetId, setChallengePresetId] = useState(
    presets.find((preset) => preset.isReady)?.id ?? "",
  );
  const [tutorialOpen, setTutorialOpen] = useState(false);
  useEffect(() => {
    if (window.localStorage.getItem("arena-draft-intro-v1") !== "seen")
      setTutorialOpen(true);
  }, []);
  const closeTutorial = () => {
    window.localStorage.setItem("arena-draft-intro-v1", "seen");
    setTutorialOpen(false);
  };
  const catalogPageSize = 24;
  const types = useMemo(
    () => Array.from(new Set(species.flatMap((item) => item.types))).sort(),
    [species],
  );
  const filtered = useMemo(
    () =>
      species
        .filter(
          (item) =>
            (type === "ALL" || item.types.includes(type)) &&
            (megaFilter === "ALL" ||
              (megaFilter === "MEGA" ? item.isMega : !item.isMega)) &&
            (!query ||
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              String(item.id) === query),
        )
        .sort((a, b) =>
          catalogOrder === "NAME"
            ? a.name.localeCompare(b.name, "pt-BR")
            : a.id - b.id,
        ),
    [species, query, type, megaFilter, catalogOrder],
  );
  const catalogPages = Math.max(
    1,
    Math.ceil(filtered.length / catalogPageSize),
  );
  const visibleSpecies = filtered.slice(
    (Math.min(catalogPage, catalogPages) - 1) * catalogPageSize,
    Math.min(catalogPage, catalogPages) * catalogPageSize,
  );
  const megas = pets.filter((pet) => pet.isMega).length;
  const allocatedPoints = pets.reduce(
    (sum, pet) =>
      sum +
      DRAFT_STAT_KEYS.reduce(
        (value, key) => value + pet.stats[key] - ARENA_DRAFT_RULES.baseStat,
        0,
      ),
    0,
  );
  const choosePreset = (preset: Preset) => {
    setSelectedId(preset.id);
    setName(preset.name);
    setPets(preset.pets);
    setTab("BUILD");
  };
  const addPet = (item: Species) => {
    if (pets.length >= 12)
      return toast.error("Os 12 slots já estão preenchidos.");
    if (item.isMega && megas >= 2)
      return toast.error("O preset já possui as 2 formas Mega permitidas.");
    setPets([
      ...pets,
      {
        id: crypto.randomUUID(),
        slot: pets.length,
        speciesId: item.id,
        isMega: item.isMega,
        personality: "LOYAL",
        posture: "ATTACKER",
        stats: {
          force: 20,
          agility: 20,
          charisma: 20,
          instinct: 20,
          vitality: 20,
        },
      },
    ]);
  };
  const updatePet = (id: string, patch: Partial<ArenaDraftPet>) =>
    setPets(pets.map((pet) => (pet.id === id ? { ...pet, ...patch } : pet)));
  const removePet = (id: string) =>
    setPets(
      pets
        .filter((pet) => pet.id !== id)
        .map((pet, slot) => ({ ...pet, slot })),
    );
  const save = () =>
    start(async () => {
      const result = await saveDraftPresetAction({
        id: selectedId ?? undefined,
        name,
        pets,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success);
        result.errors?.forEach((e) => toast.warning(e));
        router.refresh();
      }
    });
  const queue = (id: string) =>
    start(async () => {
      const result = await joinDraftQueueAction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success);
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {tutorialOpen && (
        <ArenaDraftTutorial
          onClose={closeTutorial}
          onBuild={() => {
            closeTutorial();
            setTab("BUILD");
          }}
        />
      )}
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#050916] px-6 py-10 shadow-2xl shadow-cyan-950/30 sm:px-10 sm:py-14">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(rgba(34,211,238,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(217,70,239,.04)_1px,transparent_1px)] bg-[size:38px_38px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -left-24 top-0 -z-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-[100px]" />
        <div className="absolute -right-20 bottom-0 -z-10 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[110px]" />
        <div className="grid items-center gap-10 xl:grid-cols-[1.08fr_.92fr]">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.28em] text-cyan-300">
              Novo modo competitivo · Beta
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[.95] text-white sm:text-6xl">
              Monte. Leia.
              <br />
              <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
                Domine o draft.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Crie uma equipe de 12 mascotes com acesso livre ao catálogo. Bana
              ameaças, escolha sua formação e faça ajustes estratégicos durante
              a batalha.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-slate-400">
              <span>◆ Sem premiações no Beta</span>
              <span>◆ Qualquer mascote disponível</span>
              <span>◆ Até 2 Megas por equipe</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => setTab("BUILD")}
                className="rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20"
              >
                Montar minha equipe
              </button>
              <button
                onClick={() => setTutorialOpen(true)}
                className="rounded-xl bg-white/7 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/10"
              >
                Como funciona
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setTutorialOpen(true)}
                    className="rounded-xl px-4 py-3 text-xs font-bold text-fuchsia-300 ring-1 ring-fuchsia-400/30"
                  >
                    Admin · testar instruções
                  </button>
                  <Link
                    href="/combates/arena-draft/admin"
                    className="rounded-xl px-4 py-3 text-xs font-bold text-amber-200 ring-1 ring-amber-300/30"
                  >
                    Admin · controlar modo
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="relative min-h-[390px] overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,.2),transparent_42%),linear-gradient(145deg,rgba(8,15,34,.75),rgba(18,8,35,.75))] p-6">
            <div className="absolute inset-x-8 top-8 h-40 rounded-[50%] border border-cyan-300/20 [transform:perspective(500px)_rotateX(65deg)] shadow-[0_0_60px_rgba(34,211,238,.12)]" />
            <div className="absolute left-5 top-16 flex -space-x-4 opacity-80">
              {species.slice(24, 27).map((item) => (
                <img
                  key={item.id}
                  src={item.sprite}
                  alt=""
                  className="h-20 w-20 object-contain drop-shadow-[0_0_12px_rgba(34,211,238,.6)]"
                />
              ))}
            </div>
            <div className="absolute right-5 top-16 flex -space-x-4 opacity-80">
              {species.slice(150, 153).map((item) => (
                <img
                  key={item.id}
                  src={item.sprite}
                  alt=""
                  className="h-20 w-20 object-contain drop-shadow-[0_0_12px_rgba(217,70,239,.6)]"
                />
              ))}
            </div>
            <div className="relative mt-40">
              <p className="mb-5 text-center text-[10px] font-black uppercase tracking-[.22em] text-white">
                Sua rota para a batalha
              </p>
              <div className="relative grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4">
                <div className="absolute left-[12%] right-[12%] top-4 hidden h-px bg-gradient-to-r from-cyan-400 via-white/40 to-fuchsia-400 sm:block" />
                {[
                  ["12 mascotes", "Monte seu preset"],
                  ["3 banidos pelo rival", "Escolhas do adversário"],
                  ["9 disponíveis", "Draft progressivo"],
                  ["6 em campo + 3 no banco", "Formação final"],
                ].map(([title, text], index) => (
                  <div key={title} className="relative text-center">
                    <span
                      className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${index < 2 ? "bg-cyan-300 text-slate-950" : "bg-fuchsia-400 text-white"}`}
                    >
                      {index + 1}
                    </span>
                    <b className="mt-3 block text-xs text-white">{title}</b>
                    <span
                      className={`mt-1 block text-[9px] ${index === 1 ? "font-bold text-rose-300" : "text-slate-500"}`}
                    >
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-2 sm:grid-cols-4">
        {[
          ["HOME", "Visão geral", Gamepad2],
          ["BUILD", "Montar preset", Bot],
          ["PLAY", "Jogar", Users],
          ["RANK", "Histórico e ranking", Trophy],
        ].map(([key, label, Icon]) => {
          const C = Icon as typeof Bot;
          return (
            <button
              key={String(key)}
              onClick={() => {
                if (
                  key === "PLAY" &&
                  !presets.some((preset) => preset.isReady)
                ) {
                  toast.info("Monte e salve um preset válido antes de jogar.");
                  setTab("BUILD");
                  return;
                }
                setTab(key as typeof tab);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold ${tab === key ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/5"}`}
            >
              <C size={15} />
              {String(label)}
            </button>
          );
        })}
      </nav>

      {tab === "HOME" && (
        <section className="py-5 sm:py-10">
          <div className="relative grid gap-4 lg:grid-cols-4">
            <div className="absolute left-[10%] right-[10%] top-8 hidden h-[2px] bg-gradient-to-r from-cyan-400/40 via-fuchsia-400/60 to-cyan-400/40 lg:block" />
            {[
              [
                Bot,
                "Crie seu preset",
                "Distribua 4.500 pontos entre o time; todos começam com 20 em cada status. Escolha até 2 formas Mega.",
              ],
              [
                Search,
                "Leia o adversário",
                "Você vê espécies, tipos e Megas — mas a build continua secreta.",
              ],
              [
                Ban,
                "Bana e faça o draft",
                "Cada lado bane 3 mascotes. Dos 9 restantes, você define titulares e banco.",
              ],
              [
                Sparkles,
                "Reaja no combate",
                "Nos turnos 20, 35 e 45, ajuste posturas e troque mascotes sem recuperar HP.",
              ],
            ].map(([Icon, title, text], index) => {
              const C = Icon as typeof Bot;
              return (
                <article
                  key={String(title)}
                  className="relative bg-gradient-to-b from-white/[.055] to-transparent p-5 pt-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-cyan-300 ring-1 ring-cyan-300/30">
                    {index + 1}
                  </span>
                  <C size={17} className="mt-7 text-fuchsia-300" />
                  <h2 className="mt-3 text-lg font-black text-white">
                    {String(title)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {String(text)}
                  </p>
                </article>
              );
            })}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
            <span>Seu inventário não é alterado</span>
            <span className="text-slate-700">◆</span>
            <span>Combate automático sincronizado</span>
            <span className="text-slate-700">◆</span>
            <span>Trocas não curam e não revivem</span>
            <span className="text-slate-700">◆</span>
            <span>Reaja no momento certo · T20 / T35 / T45</span>
          </div>
        </section>
      )}

      {tab === "BUILD" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.35fr]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-white">Meus presets</h2>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setName("Novo preset");
                    setPets([]);
                  }}
                  className="rounded-lg bg-fuchsia-500 px-3 py-2 text-xs font-bold text-white"
                >
                  + Novo
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {presets.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhum preset criado.
                  </p>
                ) : (
                  presets.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center rounded-xl border ${selectedId === p.id ? "border-cyan-300/50 bg-cyan-300/5" : "border-white/10"}`}
                    >
                      <button
                        onClick={() => choosePreset(p)}
                        className="flex min-w-0 flex-1 items-center justify-between p-3 text-left"
                      >
                        <span>
                          <b className="block text-sm text-white">{p.name}</b>
                          <small className="text-slate-500">
                            {p.pets.length}/12 ·{" "}
                            {p.pets.filter((x) => x.isMega).length}/2 Megas
                          </small>
                        </span>
                        {p.isReady ? (
                          <CheckCircle2
                            className="text-emerald-300"
                            size={18}
                          />
                        ) : (
                          <span className="text-[9px] text-amber-300">
                            RASCUNHO
                          </span>
                        )}
                      </button>
                      <button
                        title="Duplicar preset"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const result = await duplicateDraftPresetAction(
                              p.id,
                            );
                            result.error
                              ? toast.error(result.error)
                              : toast.success(result.success);
                            router.refresh();
                          })
                        }
                        className="mr-2 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-cyan-200"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h2 className="font-black text-white">Catálogo livre</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_145px_125px_130px]">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3">
                  <Search size={14} />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setCatalogPage(1);
                    }}
                    placeholder="Nome ou Pokédex"
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                  />
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setCatalogPage(1);
                  }}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"
                >
                  <option value="ALL">Todos os tipos</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS_PT[t] ?? t}
                    </option>
                  ))}
                </select>
                <select
                  value={megaFilter}
                  onChange={(e) => {
                    setMegaFilter(e.target.value as typeof megaFilter);
                    setCatalogPage(1);
                  }}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"
                >
                  <option value="ALL">Todas as formas</option>
                  <option value="COMMON">Sem Mega</option>
                  <option value="MEGA">Somente Mega</option>
                </select>
                <select
                  value={catalogOrder}
                  onChange={(e) =>
                    setCatalogOrder(e.target.value as typeof catalogOrder)
                  }
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"
                >
                  <option value="NAME">Ordem alfabética</option>
                  <option value="ID">Ordem Pokédex</option>
                </select>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {visibleSpecies.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addPet(item)}
                    className={`relative rounded-xl border bg-white/[.025] p-2 hover:border-cyan-300/40 ${item.isMega ? "border-fuchsia-400/40" : "border-white/10"}`}
                  >
                    <img
                      src={item.sprite}
                      alt=""
                      className="mx-auto h-12 w-12 object-contain"
                    />
                    <span className="block truncate text-[10px] font-bold text-white">
                      {item.name}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      #{item.id}
                    </span>
                    {item.isMega && (
                      <span className="absolute right-1 top-1 rounded bg-fuchsia-500 px-1 text-[7px] font-black text-white">
                        MEGA
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage((p) => p - 1)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30"
                >
                  Anterior
                </button>
                <span className="text-[10px] text-slate-400">
                  Página {Math.min(catalogPage, catalogPages)} de {catalogPages}{" "}
                  · {filtered.length} espécies
                </span>
                <button
                  disabled={catalogPage >= catalogPages}
                  onClick={() => setCatalogPage((p) => p + 1)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30"
                >
                  Próxima
                </button>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-b border-white/10 bg-transparent text-xl font-black text-white outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Slots {pets.length}/12 · Megas {megas}/2 · Pontos do time{" "}
                  {allocatedPoints.toLocaleString("pt-BR")}
                  /4.500
                </p>
              </div>
              <button
                disabled={pending}
                onClick={save}
                className="rounded-xl bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-50"
              >
                Salvar preset
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {pets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-500">
                  Escolha mascotes no catálogo para começar.
                </div>
              ) : (
                pets.map((pet) => {
                  const item = species.find((s) => s.id === pet.speciesId)!;
                  const total = DRAFT_STAT_KEYS.reduce(
                    (s, k) => s + pet.stats[k],
                    0,
                  );
                  return (
                    <article
                      key={pet.id}
                      className="rounded-2xl border border-white/10 bg-white/[.025] p-3"
                    >
                      <div className="flex gap-3">
                        <span className="text-xs font-black text-slate-500">
                          {pet.slot + 1}
                        </span>
                        <img
                          src={item?.sprite}
                          alt=""
                          className="h-14 w-14 object-contain"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <b className="truncate text-white">{item?.name}</b>
                            <button
                              onClick={() => removePet(pet.id)}
                              className="text-rose-300"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <select
                              value={pet.personality}
                              onChange={(e) =>
                                updatePet(pet.id, {
                                  personality: e.target
                                    .value as ArenaDraftPet["personality"],
                                })
                              }
                              className="rounded-lg bg-slate-900 p-2 text-[10px]"
                            >
                              {DRAFT_PERSONALITIES.map((x) => (
                                <option key={x} value={x}>
                                  {PERSONALITY_LABEL[x]}
                                </option>
                              ))}
                            </select>
                            <select
                              value={pet.posture}
                              onChange={(e) =>
                                updatePet(pet.id, {
                                  posture: e.target
                                    .value as ArenaDraftPet["posture"],
                                })
                              }
                              className="rounded-lg bg-slate-900 p-2 text-[10px]"
                            >
                              {DRAFT_POSTURES.map((x) => (
                                <option key={x} value={x}>
                                  {postureLabels[x]}
                                </option>
                              ))}
                            </select>
                            <div
                              className={`flex items-center justify-center rounded-lg border p-2 text-[10px] ${pet.isMega ? "border-fuchsia-400 text-fuchsia-200" : "border-white/10 text-slate-500"}`}
                            >
                              {pet.isMega ? "Forma Mega · +10" : "Forma comum"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-1">
                        {DRAFT_STAT_KEYS.map((key) => (
                          <label key={key} className="text-center">
                            <span className="block truncate text-[8px] uppercase text-slate-500">
                              {
                                {
                                  force: "Força",
                                  agility: "Agilidade",
                                  charisma: "Carisma",
                                  instinct: "Instinto",
                                  vitality: "Vitalidade",
                                }[key]
                              }
                            </span>
                            <input
                              type="number"
                              min={20}
                              max={pet.isMega ? 240 : 250}
                              value={pet.stats[key]}
                              onChange={(e) =>
                                updatePet(pet.id, {
                                  stats: {
                                    ...pet.stats,
                                    [key]: Math.max(
                                      20,
                                      Math.min(
                                        pet.isMega ? 240 : 250,
                                        Number(e.target.value),
                                      ),
                                    ),
                                  },
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-center text-xs text-white"
                            />
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-right text-[10px] text-slate-400">
                        20 iniciais em cada status · {total - 100} pontos
                        distribuídos{" "}
                        {pet.isMega && "· bônus Mega calculado pelo servidor"}
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "PLAY" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.035] p-5">
            <h2 className="text-xl font-black text-white">Fila pública</h2>
            <p className="mt-2 text-sm text-slate-400">
              Escolha um preset pronto. A sala congela uma cópia dele ao
              encontrar um adversário.
            </p>
            {activeMatch ? (
              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
                <p className="font-bold text-amber-200">
                  {activeMatch.state === "CREATED"
                    ? "Buscando adversário…"
                    : `Partida contra ${activeMatch.opponent ?? "adversário"}`}
                </p>
                <p className="text-xs text-slate-500">
                  Estado: {activeMatch.state}
                </p>
                <div className="mt-3 flex gap-2">
                  {activeMatch.state === "CREATED" && (
                    <button
                      onClick={() =>
                        start(async () => {
                          await cancelDraftQueueAction(activeMatch.id);
                          router.refresh();
                        })
                      }
                      className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200"
                    >
                      Cancelar busca
                    </button>
                  )}
                  {activeMatch.state === "CHALLENGE_PENDING" &&
                  activeMatch.incoming ? (
                    <>
                      <select
                        value={challengePresetId}
                        onChange={(event) =>
                          setChallengePresetId(event.target.value)
                        }
                        className="rounded-lg border border-white/10 bg-slate-950 px-2 text-xs"
                      >
                        <option value="">Escolha o preset</option>
                        {presets
                          .filter((preset) => preset.isReady)
                          .map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() =>
                          start(async () => {
                            const result = await answerDraftChallengeAction(
                              activeMatch.id,
                              challengePresetId,
                              true,
                            );
                            result.error
                              ? toast.error(result.error)
                              : toast.success(result.success);
                            router.refresh();
                          })
                        }
                        className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950"
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() =>
                          start(async () => {
                            const result = await answerDraftChallengeAction(
                              activeMatch.id,
                              null,
                              false,
                            );
                            result.error
                              ? toast.error(result.error)
                              : toast.success(result.success);
                            router.refresh();
                          })
                        }
                        className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200"
                      >
                        Recusar
                      </button>
                    </>
                  ) : (
                    activeMatch.state !== "CHALLENGE_PENDING" && (
                      <Link
                        href={`/combates/arena-draft/${activeMatch.id}`}
                        className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"
                      >
                        Abrir sala
                      </Link>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {presets
                  .filter((p) => p.isReady)
                  .map((p) => (
                    <button
                      key={p.id}
                      disabled={pending}
                      onClick={() => queue(p.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 p-3 text-left hover:border-cyan-300/40"
                    >
                      <span>
                        <b className="block text-white">{p.name}</b>
                        <small className="text-slate-500">
                          12 mascotes · {p.pets.filter((x) => x.isMega).length}{" "}
                          Megas
                        </small>
                      </span>
                      <Swords size={18} className="text-cyan-300" />
                    </button>
                  ))}
                {!presets.some((p) => p.isReady) && (
                  <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
                    Finalize um preset para procurar partida.
                  </p>
                )}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[.035] p-5">
            <h2 className="text-xl font-black text-white">Desafio direto</h2>
            <p className="mt-2 text-sm text-slate-400">
              Procure um jogador e envie um convite. O adversário escolhe o
              próprio preset ao aceitar; o convite expira em 10 minutos.
            </p>
            <input
              value={challengeQuery}
              onChange={(event) => setChallengeQuery(event.target.value)}
              placeholder="Pesquisar jogador"
              className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm outline-none"
            />
            <select
              value={challengePresetId}
              onChange={(event) => setChallengePresetId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-xs"
            >
              <option value="">Escolha sua equipe para o desafio</option>
              {presets
                .filter((preset) => preset.isReady)
                .map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
            </select>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {players
                .filter(
                  (candidate) =>
                    !challengeQuery ||
                    candidate.name
                      .toLowerCase()
                      .includes(challengeQuery.toLowerCase()),
                )
                .slice(0, 20)
                .map((candidate) => (
                  <button
                    key={candidate.id}
                    disabled={
                      pending || Boolean(activeMatch) || !challengePresetId
                    }
                    onClick={() =>
                      start(async () => {
                        const result = await createDraftChallengeAction(
                          challengePresetId,
                          candidate.id,
                        );
                        result.error
                          ? toast.error(result.error)
                          : toast.success(result.success);
                        router.refresh();
                      })
                    }
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 p-3 text-left text-xs text-white disabled:opacity-40"
                  >
                    <span>{candidate.name}</span>
                    <Swords size={14} className="text-fuchsia-300" />
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
      {tab === "RANK" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <Trophy size={19} /> Ranking Beta
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Temporada mensal · rating Elo. Mínimo de 5 partidas; cancelamentos
              e partidas com admin não contam.
            </p>
            <Link
              href="/combates/arena-draft/ranking-mascotes"
              className="mt-3 inline-flex rounded-lg border border-fuchsia-300/25 px-3 py-2 text-[10px] font-bold text-fuchsia-200 hover:bg-fuchsia-300/5"
            >
              Ver ranking por mascote
            </Link>
            <div className="mt-4 space-y-2">
              {leaderboard.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  Aguardando amostra mínima.
                </p>
              ) : (
                leaderboard.map((r, i) => (
                  <div
                    key={r.playerId}
                    className="grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-xl border border-white/10 p-3"
                  >
                    <b className="text-cyan-300">#{i + 1}</b>
                    <span className="font-bold text-white">{r.name}</span>
                    <span className="text-right text-xs text-slate-400">
                      <b className="block text-fuchsia-300">{r.rating} pts</b>
                      {r.wins}V · {r.losses}D · {r.draws}E · {r.winRate}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <History size={19} /> Meu histórico
            </h2>
            <div className="mt-4 space-y-2">
              {history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  Nenhuma partida concluída.
                </p>
              ) : (
                history.map((m) => (
                  <Link
                    href={`/combates/arena-draft/replays/${m.id}`}
                    key={m.id}
                    className="flex justify-between rounded-xl border border-white/10 p-3 hover:border-cyan-300/30"
                  >
                    <span>
                      <b className="text-white">{m.opponent}</b>
                      <small className="block text-slate-500">
                        {new Date(m.createdAt).toLocaleString("pt-BR")}
                      </small>
                    </span>
                    <b className="text-cyan-300">{m.result}</b>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ArenaDraftTutorial({
  onClose,
  onBuild,
}: {
  onClose: () => void;
  onBuild: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Como funciona a Arena Draft"
    >
      <div className="relative grid max-h-[96vh] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#070b18] shadow-2xl shadow-black/70 lg:grid-cols-[1.08fr_.92fr]">
        <div className="relative hidden min-h-[680px] bg-slate-950 lg:block">
          <img
            src="/images/arena-draft/tutorial-arena.png"
            alt="Arena com mascotes preparados para o draft"
            className="absolute inset-0 h-full w-full object-contain object-center"
          />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#070b18] to-transparent" />
        </div>
        <div className="relative overflow-y-auto p-5 sm:p-7 lg:overflow-hidden">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white"
            aria-label="Fechar"
          >
            ×
          </button>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-cyan-300">
            Primeiros passos
          </p>
          <h2 className="mt-2 pr-10 text-2xl font-black text-white sm:text-3xl">
            Aqui, estratégia vem antes da coleção.
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
            A Arena Draft libera o mesmo catálogo para todos. Você monta sua
            estratégia, esconde a build e precisa ler as escolhas do rival.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <TutorialStep
              number="01"
              title="Monte seus 12"
              text="Todo mascote começa com 20 em cada status. Depois, distribua 4.500 pontos adicionais pelo time inteiro. Formas Mega são reconhecidas automaticamente e o limite é 2."
            />
            <TutorialStep
              number="02"
              title="Proteja sua build"
              text="O rival vê espécie, tipos e quais formas são Mega. Seus números, personalidade e postura permanecem secretos durante a inspeção."
            />
            <TutorialStep
              number="03"
              title="Bans e formação"
              text="Cada jogador bane 3 opções do adversário. Com os 9 restantes, o draft progressivo define 6 titulares e 3 reservas."
            />
            <TutorialStep
              number="04"
              title="Combate e reação"
              text="A luta é automática. Nos turnos 20, 35 e 45, cada lado prepara mudanças em segredo; HP, debuffs e derrotas continuam valendo após a troca."
            />
          </div>
          <div className="mt-3 rounded-xl bg-amber-300/8 p-3 text-[11px] leading-4 text-amber-100 ring-1 ring-amber-300/20">
            <b>Beta sem premiações:</b> partidas servem para testar estratégia,
            balanceamento, draft e rankings. Nenhum mascote ou item da sua
            coleção é consumido ou alterado.
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-5 py-3 text-sm font-bold text-slate-300 ring-1 ring-white/15"
            >
              Explorar a página
            </button>
            <button
              onClick={onBuild}
              className="rounded-xl bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950"
            >
              Montar minha equipe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function TutorialStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-xl bg-white/[.045] p-3">
      <span className="text-xs font-black text-fuchsia-300">{number}</span>
      <h3 className="mt-2 font-black text-white">{title}</h3>
      <p className="mt-1 text-[11px] leading-4 text-slate-400">{text}</p>
    </article>
  );
}
