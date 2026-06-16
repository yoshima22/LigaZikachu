"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Search, Star } from "lucide-react";
import { getPokemonElement, getPokemonTypes, getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { claimExpeditionAction, skipExpeditionAction } from "@/app/(app)/mascotes/actions";
import { MascotBankList } from "./mascot-bank-list-demand";
import type { BankMascot } from "./mascot-bank-list";
import { useTimerExpiry, formatRemaining } from "@/hooks/use-timer-expiry";
import { MascotCard, rewardToDisplay, type ExpeditionRewardDisplay } from "./mascot-card";

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
  isShiny: boolean;
  activeBuffs: { type: string; expiresAt: Date }[];
  arenaState: string; injuredAt: Date | null; restingUntil: Date | null;
  relations?: Array<{ type: string; interactionCount: number; mascotB: { id: string; pokemonId: number; nickname: string | null; ownerName: string; ownerId: string } }>;
  hatchedAt: Date; lastInteractedAt: Date | null; lastPlayedAt?: Date | null; lastPettedAt?: Date | null; lastFedAt: Date | null;
  expeditions: { id: string; finishAt: Date; status: string; mode?: string }[];
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
};


function MiniMascot({ mascot }: { mascot: MascotData }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-slate-950/50 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getSpriteUrl(mascot.pokemonId, true)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
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

function ExpeditionProgressCard({ expedition, isAdmin }: { expedition: ActiveExpedition; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reward, setReward] = useState<ExpeditionRewardDisplay | null>(null);
  const { expired, remaining } = useTimerExpiry(expedition.finishAt);
  const ready = expired;
  const mascotName = expedition.mascot.nickname ?? getPokemonName(expedition.mascot.pokemonId);

  const collectExpedition = () => {
    startTransition(async () => {
      const result = await claimExpeditionAction(expedition.id);
      if (result.error) { toast.error(result.error); return; }
      if (result.result?.reward) {
        setReward(rewardToDisplay(result.result.reward as { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; exp?: number; durationLabel?: string }));
      }
      router.refresh();
    });
  };

  const finishAndCollectExpedition = () => {
    startTransition(async () => {
      const skip = await skipExpeditionAction(expedition.id);
      if (skip.error) { toast.error(skip.error); return; }
      const result = await claimExpeditionAction(expedition.id);
      if (result.error) { toast.error(result.error); return; }
      if (result.result?.reward) {
        setReward(rewardToDisplay(result.result.reward as { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; exp?: number; durationLabel?: string }));
      }
      router.refresh();
    });
  };

  return (
    <>
      {/* Modal de recompensa — idêntico ao do MascotCard */}
      {reward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setReward(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-[#FFCB05]/40 bg-slate-950 p-6 text-center shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-6xl">{reward.emoji}</div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white">{reward.title}</p>
              <p className="text-sm text-slate-400">{reward.description}</p>
            </div>
            <button
              onClick={() => setReward(null)}
              className="w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-bold text-slate-900 hover:bg-[#FFD700] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/70 bg-slate-950/70 p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getSpriteUrl(expedition.mascot.pokemonId, true)} alt="" className="h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
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
            style={{ width: ready ? "100%" : "55%" }}
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
    </>
  );
}

export function MascotList({
  mascots,
  bankMascots = [],
  bankMascotCount,
  hasFood = false,
  hasSweet = false,
  isAdmin = false,
}: {
  mascots: MascotData[];
  bankMascots?: BankMascot[];
  bankMascotCount?: number;
  hasFood?: boolean;
  hasSweet?: boolean;
  isAdmin?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expeditionFilter, setExpeditionFilter] = useState("ALL");
  const [companionOnly, setCompanionOnly] = useState(false);

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

  const filtered = mascots.filter(m => {
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
            <select
              value={expeditionFilter}
              onChange={e => setExpeditionFilter(e.target.value)}
              className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FFCB05]"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="TRAINING">Treinamento</option>
              <option value="STANDARD">Padrao</option>
              <option value="ITEMS">Itens</option>
            </select>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleExpeditions.map(expedition => (
              <ExpeditionProgressCard
                key={expedition.id}
                expedition={expedition}
                isAdmin={isAdmin}
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
                {highlighted.map(m => <MascotCard key={m.id} mascot={m} isAdmin={isAdmin} />)}
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
            />
          )}
        </>
      )}
    </div>
  );
}

