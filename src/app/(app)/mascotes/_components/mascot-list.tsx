"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, MapPin, Search, Sparkles, Star, X } from "lucide-react";
import { getPokemonElement, getPokemonTypes, getPokemonName } from "@/lib/mascot-data";
import { getPreferredSpriteUrl, type PlayerSpritePreferences } from "@/lib/sprite-preferences";
import {
  claimExpeditionAction,
  collectCareAndRepeatExpeditionsAction,
  skipExpeditionAction,
  type ExpeditionRoutineResult,
} from "@/app/(app)/mascotes/actions";
import { MascotBankList } from "./mascot-bank-list-demand";
import type { BankMascot } from "./mascot-bank-list";
import { useTimerExpiry, formatRemaining } from "@/hooks/use-timer-expiry";
import { MascotCard, getOrderClueStepLabel, rewardToDisplay, type ExpeditionRewardDisplay } from "./mascot-card";

interface MascotData {
  id: string; pokemonId: number; nickname: string | null;
  level: number; exp: number; happiness: number; mood: string;
  personality: string; isEquipped: boolean; isFavorite: boolean;
  statForce: number; statAgility: number; statCharisma: number;
  statInstinct: number; statVitality: number;
  battleWins: number; battleLosses: number;
  bazarListed: boolean;
  socialCooldownUntil: Date | null;
  evolutionLocked: boolean;
  expLocked: boolean;
  operationsLocked: boolean;
  primordialBoundPlayerId?: string | null;
  isShiny: boolean;
  ivRating?: string | null;
  ivScore?: number | null;
  performanceTag?: string | null;
  activeBuffs: { type: string; expiresAt: Date }[];
  arenaState: string; injuredAt: Date | null; restingUntil: Date | null;
  relations?: Array<{ type: string; interactionCount: number; relationshipScore: number; specialBondType: string | null; mascotB: { id: string; pokemonId: number; nickname: string | null; ownerName: string; ownerId: string } }>;
  hatchedAt: Date; lastInteractedAt: Date | null; lastPlayedAt?: Date | null; lastPettedAt?: Date | null; lastFedAt: Date | null;
  expeditions: { id: string; startedAt?: Date; finishAt: Date; status: string; mode?: string }[];
  events: { id: string; emoji: string; description: string; createdAt: Date }[];
  hasFood: boolean; hasSweet: boolean;
  otherMascots?: { id: string; name: string }[];
}

const MOOD_FILTER_OPTIONS = [
  { value: "", label: "Qualquer humor" },
  { value: "HAPPY", label: "Feliz" },
  { value: "EXCITED", label: "Animado" },
  { value: "CONFIDENT", label: "Confiante" },
  { value: "NEUTRAL", label: "Neutro" },
  { value: "TIRED", label: "Cansado" },
  { value: "HUNGRY", label: "Faminto" },
  { value: "ANGRY", label: "Bravo" },
];

const TYPE_OPTIONS = [
  "normal", "fire", "water", "grass", "electric", "psychic", "fighting",
  "dark", "steel", "dragon", "fairy", "ghost", "poison", "ground", "rock",
  "flying", "bug", "ice",
];

const TYPE_LABELS: Record<string, string> = {
  normal: "Normal",
  fire: "Fogo",
  water: "Agua",
  grass: "Grama",
  electric: "Eletrico",
  psychic: "Psiquico",
  fighting: "Lutador",
  dark: "Noturno",
  steel: "Metal",
  dragon: "Dragao",
  fairy: "Fada",
  ghost: "Fantasma",
  poison: "Venenoso",
  ground: "Terra",
  rock: "Pedra",
  flying: "Voador",
  bug: "Inseto",
  ice: "Gelo",
};

const PAGE_SIZE = 12;

const EXPEDITION_MODE_LABELS: Record<string, string> = {
  TRAINING: "Treinamento",
  STANDARD: "Padrao",
  ITEMS: "Itens",
  VACATION: "Férias",
};


function MiniMascot({ mascot, spritePreferences }: { mascot: MascotData; spritePreferences?: PlayerSpritePreferences | null }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-slate-950/50 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getPreferredSpriteUrl(mascot.pokemonId, spritePreferences, { shiny: mascot.isShiny })} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-200">{mascot.nickname ?? getPokemonName(mascot.pokemonId)}</span>
        <span className="text-[10px] text-slate-500">
          Nv.{mascot.level} | {getPokemonTypes(mascot.pokemonId).map(t => TYPE_LABELS[t] ?? t).join(" / ")}
        </span>
        <span className="block text-[10px] text-slate-600">{mascot.isEquipped ? "Companheiro" : mascot.mood}</span>
      </span>
    </div>
  );
}

