"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getPokemonTypes, getStaticSpriteUrl } from "@/lib/mascot-data";
import { getCombatRoleLabel } from "@/lib/combat-roles";
import {
  adminReviveTowerMascotAction,
  getTowerLobbyDataAction,
  createTowerRunAction,
  joinTowerRoomAction,
  contributeTowerPreparationAction,
  spendTowerTalentAction,
  claimTowerMascotRewardAction,
} from "../actions";
import { TowerRunPanel } from "./tower-run-panel";
import {
  TowerKnowledge,
  TowerNarrative,
  TowerNarrativeAdmin,
} from "./tower-narrative";
import { TowerAdminSettings } from "./tower-admin-settings";
import { TowerIntro } from "./tower-intro";

type LobbyData = Extract<
  Awaited<ReturnType<typeof getTowerLobbyDataAction>>,
  { ok: true }
>;
type Role = LobbyData["roles"][number];
type Mascot = LobbyData["mascots"][number];

const card = "rounded-2xl border border-slate-800 bg-slate-950/70 p-5";
const PERSONALITIES = [
  ["LOYAL", "Leal"],
  ["PROUD", "Orgulhoso"],
  ["MISCHIEVOUS", "Travesso"],
  ["LAZY", "Preguiçoso"],
  ["COMPETITIVE", "Competitivo"],
  ["DRAMATIC", "Dramático"],
  ["PLAYFUL", "Brincalhão"],
  ["ELECTRIC", "Elétrico"],
  ["TIMID", "Tímido"],
  ["CHAOTIC", "Caótico"],
  ["CURIOUS", "Curioso"],
  ["GLUTTON", "Guloso"],
  ["SERENE", "Sereno"],
] as const;