type ActiveExpedition = MascotData["expeditions"][number] & {
  mode: string;
  mascot: MascotData;
};

function ExpeditionProgressCard({
  expedition,
  isAdmin,
  onReward,
  spritePreferences,
}: {
  expedition: ActiveExpedition;
  isAdmin: boolean;
  onReward: (reward: ExpeditionRewardDisplay) => void;
  spritePreferences?: PlayerSpritePreferences | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { expired, remaining } = useTimerExpiry(expedition.finishAt);
  const ready = expired;
  const mascotName = expedition.mascot.nickname ?? getPokemonName(expedition.mascot.pokemonId);

  // Progresso real: quanto do tempo total (startedAt → finishAt) já passou.
  // No início a barra fica vazia e vai enchendo até 100% ao concluir.
  const totalMs = expedition.startedAt
    ? new Date(expedition.finishAt).getTime() - new Date(expedition.startedAt).getTime()
    : 0;
  const progressPct = ready
    ? 100
    : totalMs > 0
      ? Math.min(100, Math.max(0, ((totalMs - remaining) / totalMs) * 100))
      : 0;

  const collectExpedition = () => {
    startTransition(async () => {
      const result = await claimExpeditionAction(expedition.id);
      if (result.error) { toast.error(result.error); return; }
      if (result.result?.reward) {
        const display = rewardToDisplay(result.result.reward as { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; exp?: number; durationLabel?: string; shopItemType?: string });
        if (result.result.orderClue) display.orderClue = result.result.orderClue;
        onReward(display);
      } else {
        router.refresh();
      }
    });
  };

  const finishAndCollectExpedition = () => {
    startTransition(async () => {
      const skip = await skipExpeditionAction(expedition.id);
      if (skip.error) { toast.error(skip.error); return; }
      const result = await claimExpeditionAction(expedition.id);
      if (result.error) { toast.error(result.error); return; }
      if (result.result?.reward) {
        const display = rewardToDisplay(result.result.reward as { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; exp?: number; durationLabel?: string; shopItemType?: string });
        if (result.result.orderClue) display.orderClue = result.result.orderClue;
        onReward(display);
      } else {
        router.refresh();
      }
    });
  };

  return (
      <div className="rounded-xl border border-border/70 bg-slate-950/70 p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getPreferredSpriteUrl(expedition.mascot.pokemonId, spritePreferences, { shiny: expedition.mascot.isShiny })} alt="" className="h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-100">{mascotName}</p>
            <p className="text-[10px] uppercase tracking-widest text-blue-300">
              {EXPEDITION_MODE_LABELS[expedition.mode] ?? expedition.mode}
            </p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ready ? "bg-green-500/15 text-green-300" : "bg-blue-500/15 text-blue-300"}`}>
            {formatRemaining(remaining)}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${ready ? "bg-green-400" : "bg-blue-400"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending || !ready}
            onClick={collectExpedition}
            className="flex-1 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-[11px] font-semibold text-green-300 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🎁 Coletar prêmios
          </button>
          {isAdmin && !ready && (
            <button
              type="button"
              disabled={pending}
              onClick={finishAndCollectExpedition}
              className="rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-2 text-[11px] font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40"
            >
              Finalizar
            </button>
          )}
        </div>
      </div>
  );
}

export function MascotList({
  mascots,
  bankMascots = [],
  bankMascotCount,
  hasFood = false,
  hasSweet = false,
  isAdmin = false,
  spritePreferences = null,
}: {
  mascots: MascotData[];
  bankMascots?: BankMascot[];
  bankMascotCount?: number;
  hasFood?: boolean;
  hasSweet?: boolean;
  isAdmin?: boolean;
  spritePreferences?: PlayerSpritePreferences | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expeditionFilter, setExpeditionFilter] = useState("ALL");
  const [companionOnly, setCompanionOnly] = useState(false);
  const [expeditionReward, setExpeditionReward] = useState<ExpeditionRewardDisplay | null>(null);
  const [routineResults, setRoutineResults] = useState<ExpeditionRoutineResult[] | null>(null);
  const [routinePending, startRoutineTransition] = useTransition();

  const closeExpeditionReward = () => {
    setExpeditionReward(null);
    router.refresh();
  };

  const activeExpeditions = mascots.flatMap(mascot =>
    mascot.expeditions
      .filter(expedition => expedition.status === "ACTIVE")
      .map(expedition => ({
        ...expedition,
        mode: expedition.mode ?? "STANDARD",
        mascot,
      }))
  );
  const visibleExpeditions = activeExpeditions.filter(expedition =>
    expeditionFilter === "ALL" || expedition.mode === expeditionFilter
  );
  // Relógio que avança para reavaliar quais expedições ficaram prontas, para que o
  // botão "Coletar, cuidar e repetir" habilite sozinho quando o tempo acabar,
  // sem exigir atualização manual da página.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const nextPendingFinishMs = activeExpeditions.reduce<number | null>((soonest, expedition) => {
    const finish = new Date(expedition.finishAt).getTime();
    return finish > nowMs && (soonest === null || finish < soonest) ? finish : soonest;
  }, null);
  useEffect(() => {
    if (nextPendingFinishMs === null) return;
    const delay = Math.max(250, nextPendingFinishMs - Date.now() + 100);
    const timer = window.setTimeout(() => setNowMs(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [nextPendingFinishMs]);
  const readyRegularExpeditions = activeExpeditions.filter(expedition =>
    ["TRAINING", "STANDARD", "ITEMS"].includes(expedition.mode) &&
    new Date(expedition.finishAt).getTime() <= nowMs
  );

  const runExpeditionRoutine = () => {
    startRoutineTransition(async () => {
      const response = await collectCareAndRepeatExpeditionsAction();
      if (response.error && response.results.length === 0) {
        toast.error(response.error);
        return;
      }
      setRoutineResults(response.results);
    });
  };

  const isExpeditionBankMascot = (m: MascotData) =>
    !m.isEquipped && !m.isFavorite &&
    m.expeditions.some(e => e.status === "ACTIVE");

  const filtered = mascots.filter(m => {
    if (isExpeditionBankMascot(m)) return false;
    const displayName = (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase();
    const query = search.toLowerCase();
    const matchSearch = !query || displayName.includes(query) || String(m.pokemonId).includes(query) || getPokemonName(m.pokemonId).toLowerCase().includes(query);
    const matchMood = !moodFilter || m.mood === moodFilter;
    const matchType = !typeFilter || getPokemonElement(m.pokemonId) === typeFilter;
    const matchCompanion = !companionOnly || m.isEquipped;
    return matchSearch && matchMood && matchType && matchCompanion;
  });

  // Todos os mascotes filtrados aparecem como cards (não há limite de 6)
  // O server já separa: mascots (featured) e bankMascots (banco)
  const favorites = filtered.filter(m => m.isFavorite);
  const highlighted = filtered; // mostra todos os featured sem corte

  const updateSearch = (value: string) => { setSearch(value); };
  const updateMood   = (value: string) => { setMoodFilter(value); };
  const updateType   = (value: string) => { setTypeFilter(value); };

  return (
    <>
    {/* Modal de recompensa de expedição — fora dos cards para sobreviver ao desmonte */}
    {expeditionReward && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeExpeditionReward}>
        <div className="w-full max-w-xs rounded-2xl border border-[#FFCB05]/40 bg-slate-950 p-6 text-center shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
          <div className="text-6xl">{expeditionReward.emoji}</div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-white">{expeditionReward.title}</p>
            <p className="text-sm text-slate-400">{expeditionReward.description}</p>
          </div>
          {expeditionReward.orderClue && (
            <div className="rounded-xl border border-purple-400/35 bg-purple-500/10 p-3 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-200">
                Pista da Ordem encontrada
              </p>
              <p className="mt-1 text-sm font-semibold text-[#FFCB05]">
                {getOrderClueStepLabel(expeditionReward.orderClue.relatedStepKey)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-200">
                {expeditionReward.orderClue.clueText}
              </p>
              <p className="mt-2 text-[10px] text-slate-500">
                A pista entrou no painel público da investigação.
              </p>
            </div>
          )}
          <button
            onClick={closeExpeditionReward}
            className="w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-bold text-slate-900 hover:bg-[#FFD700] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    )}
    {routineResults && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => { setRoutineResults(null); router.refresh(); }}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-400/35 bg-slate-950 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black text-white">Rotina de expedições concluída</p>
              <p className="mt-1 text-xs text-slate-400">Recompensas, cuidados e reinício aparecem separados para cada mascote.</p>
            </div>
            <button type="button" onClick={() => { setRoutineResults(null); router.refresh(); }} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><X size={15} /></button>
          </div>
          <div className="mt-4 space-y-3">
            {routineResults.map(result => {
              const reward = result.reward ? rewardToDisplay(result.reward as { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; exp?: number; durationLabel?: string; shopItemType?: string }) : null;
              return (
                <div key={result.expeditionId} className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{result.mascotName}</p>
                      <p className="text-[10px] uppercase tracking-wider text-cyan-300">{EXPEDITION_MODE_LABELS[result.mode] ?? result.mode} · {result.durationKey}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${result.restarted ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                      {result.restarted ? "EXPEDIÇÃO REINICIADA" : "NÃO REINICIADA"}
                    </span>
                  </div>
                  {reward && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
                      <span className="text-3xl">{reward.emoji}</span>
                      <div><p className="text-xs font-bold text-[#FFCB05]">{reward.title}</p><p className="text-[11px] text-slate-400">{reward.description}</p></div>
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="rounded-lg bg-slate-950/70 p-2 text-[10px] text-slate-300"><b className="text-purple-300">Brincar:</b> {result.playMessage ?? "Não executado."}</p>
                    <p className="rounded-lg bg-slate-950/70 p-2 text-[10px] text-slate-300"><b className="text-pink-300">Carinho:</b> {result.petMessage ?? "Não executado."}</p>
                  </div>
                  {result.error && <p className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 p-2 text-[10px] text-red-200">{result.error}</p>}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => { setRoutineResults(null); router.refresh(); }} className="mt-4 w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-black text-slate-950">Fechar e atualizar</button>
        </div>
      </div>
    )}
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 text-xs text-slate-400">
        <p className="font-semibold text-[#FFCB05]">Mascote Companheiro e Equipe Favorita</p>
        <p className="mt-1 leading-relaxed">
          O companheiro é o mascote principal do perfil e acompanha suas partidas. A Equipe Favorita reúne até 6 mascotes para vitrine, cuidado diário, piquenique e eventos sociais.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => updateSearch(e.target.value)}
            placeholder="Buscar por nome ou #ID..."
            className="w-full rounded-xl border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
          />
        </div>
        <select value={moodFilter} onChange={e => updateMood(e.target.value)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FFCB05]">
          {MOOD_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={typeFilter} onChange={e => updateType(e.target.value)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FFCB05]">
          <option value="">Todos os tipos</option>
          {TYPE_OPTIONS.map(o => <option key={o} value={o}>{TYPE_LABELS[o]}</option>)}
        </select>
        <button type="button" onClick={() => setCompanionOnly(v => !v)}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${companionOnly ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-500 hover:text-slate-300"}`}>
          Só companheiro
        </button>
      </div>

      {activeExpeditions.length > 0 && (
        <section className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-blue-200">
                <MapPin size={15} /> Expedições em andamento
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Progresso separado por tipo. Cada card mostra o tipo da expedição e o mascote responsável.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={routinePending || readyRegularExpeditions.length === 0}
                onClick={runExpeditionRoutine}
                title="Coleta as expedições prontas, brinca, faz carinho e reinicia os mesmos trajetos."
                className="flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {routinePending ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {routinePending ? "Processando rotina..." : `Coletar, cuidar e repetir${readyRegularExpeditions.length ? ` (${readyRegularExpeditions.length})` : ""}`}
              </button>
              <select
              value={expeditionFilter}
              onChange={e => setExpeditionFilter(e.target.value)}
              className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FFCB05]"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="TRAINING">Treinamento</option>
              <option value="STANDARD">Padrao</option>
              <option value="ITEMS">Itens</option>
              <option value="VACATION">Férias</option>
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleExpeditions.map(expedition => (
              <ExpeditionProgressCard
                key={expedition.id}
                expedition={expedition}
                isAdmin={isAdmin}
                onReward={setExpeditionReward}
                spritePreferences={spritePreferences}
              />
            ))}
          </div>
          {visibleExpeditions.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-border py-5 text-center text-xs text-slate-500">
              Nenhuma expedição desse tipo esta ativa agora.
            </p>
          )}
        </section>
      )}

      {filtered.length === 0 && (bankMascotCount ?? bankMascots.length) === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-slate-500">
          Nenhum mascote encontrado com esses filtros.
        </p>
      ) : (
        <>
          {/* Equipe Favorita / Companheiro — todos os mascotes featured */}
          {highlighted.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#FFCB05]">
                  <Star size={14} fill="currentColor" />
                  {favorites.length > 0 ? "Equipe Favorita" : "Destaques"}
                </h2>
                <span className="text-[10px] text-slate-500">
                  {favorites.length > 0 ? `${favorites.length} favorito${favorites.length !== 1 ? "s" : ""}` : "sem favoritos"}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {highlighted.map(m => <MascotCard key={m.id} mascot={m} isAdmin={isAdmin} spritePreferences={spritePreferences} />)}
              </div>
            </section>
          )}

          {/* Banco — mascotes não favoritos, carregados de forma mínima */}
          {(bankMascotCount ?? bankMascots.length) > 0 && (
            <MascotBankList
              mascots={bankMascots}
              totalCount={bankMascotCount}
              hasFood={hasFood}
              hasSweet={hasSweet}
              isAdmin={isAdmin}
              spritePreferences={spritePreferences}
            />
          )}
        </>
      )}
    </div>
    </>
  );
}