export function TowerLobby() {
  const router = useRouter();
  const [data, setData] = useState<LobbyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [pace, setPace] = useState<"ONLINE" | "SLOW">("ONLINE");
  const [role, setRole] = useState<Role["key"] | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [stances, setStances] = useState<Record<string, string>>({});
  const [rewardPersonalities, setRewardPersonalities] = useState<
    Record<string, string>
  >({});
  const [claimedMascot, setClaimedMascot] = useState<{
    name: string;
    sprite: string;
    level: number;
    personality: string;
    origin: string;
    stats: {
      statForce: number;
      statAgility: number;
      statCharisma: number;
      statInstinct: number;
      statVitality: number;
    };
  } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [mascotPage, setMascotPage] = useState(1);
  const [introKey, setIntroKey] = useState(0);
  const [view, setView] = useState<"OVERVIEW" | "ROOMS" | "ARCHIVE" | "LEGACY">(
    "OVERVIEW",
  );

  const load = () => {
    void getTowerLobbyDataAction().then((res) => {
      if ("error" in res) {
        setLoadError(res.error ?? "Erro ao carregar o lobby.");
        return;
      }
      setData(res);
      const firstKey: Role["key"] | null = res.roles[0]?.key ?? null;
      setRole((r) => r ?? firstKey);
    });
  };
  useEffect(load, []);

  if (loadError)
    return (
      <section className={card}>
        <p className="text-sm text-red-300">{loadError}</p>
      </section>
    );
  if (!data)
    return (
      <section className={card}>
        <p className="text-sm text-slate-500">Carregando lobby…</p>
      </section>
    );

  // Já existe uma expedição ativa (lobby ou em andamento) → painel de turno.
  if (data.activeRun) {
    return (
      <div className="space-y-4">
        <TowerIntro forceKey={introKey} />
        <button
          type="button"
          onClick={() => setIntroKey(Date.now())}
          className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-xs font-black text-purple-200"
        >
          ▶ Testar introdução do evento
        </button>
        <TowerAdminSettings initial={data.config} onSaved={load} />
        <TowerNarrativeAdmin initial={data.scenes} />
        <TowerRunPanel
          runId={data.activeRun.id}
          onLeft={() => {
            router.refresh();
            load();
          }}
        />
      </div>
    );
  }

  // Cooldown de entrada.
  if (
    data.nextEntryAt &&
    data.pendingMascotRewards.length === 0 &&
    !claimedMascot
  ) {
    const when = new Date(data.nextEntryAt).toLocaleString("pt-BR");
    return (
      <div className="space-y-4">
        <TowerAdminSettings initial={data.config} onSaved={load} />
        <TowerNarrativeAdmin initial={data.scenes} />
        <section className={card}>
          <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">
            Cooldown de entrada
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Próxima entrada disponível em{" "}
            <strong className="text-white">{when}</strong>.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            O cooldown ({data.config.entryCooldownMinutes} min) é configurável
            no admin. Em desenvolvimento, defina 0 para testar sem espera.
          </p>
        </section>
      </div>
    );
  }

  const selectedRole = data.roles.find((r) => r.key === role) ?? null;
  const filteredMascots = data.mascots.filter(
    (m) =>
      (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
      (typeFilter === "ALL" ||
        getPokemonTypes(m.pokemonId).includes(typeFilter)),
  );
  const mascotPages = Math.max(1, Math.ceil(filteredMascots.length / 16));
  const visibleMascots = filteredMascots.slice(
    (mascotPage - 1) * 16,
    mascotPage * 16,
  );
  const toggle = (id: string) =>
    setPicks((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= 2
          ? cur
          : [...cur, id],
    );

  const create = () => {
    if (!role) {
      toast.error("Escolha uma Função de Expedição.");
      return;
    }
    if (picks.length !== 2) {
      toast.error("Selecione exatamente 2 mascotes.");
      return;
    }
    start(async () => {
      const res = await createTowerRunAction({
        pace,
        expeditionRole: role,
        mascotIds: picks,
        stanceByMascot: stances,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Expedição criada!");
      setPicks([]);
      router.refresh();
      load();
    });
  };

  return (
    <div className="space-y-6">
      <TowerIntro forceKey={introKey} />
      <nav
        className="sticky top-2 z-30 grid gap-2 rounded-2xl border border-purple-400/25 bg-slate-950/95 p-2 shadow-2xl backdrop-blur md:grid-cols-4"
        aria-label="Seções da Torre dos Rebeldes"
      >
        {(
          [
            ["OVERVIEW", "✦ Visão geral", "Entenda a expedição"],
            ["ROOMS", "⚔ Salas e equipe", "Criar, entrar e preparar"],
            ["ARCHIVE", "📖 Arquivo da Torre", "Pistas e contramedidas"],
            ["LEGACY", "🌳 Legado das Runs", "Melhorias permanentes"],
          ] as const
        ).map(([key, label, hint]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`rounded-xl border px-3 py-2 text-left transition ${view === key ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-slate-800 bg-black/20 text-slate-300 hover:border-purple-400/40"}`}
          >
            <b className="block text-xs">{label}</b>
            <small className="mt-0.5 block text-[9px] text-slate-500">
              {hint}
            </small>
          </button>
        ))}
      </nav>
      {view === "OVERVIEW" && (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-2xl border border-purple-400/25 bg-gradient-to-br from-purple-950/25 to-slate-950 p-5">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-purple-300">
              Como jogar
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              Da preparação ao chefe do andar
            </h2>
            <div className="mt-4 space-y-2">
              {[
                "Crie ou entre em uma sala e escolha classe, mascotes e posturas.",
                "Todos marcam Pronto; o dono inicia e os tickets são consumidos.",
                "Cada jogador escolhe ações e caminhos no mapa conectado.",
                "Encontros, mecanismos e votações são resolvidos antes do avanço.",
                "Derrote o chefe para abrir o próximo andar e fortalecer o Legado.",
              ].map((text, index) => (
                <div
                  key={text}
                  className="flex gap-3 rounded-xl bg-black/25 p-3 text-xs text-slate-300"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-400/15 font-black text-purple-200">
                    {index + 1}
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-red-400/25 bg-red-950/10 p-5">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-red-300">
              Pressão da Torre
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              Toda decisão tem um custo
            </h2>
            <p className="mt-3 text-xs leading-6 text-slate-300">
              Cada ação confirmada aumenta a Pressão e fortalece os inimigos.
              Esperar por reforços também custa 1 ponto. Se aliados escolherem
              caminhos diferentes, a Torre acompanha frentes separadas e a
              Pressão cresce em dobro.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px]">
              <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
                <b className="block text-sm">Juntos</b>Ajuda rápida e pressão
                normal
              </span>
              <span className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                <b className="block text-sm">Separados</b>Mais exploração e
                pressão dobrada
              </span>
            </div>
          </article>
        </section>
      )}
      {claimedMascot && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/90 p-4">
          <section className="my-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border border-fuchsia-300/50 bg-slate-950 shadow-[0_0_90px_rgba(217,70,239,.35)]">
            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(217,70,239,.35),transparent_65%)] px-6 pb-6 pt-8 text-center">
              <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(255,255,255,.12),transparent_45%)]" />
              <p className="relative text-[10px] font-black uppercase tracking-[.3em] text-fuchsia-200">
                ✦ Um novo vínculo foi formado ✦
              </p>
              <img
                src={claimedMascot.sprite}
                alt={claimedMascot.name}
                className="relative mx-auto mt-3 h-64 w-64 object-contain drop-shadow-[0_0_32px_rgba(232,121,249,.75)]"
              />
              <h2 className="relative text-3xl font-black text-white">
                {claimedMascot.name}
              </h2>
              <p className="relative mt-1 text-sm font-bold text-fuchsia-200">
                entrou para sua equipe!
              </p>
            </div>
            <div className="border-t border-fuchsia-300/15 p-5">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  ["FOR", claimedMascot.stats.statForce],
                  ["AGI", claimedMascot.stats.statAgility],
                  ["CAR", claimedMascot.stats.statCharisma],
                  ["INS", claimedMascot.stats.statInstinct],
                  ["VIT", claimedMascot.stats.statVitality],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-800 bg-slate-900/80 p-2"
                  >
                    <small className="block text-[9px] text-slate-500">
                      {label}
                    </small>
                    <b className="text-base text-white">{value}</b>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-950/15 p-3 text-xs text-slate-300 sm:grid-cols-3">
                <span>
                  <b className="block text-fuchsia-200">Nível</b>
                  {claimedMascot.level}
                </span>
                <span>
                  <b className="block text-fuchsia-200">Personalidade</b>
                  {PERSONALITIES.find(
                    ([value]) => value === claimedMascot.personality,
                  )?.[1] ?? claimedMascot.personality}
                </span>
                <span>
                  <b className="block text-fuchsia-200">Origem</b>
                  {claimedMascot.origin}
                </span>
              </div>
              <button
                onClick={() => setClaimedMascot(null)}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-300 py-3 text-sm font-black text-slate-950 shadow-[0_0_25px_rgba(217,70,239,.3)]"
              >
                Conhecer meu novo companheiro
              </button>
            </div>
          </section>
        </div>
      )}
      {view === "OVERVIEW" && (
        <>
          <TowerNarrative scene={data.lobbyScene} />
          <button
            type="button"
            onClick={() => setIntroKey(Date.now())}
            className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-xs font-black text-purple-200"
          >
            ▶ Abrir guia completo do evento
          </button>
        </>
      )}
      {view === "OVERVIEW" && (
        <TowerAdminSettings initial={data.config} onSaved={load} />
      )}
      {view === "ARCHIVE" && (
        <>
          <section className="rounded-2xl border border-violet-400/25 bg-violet-950/15 p-5">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-300">
              Conhecimento permanente
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              O que vai para o Arquivo da Torre?
            </h2>
            <p className="mt-3 text-xs leading-6 text-slate-300">
              O Arquivo guarda histórias, pistas de mecanismos, informações dos
              chefes e conclusões obtidas em runs anteriores. Ele é
              compartilhado: quando alguém descobre algo, todos podem consultar.
              Entradas do Arquivo ensinam e orientam decisões, mas{" "}
              <strong className="text-white">
                não concedem bônus de atributos sozinhas
              </strong>
              .
            </p>
          </section>
          <TowerKnowledge entries={data.knowledge} failures={data.failures} />
        </>
      )}
      {data.pendingMascotRewards.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-950/35 via-slate-950 to-purple-950/30 shadow-[0_0_55px_rgba(217,70,239,.15)]">
          <div className="border-b border-fuchsia-300/15 p-6">
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-fuchsia-300">
              Um rebelde decidiu acompanhar você
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Escolha a personalidade antes do nascimento
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              A origem será de Laboratório. O crescimento é simulado nível a
              nível até o Nv.55, portanto a personalidade escolhida participa de
              toda a formação dos atributos.
            </p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {data.pendingMascotRewards.map((reward) => (
              <article
                key={reward.id}
                className="relative overflow-hidden rounded-2xl border border-fuchsia-300/25 bg-black/30 p-4 text-center"
              >
                <div className="absolute inset-x-0 top-0 h-24 bg-fuchsia-500/10 blur-2xl" />
                <img
                  src={reward.sprite}
                  alt={reward.name}
                  className="relative mx-auto h-36 w-36 object-contain drop-shadow-[0_0_18px_rgba(232,121,249,.45)]"
                />
                <b className="relative block text-lg text-fuchsia-100">
                  {reward.name}
                </b>
                <select
                  value={rewardPersonalities[reward.id] ?? "LOYAL"}
                  onChange={(event) =>
                    setRewardPersonalities((current) => ({
                      ...current,
                      [reward.id]: event.target.value,
                    }))
                  }
                  className="relative mt-3 w-full rounded-xl border border-fuchsia-300/25 bg-slate-950 p-2.5 text-xs text-white"
                >
                  {PERSONALITIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await claimTowerMascotRewardAction(
                        reward.id,
                        (rewardPersonalities[reward.id] ?? "LOYAL") as never,
                      );
                      if ("error" in result) toast.error(result.error);
                      else {
                        setClaimedMascot(result.mascot);
                        load();
                      }
                    })
                  }
                  className="relative mt-3 w-full rounded-xl bg-gradient-to-r from-fuchsia-400 to-purple-400 py-2.5 text-xs font-black text-slate-950 shadow-[0_0_22px_rgba(232,121,249,.25)] disabled:opacity-40"
                >
                  ✨ Receber mascote
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {data.ranking.length > 0 && (
        <section className={card}>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#FFCB05]">
            Rankings da Torre
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {(
              [
                ["entries", "Mais expedições", "Entradas"],
                ["rescues", "Maiores resgatistas", "Resgates"],
                ["talentPoints", "Contribuição ao legado", "Pontos"],
              ] as const
            ).map(([metric, title, label]) => (
              <article
                key={metric}
                className="rounded-xl border border-slate-800 bg-black/20 p-3"
              >
                <h3 className="font-black text-white">{title}</h3>
                <div className="mt-2 space-y-1">
                  {[...data.ranking]
                    .sort((a, b) => b[metric] - a[metric])
                    .slice(0, 10)
                    .map((row, index) => (
                      <div
                        key={row.userId}
                        className="flex items-center gap-2 rounded-lg bg-slate-900/70 p-2 text-xs"
                      >
                        <b className="w-5 text-[#FFCB05]">{index + 1}º</b>
                        <span className="min-w-0 flex-1 truncate font-bold text-white">
                          {row.name}
                        </span>
                        <span className="text-slate-300">
                          {row[metric]} {label}
                        </span>
                      </div>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {data.controlledMascots.length > 0 && (
        <section className={card}>
          <p className="text-[10px] font-black uppercase tracking-widest text-red-300">
            Resgate administrativo
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.controlledMascots.map(
              (mascot) =>
                mascot && (
                  <article
                    key={mascot.id}
                    className="rounded-xl border border-red-400/20 bg-red-950/15 p-3"
                  >
                    <b className="text-sm text-white">
                      {mascot.name} · Nv.{mascot.level}
                    </b>
                    <p className="text-[10px] text-slate-400">
                      {mascot.owner} · andar {mascot.floor}
                    </p>
                    <button
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await adminReviveTowerMascotAction(
                            mascot.id,
                          );
                          if ("error" in result) toast.error(result.error);
                          else {
                            toast.success("Mascote revivido e libertado.");
                            load();
                          }
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-emerald-300/30 py-1.5 text-[10px] font-black text-emerald-200"
                    >
                      Reviver e libertar
                    </button>
                  </article>
                ),
            )}
          </div>
        </section>
      )}
      <section className={card}>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">
          Preparação entre runs
        </p>
        <h2 className="mt-1 text-lg font-black text-white">
          O conhecimento da comunidade enfraquece a Torre
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          No começo, mecanismos e objetos não explicam o que fazem. Acertos
          entram no Arquivo compartilhado. Fora da run, cada jogador pode
          estudar uma frente por dia; com 5 contribuições, a contramedida passa
          a valer nas próximas expedições.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            [
              "WARD",
              "Reforçar proteções",
              "Absorve os dois primeiros pontos de Pressão.",
            ] as const,
            [
              "INSIGHT",
              "Decifrar mecanismos",
              "Prepara pistas mais claras para enigmas descobertos.",
            ] as const,
            [
              "MAP",
              "Mapear corredores",
              "Amplia o conhecimento das rotas futuras.",
            ] as const,
          ].map(([key, title, text]) => {
            const value =
              data.communityProgress.find((entry) => entry.metricKey === key)
                ?.value ?? 0;
            return (
              <article
                key={key}
                className="rounded-xl border border-cyan-400/20 bg-cyan-950/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm text-cyan-100">{title}</b>
                  <span className="text-xs font-black text-[#FFCB05]">
                    {Math.min(5, value)}/5
                  </span>
                </div>
                <p className="mt-1 min-h-10 text-[11px] text-slate-400">
                  {text}
                </p>
                <button
                  type="button"
                  disabled={pending || value >= 5}
                  onClick={() =>
                    start(async () => {
                      const res = await contributeTowerPreparationAction(key);
                      if ("error" in res) toast.error(res.error);
                      else {
                        toast.success(
                          "Estudo registrado no Arquivo comunitário.",
                        );
                        load();
                      }
                    })
                  }
                  className="mt-3 w-full rounded-lg border border-cyan-300/30 py-2 text-[10px] font-black text-cyan-200 disabled:opacity-40"
                >
                  {value >= 5 ? "CONTRAMEDIDA LIBERADA" : "CONTRIBUIR HOJE"}
                </button>
              </article>
            );
          })}
        </div>
        {data.communityCodex.length > 0 && (
          <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-950/15 p-3">
            <b className="text-xs uppercase tracking-wider text-purple-200">
              Descobertas compartilhadas
            </b>
            {data.communityCodex.slice(0, 6).map((entry) => (
              <p key={entry.id} className="mt-2 text-xs text-slate-300">
                ✦{" "}
                {String(
                  (entry.data as { text?: string } | null)?.text ??
                    entry.subjectKey,
                )}
              </p>
            ))}
          </div>
        )}
      </section>
      <TowerNarrativeAdmin initial={data.scenes} />
      {data.controlledMascots.length > 0 && (
        <section className={card}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-300">
                Sob controle da Torre
              </p>
              <h2 className="text-lg font-black text-white">
                Mascotes aguardando resgate
              </h2>
            </div>
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-200">
              {data.controlledMascots.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Eles podem reaparecer como inimigos sob Psicose até uma Sala
            Anti-Psicose libertá-los.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.controlledMascots.map(
              (mascot) =>
                mascot && (
                  <article
                    key={mascot.id}
                    className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-950/15 p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getStaticSpriteUrl(mascot.pokemonId)}
                      alt=""
                      className="h-14 w-14 object-contain [image-rendering:pixelated]"
                    />
                    <div>
                      <b className="text-sm text-red-100">
                        {mascot.name} · Nv.{mascot.level}
                      </b>
                      <p className="text-[10px] text-slate-400">
                        Dono: {mascot.owner} · andar {mascot.floor}
                      </p>
                    </div>
                  </article>
                ),
            )}
          </div>
        </section>
      )}

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              Árvore de talentos compartilhada
            </p>
            <h2 className="text-lg font-black text-white">Legado das runs</h2>
          </div>
          <span className="rounded-full bg-[#FFCB05] px-3 py-1 text-xs font-black text-slate-950">
            {data.talents.points} disponível(is)
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Escolher um talento aplica de uma vez todos os pontos possíveis nele,
          respeitando o nível máximo 5. Assim a distribuição precisa de apenas
          uma requisição.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              [
                "PRESSURE",
                "Controle da Pressão",
                "+1 proteção inicial contra Pressão.",
              ],
              ["COMBAT", "Treino de combate", "+2% de atributos por nível."],
              ["BOSS", "Caçador de chefes", "+3% contra chefes por nível."],
              [
                "LUCK",
                "Destino dobrado",
                "Melhora futuras rerrolagens de sorte.",
              ],
              ["RESCUE", "Equipe de resgate", "Melhora salas Anti-Psicose."],
            ] as const
          ).map(([key, title, text]) => {
            const rank = Number(data.talents.ranks[key] ?? 0);
            const amount = Math.max(0, Math.min(data.talents.points, 5 - rank));
            return (
              <article
                key={key}
                className="rounded-xl border border-emerald-400/20 bg-emerald-950/10 p-3"
              >
                <div className="flex items-center justify-between">
                  <b className="text-xs text-emerald-100">{title}</b>
                  <span className="text-[10px] font-black text-[#FFCB05]">
                    Nv.{rank}/5
                  </span>
                </div>
                <p className="mt-1 min-h-10 text-[10px] text-slate-400">
                  {text}
                </p>
                <button
                  disabled={pending || amount <= 0}
                  onClick={() =>
                    start(async () => {
                      const res = await spendTowerTalentAction(key, amount);
                      if ("error" in res) toast.error(res.error);
                      else {
                        toast.success(`${res.amount} ponto(s) aplicados.`);
                        load();
                      }
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-emerald-300/25 py-1.5 text-[10px] font-black text-emerald-200 disabled:opacity-35"
                >
                  {amount > 0
                    ? `Aplicar ${amount} ponto(s) de uma vez`
                    : "Máximo ou sem pontos"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {data.rooms.length > 0 && (
        <section className={card}>
          <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">
            Salas aguardando jogadores
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Escolha seus dois mascotes e entre em uma sala. O ticket só será
            consumido quando o host iniciar.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.rooms.map((room) => (
              <article
                key={room.id}
                className="rounded-2xl border border-purple-400/25 bg-gradient-to-br from-purple-950/25 to-slate-950 p-4"
              >
                <div className="flex justify-between">
                  <div>
                    <b className="text-white">Sala {room.code}</b>
                    <p className="text-[10px] text-slate-400">
                      Dono: {room.host}
                    </p>
                  </div>
                  <span className="rounded-full bg-purple-400/10 px-2 py-1 text-xs text-purple-200">
                    {room.members.length}/3
                  </span>
                </div>
                <p className="mt-2 text-[10px] font-bold text-cyan-300">
                  {room.pace === "ONLINE"
                    ? "Online · 5 minutos por ação"
                    : "Lento · 4 horas por ação"}
                </p>
                <div className="mt-3 grid gap-2">
                  {room.members.map((m) => (
                    <div
                      key={m.userId}
                      className={`rounded-lg border p-2 ${m.ready ? "border-emerald-400/30 bg-emerald-400/10" : "border-slate-700 bg-black/20"}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="min-w-0 truncate font-bold text-slate-200">
                          {m.name}
                          {room.hostId === m.userId && <span className="ml-1 text-[8px] font-black uppercase text-[#FFCB05]">dono</span>}
                        </span>
                        <span className={m.ready ? "shrink-0 text-emerald-300" : "shrink-0 text-slate-500"}>
                          {m.ready ? "✓ Pronto" : "Preparando"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[9px] font-bold text-cyan-300">Classe: {m.roleLabel}</p>
                      {m.mascots.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {m.mascots.map((mascot, idx) => (
                            <span key={`${m.userId}-${idx}`} title={`${mascot.name} · Nv.${mascot.level} · ${getCombatRoleLabel(mascot.stance)}`} className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-[9px] text-slate-300">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-6 w-6 object-contain [image-rendering:pixelated]" />
                              <span className="max-w-20 truncate">{mascot.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  disabled={pending || picks.length !== 2 || !role}
                  onClick={() =>
                    start(async () => {
                      if (!role) return;
                      const res = await joinTowerRoomAction({
                        runId: room.id,
                        expeditionRole: role,
                        mascotIds: picks,
                        stanceByMascot: stances,
                      });
                      if ("error" in res) toast.error(res.error);
                      else {
                        toast.success("Você entrou na sala.");
                        load();
                      }
                    })
                  }
                  className="mt-3 w-full rounded-lg border border-purple-400/40 bg-purple-400/10 py-2 text-xs font-black text-purple-200 disabled:opacity-40"
                >
                  Entrar nesta sala
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Ritmo */}
      <section className={card}>
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">
          Ritmo
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">
          O <strong className="text-[#FFCB05]">Online</strong> é mais intenso e{" "}
          <strong className="text-[#FFCB05]">rende mais recompensas</strong> (Legado e
          prêmios maiores); o <strong className="text-slate-300">Lento</strong> é
          confortável, com janelas longas, porém com recompensas menores.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["ONLINE", "Online · 5 minutos por ação", "Recompensas maiores"],
              ["SLOW", "Lento · 4h por ação", "Recompensas menores"],
            ] as const
          ).map(([value, label, note]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPace(value)}
              className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors ${pace === value ? "border-[#FFCB05] bg-[#FFCB05]/15 text-[#FFCB05]" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
            >
              <span className="block">{label}</span>
              <span className={`mt-0.5 block text-[9px] font-semibold ${value === "ONLINE" ? "text-emerald-300" : "text-slate-500"}`}>{note}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Função de Expedição */}
      <section className={card}>
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">
          Função de Expedição
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">
          A Função limita as posturas que seus mascotes podem usar dentro da
          Torre.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.roles.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRole(r.key)}
              className={`rounded-xl border p-3 text-left transition-colors ${role === r.key ? "border-[#FFCB05]/60 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-600"}`}
            >
              <p className="text-xs font-black text-white">{r.label}</p>
              <p className="mt-1 text-[10px] leading-snug text-slate-400">
                {r.benefit}
              </p>
              <p className="mt-1 text-[9px] text-cyan-300">
                {r.stances.map((s) => getCombatRoleLabel(s)).join(" · ")}
              </p>
            </button>
          ))}
        </div>
        {selectedRole && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-[11px] leading-relaxed text-slate-400">
            <p><strong className="text-slate-200">Propósito:</strong> {selectedRole.exploration}</p>
            <p><strong className="text-cyan-300">Efeito:</strong> {selectedRole.benefit}</p>
            <p><strong className="text-[#FFCB05]">Como usar a seu favor:</strong> {selectedRole.gameplayTip}</p>
          </div>
        )}
      </section>

      {/* Mascotes */}
      <section className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">
            Seus 2 mascotes
          </h2>
          <span
            className={`text-xs font-bold ${picks.length === 2 ? "text-[#FFCB05]" : "text-slate-500"}`}
          >
            {picks.length}/2
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Eles entram em Survivor e carregam o estado entre combates dentro da
          Torre.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setMascotPage(1);
            }}
            placeholder="Buscar mascote pelo nome..."
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setMascotPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="ALL">Todos os tipos</option>
            {[
              "Normal",
              "Fogo",
              "Água",
              "Elétrico",
              "Planta",
              "Gelo",
              "Lutador",
              "Veneno",
              "Terra",
              "Voador",
              "Psíquico",
              "Inseto",
              "Pedra",
              "Fantasma",
              "Dragão",
              "Sombrio",
              "Aço",
              "Fada",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {data.mascots.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Nenhum mascote livre disponível. Libere mascotes (fora de
            arena/expedição/bazar) para entrar.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleMascots.map((m: Mascot) => {
              const checked = picks.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left ${checked ? "border-[#FFCB05]/50 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-600"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getStaticSpriteUrl(m.pokemonId)}
                    alt=""
                    className="h-11 w-11 shrink-0 object-contain [image-rendering:pixelated]"
                  />
                  <span className="min-w-0">
                    <strong className="block truncate text-[11px] text-white">
                      {m.name}
                    </strong>
                    <small className="text-[10px] text-slate-500">
                      Nv.{m.level}
                    </small>
                    <span className="mt-0.5 grid grid-cols-5 gap-0.5 text-[8px] font-semibold leading-tight">
                      <span className="text-red-400" title="Força">F{m.statForce}</span>
                      <span className="text-blue-400" title="Agilidade">A{m.statAgility}</span>
                      <span className="text-purple-400" title="Instinto">I{m.statInstinct}</span>
                      <span className="text-green-400" title="Vitalidade">V{m.statVitality}</span>
                      <span className="text-pink-400" title="Carisma">C{m.statCharisma}</span>
                    </span>
                    {checked && selectedRole && (
                      <select
                        value={stances[m.id] ?? selectedRole.stances[0]}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          setStances((cur) => ({
                            ...cur,
                            [m.id]: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded border border-cyan-400/30 bg-slate-950 p-1 text-[9px] text-cyan-200"
                      >
                        {selectedRole.stances.map((s) => (
                          <option key={s} value={s}>
                            {getCombatRoleLabel(s)}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {filteredMascots.length > 16 && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              disabled={mascotPage <= 1}
              onClick={() => setMascotPage((p) => p - 1)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              Página {mascotPage}/{mascotPages}
            </span>
            <button
              disabled={mascotPage >= mascotPages}
              onClick={() => setMascotPage((p) => p + 1)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30"
            >
              Próxima
            </button>
          </div>
        )}
      </section>

      <div
        className={`rounded-xl border p-3 text-xs ${!data.config.requireTicket || data.towerTicketQuantity > 0 ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}
      >
        <b>Ticket da Torre: {data.towerTicketQuantity}</b>
        <p className="mt-1 opacity-70">
          {data.config.requireTicket
            ? "O ticket não é gasto ao criar ou entrar na sala. Cada jogador gasta 1 somente quando o dono inicia a partida."
            : "A exigência de ticket está desligada pelo administrador."}
        </p>
      </div>
      <button
        type="button"
        onClick={create}
        disabled={
          pending || picks.length !== 2 || !role || Boolean(data.nextEntryAt)
        }
        className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-black text-[#1A1A2E] transition hover:bg-[#FFD700] disabled:opacity-40"
      >
        {data.nextEntryAt
          ? `Cooldown até ${new Date(data.nextEntryAt).toLocaleString("pt-BR")}`
          : pending
            ? "Criando…"
            : "🗼 Criar sala de expedição"}
      </button>
    </div>
  );
}
