"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart, Swords, Utensils, Candy, Edit2, Check, X, MapPin, Info, Star } from "lucide-react";
import {
  getSpriteUrl, getStaticSpriteUrl, getPokemonName, expToNextLevel as expToNext,
  MOOD_EMOJI, MOOD_LABEL, PERSONALITY_LABEL,
  getHungerStatus, getHappinessStatus, getChallengeStatus,
  HUNGER_LABEL, HAPPINESS_LABEL, CHALLENGE_LABEL,
  HUNGER_COLOR, HAPPINESS_COLOR, CHALLENGE_COLOR,
} from "@/lib/mascot-data";
import {
  interactAction, equipMascotAction, unequipMascotAction,
  renameMascotAction, startExpeditionAction, claimExpeditionAction,
  skipExpeditionAction, cancelExpeditionAction, addExpAdminAction,
  adminBattleMascotsAction, adminFormFriendshipAction,
  adminTriggerSocialEventsAction,
  healMascotSusAction,
  toggleFavoriteMascotAction,
  toggleEvolutionLockAction,
  removeXpShareAction,
} from "../actions";
import { EXPEDITION_DURATIONS, TRAINING_EXP_MULT, EXP_REWARDS, getShinySprite, EVOLUTION_MAP, getPokemonName as getEvoName } from "@/lib/mascot-data";
import type { ExpeditionDuration, ExpeditionMode } from "@/lib/mascot-data";
import { MascotSpeechBubble } from "./mascot-speech-bubble";
import { useTimerExpiry, formatRemaining } from "@/hooks/use-timer-expiry";
import { PERSONALITY_DESCRIPTION } from "@/lib/mascot-data";

interface Expedition { id: string; finishAt: Date; status: string; mode?: string }
interface MascotRelation {
  type: string;
  interactionCount: number;
  mascotB: { id: string; pokemonId: number; nickname: string | null; ownerName: string; ownerId: string };
}

interface MascotEvent { id: string; emoji: string; description: string; createdAt: Date }

interface MascotData {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  exp: number;
  happiness: number;
  mood: string;
  personality: string;
  isEquipped: boolean;
  isFavorite: boolean;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
  battleWins: number;
  battleLosses: number;
  arenaState: string;
  bazarListed: boolean;
  injuredAt: Date | null;
  restingUntil: Date | null;
  hatchedAt: Date;
  lastInteractedAt: Date | null;
  lastPlayedAt?: Date | null;  // presente após migração SQL
  lastPettedAt?: Date | null;  // presente após migração SQL
  lastFedAt: Date | null;
  socialCooldownUntil: Date | null;
  evolutionLocked: boolean;
  isShiny: boolean;
  activeBuffs: { type: string; expiresAt: Date }[];
  relations?: MascotRelation[];
  expeditions: Expedition[];
  events: MascotEvent[];
  hasFood: boolean;
  hasSweet: boolean;
  // Admin: lista de outros mascotes para debug
  otherMascots?: { id: string; name: string }[];
}

interface Props { mascot: MascotData; isAdmin?: boolean; compactView?: boolean; onRefresh?: () => void }

// Map de módulo — persiste mesmo que o componente remonte (ex: router.refresh em Next.js App Router)
const _playedAt = new Map<string, number>(); // mascotId → timestamp ms
const _pettedAt = new Map<string, number>();

const LS_PET_PREFIX = "petCd_";
/** Lê o timestamp de carinho do localStorage (sobrevive a page refresh) */
function lsPetGet(mascotId: string): number {
  try { return parseInt(localStorage.getItem(LS_PET_PREFIX + mascotId) ?? "0", 10) || 0; } catch { return 0; }
}
/** Grava o timestamp de carinho no localStorage */
function lsPetSet(mascotId: string, ts: number) {
  try { localStorage.setItem(LS_PET_PREFIX + mascotId, String(ts)); } catch { /* ignorado */ }
}

const PLAY_CD_MS = 45 * 60 * 1000;
const PET_CD_MS  = 25 * 60 * 1000;

/** Marca que o mascote acabou de brincar */
export function markPlayed(mascotId: string) { _playedAt.set(mascotId, Date.now()); }
/** Marca que o mascote acabou de receber carinho (persiste no localStorage) */
export function markPetted(mascotId: string) {
  const now = Date.now();
  _pettedAt.set(mascotId, now);
  lsPetSet(mascotId, now);
}
/** Verifica se brincar está em cooldown agora */
export function isPlayOnCooldown(mascotId: string, nowMs: number): boolean {
  const t = _playedAt.get(mascotId) ?? 0;
  return t > 0 && t + PLAY_CD_MS > nowMs;
}
/** Verifica se carinho está em cooldown agora */
export function isPetOnCooldown(mascotId: string, nowMs: number): boolean {
  const t = _pettedAt.get(mascotId) ?? 0;
  return t > 0 && t + PET_CD_MS > nowMs;
}
/** Tempo restante de cooldown de brincar em ms */
export function playRemainingMs(mascotId: string, nowMs: number): number {
  const t = _playedAt.get(mascotId) ?? 0;
  return Math.max(0, t + PLAY_CD_MS - nowMs);
}
/** Tempo restante de cooldown de carinho em ms */
export function petRemainingMs(mascotId: string, nowMs: number): number {
  const t = _pettedAt.get(mascotId) ?? 0;
  return Math.max(0, t + PET_CD_MS - nowMs);
}

// Tooltip component
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-slate-900 px-2.5 py-1.5 text-[10px] text-slate-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        {text}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

// Countdown de expedição (tempo restante, atualizado a cada segundo)
function ExpeditionCountdown({ finishAt }: { finishAt: Date }) {
  // Inicializa com 0 para evitar hydration mismatch (server vs client Date.now())
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    // Atualiza imediatamente após montar (evita hydration mismatch)
    setRemaining(Math.max(0, new Date(finishAt).getTime() - Date.now()));
    const iv = setInterval(() => {
      const r = Math.max(0, new Date(finishAt).getTime() - Date.now());
      setRemaining(r);
      if (r === 0) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [finishAt]);

  if (remaining === 0) return <span className="text-green-400 font-semibold">Pronto para coletar! 🎁</span>;
  const totalMin = Math.floor(remaining / 60000);
  const hours    = Math.floor(totalMin / 60);
  const mins     = totalMin % 60;
  const secs     = Math.floor((remaining % 60000) / 1000);
  return (
    <span>
      {hours > 0 ? `${hours}h ` : ""}{String(mins).padStart(2,"0")}m {String(secs).padStart(2,"0")}s
    </span>
  );
}

// Status pill
function StatusPill({ label, color, size = "normal" }: { label: string; color: string; size?: "sm" | "normal" }) {
  return (
    <span className={`font-semibold ${color} ${size === "sm" ? "text-[10px]" : "text-[11px]"}`}>{label}</span>
  );
}

function arenaStatus(mascot: MascotData) {
  const restingUntil = mascot.restingUntil ? new Date(mascot.restingUntil) : null;
  const restingActive = mascot.arenaState === "RESTING" && restingUntil && restingUntil > new Date();
  if (mascot.arenaState === "INJURED") {
    return {
      locked: true,
      tone: "border-red-500/30 bg-red-500/10 text-red-200",
      label: "Ferido - Atendimento SUS",
      detail: mascot.injuredAt ? `Ferido desde ${new Date(mascot.injuredAt).toLocaleString("pt-BR")}. Use Atendimento SUS para iniciar recuperacao.` : "Precisa de Atendimento SUS.",
    };
  }
  if (restingActive) {
    return {
      locked: true,
      tone: "border-blue-500/30 bg-blue-500/10 text-blue-200",
      label: "Recuperando",
      detail: `Volta ao banco apos ${restingUntil.toLocaleString("pt-BR")}.`,
    };
  }
  if (mascot.arenaState === "ARENA") {
    return {
      locked: true,
      tone: "border-[#FFCB05]/30 bg-[#FFCB05]/10 text-[#FFCB05]",
      label: "Na Arena Z",
      detail: "Retire a equipe da Arena Z para liberar interacoes e expedicoes.",
    };
  }
  if (mascot.arenaState === "RESTING") {
    return {
      locked: false,
      tone: "border-green-500/30 bg-green-500/10 text-green-200",
      label: "Repouso concluido",
      detail: "Mascote ja pode voltar para atividades.",
    };
  }
  // FREE + restingUntil no futuro = cooldown de re-entrada na arena
  if (mascot.arenaState === "FREE" && restingUntil && restingUntil > new Date()) {
    const remMin = Math.ceil((restingUntil.getTime() - Date.now()) / 60_000);
    return {
      locked: false,
      tone: "border-orange-500/30 bg-orange-500/10 text-orange-200",
      label: `⏳ Cooldown Arena (${remMin}min)`,
      detail: `Pode voltar à Arena em ${restingUntil.toLocaleString("pt-BR")}. Livre para todas as outras atividades.`,
    };
  }
  return null;
}

export interface ExpeditionRewardDisplay {
  emoji: string;
  title: string;
  description: string;
}

export function rewardToDisplay(reward: { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; exp?: number; durationLabel?: string }): ExpeditionRewardDisplay {
  if (reward.type === "TRAINING") {
    const exp = reward.exp ?? 0;
    const dur = reward.durationLabel ?? "";
    return {
      emoji: "🏋️",
      title: `Treinamento de ${dur} concluído!`,
      description: `+${exp.toLocaleString("pt-BR")} EXP recebido. Nenhum item — isso é esperado no modo Treinamento.`,
    };
  }
  if (reward.type === "EGG") {
    const label = reward.eggType === "RARE" ? "Raro" : reward.eggType === "SPECIAL" ? "Especial" : "Comum";
    return { emoji: "🥚", title: `Ovo ${label} encontrado!`, description: "Seu mascote voltou com um ovo misterioso." };
  }
  if (reward.type === "FOOD") {
    if (reward.foodType === "SWEET") return { emoji: "🍬", title: "Doce encontrado!", description: `${reward.quantity ?? 1}x Doce de Mascote` };
    return { emoji: "🍖", title: "Comida encontrada!", description: `${reward.quantity ?? 1}x Comida de Mascote` };
  }
  if (reward.type === "COINS") {
    return { emoji: "🪙", title: `${reward.amount} ZikaCoins encontrados!`, description: "Adicionados à sua carteira." };
  }
  return { emoji: "😔", title: "Voltou de mãos vazias...", description: "Desta vez não encontrou nada." };
}

const BUFF_DISPLAY: Record<string, { emoji: string; label: string; color: string; permanent?: boolean; areas?: string }> = {
  EXP_BOOST:       { emoji: "⚡",   label: "EXP ×2",         color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300", areas: "Expedição ✓ · Arena ✓ · Interações ✓ · Férias ✗" },
  LUCK_BOOST:      { emoji: "🍀",   label: "Sorte",           color: "border-green-500/40 bg-green-500/10 text-green-300" },
  STAT_BOOST:      { emoji: "💊",   label: "Proteína Zika",   color: "border-purple-500/40 bg-purple-500/10 text-purple-300", permanent: true },
  LUCKY_EGG:       { emoji: "🥚✨", label: "Ovo da Sorte",    color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-200", areas: "Expedição ✓ · Arena ✗ · Interações ✗" },
  WEAKNESS_POLICY: { emoji: "🛡️",  label: "Política Fraqueza", color: "border-blue-500/40 bg-blue-500/10 text-blue-300", permanent: true },
  PICNIC_BASKET:   { emoji: "🧺",   label: "Piquenique +10%", color: "border-orange-500/40 bg-orange-500/10 text-orange-300", areas: "Expedição ✓ · Arena ✓ · Interações ✓ · Férias ✗" },
  XP_SHARE:        { emoji: "📡",   label: "Comp. XP",        color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300", permanent: true },
};

function ActiveBuffBadge({ type, expiresAt }: { type: string; expiresAt: Date }) {
  const { remaining, expired } = useTimerExpiry(expiresAt);
  if (expired) return null;
  const info = BUFF_DISPLAY[type] ?? { emoji: "✨", label: type, color: "border-blue-500/40 bg-blue-500/10 text-blue-300" };
  const isPermanent = info.permanent || expiresAt.getFullYear() >= 2090;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  const timeStr = isPermanent
    ? "Permanente"
    : h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : m > 0 ? `${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s` : `${s}s`;
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border px-2 py-1 text-[10px] font-semibold ${info.color}`}>
      <span className="flex items-center gap-1">
        {info.emoji} {info.label} <span className="opacity-70">{timeStr}</span>
      </span>
      {info.areas && (
        <span className="text-[9px] opacity-60 font-normal">{info.areas}</span>
      )}
    </div>
  );
}

export function MascotCard({ mascot, isAdmin = false, compactView = false, onRefresh }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(mascot.nickname ?? "");
  const [imgFailed, setImgFailed] = useState(false);
  const [expeditionReward, setExpeditionReward] = useState<ExpeditionRewardDisplay | null>(null);
  const [expeditionDuration, setExpeditionDuration] = useState<ExpeditionDuration>("1h");
  const [expeditionMode, setExpeditionMode] = useState<ExpeditionMode>("STANDARD");
  const [showLootPreview, setShowLootPreview] = useState(false);
  const [showRelations, setShowRelations] = useState(false);

  // Estado otimista — reflete mudanças localmente antes do re-render do servidor
  const [localHappiness, setLocalHappiness] = useState(mascot.happiness);
  const [localMood, setLocalMood]           = useState(mascot.mood);
  const [localExp, setLocalExp]             = useState(mascot.exp);
  const [localLevel, setLocalLevel]         = useState(mascot.level);
  const [localLastFed, setLocalLastFed]     = useState(mascot.lastFedAt);

  // Sincroniza com novas props quando servidor atualiza
  useEffect(() => { setLocalHappiness(mascot.happiness); }, [mascot.happiness]);
  useEffect(() => { setLocalMood(mascot.mood); },           [mascot.mood]);
  useEffect(() => { setLocalExp(mascot.exp); },             [mascot.exp]);
  useEffect(() => { setLocalLevel(mascot.level); },         [mascot.level]);
  useEffect(() => { setLocalLastFed(mascot.lastFedAt); },   [mascot.lastFedAt]);
  // (seed do Map movido para depois do useState de nowMs — veja abaixo)

  const events = Array.isArray(mascot.events) ? mascot.events : [];
  const expeditions = Array.isArray(mascot.expeditions) ? mascot.expeditions : [];
  const otherMascots = Array.isArray(mascot.otherMascots) ? mascot.otherMascots : [];
  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const expedition = expeditions.find(e => e.status === "ACTIVE");
  // useTimerExpiry: atualiza automaticamente quando a expedição termina
  const expeditionExpiry = useTimerExpiry(expedition?.finishAt ?? null);
  const claimable = !!expedition && expeditionExpiry.expired;
  const expNeeded  = Math.max(1, expToNext(localLevel));
  const expPct     = Math.min(100, Math.max(0, Math.round((localExp / expNeeded) * 100)));

  // Derived status — usa estado local otimista
  const hungerStatus    = getHungerStatus(localLastFed);
  const happinessStatus = getHappinessStatus(localHappiness);
  const challengeStatus = getChallengeStatus(localMood);
  const arena = arenaStatus(mascot);
  const arenaLocked = !!arena?.locked;

  // Tick local — atualiza a cada segundo para que cooldowns reflitam imediatamente após a interação
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Semeia o Map de cooldown a partir do servidor (sobrevive a refresh de página)
  // Prioriza lastPlayedAt (quando disponível após migração), cai para lastInteractedAt como proxy
  // Chama setNowMs para forçar re-render e aplicar o cooldown imediatamente na UI
  useEffect(() => {
    const ts = mascot.lastPlayedAt
      ? new Date(mascot.lastPlayedAt).getTime()
      : mascot.lastInteractedAt
        ? new Date(mascot.lastInteractedAt).getTime()
        : 0;
    if (ts > 0 && ts > (_playedAt.get(mascot.id) ?? 0)) {
      _playedAt.set(mascot.id, ts);
      setNowMs(Date.now()); // força re-render para refletir cooldown na UI
    }
  }, [mascot.id, mascot.lastPlayedAt, mascot.lastInteractedAt]);
  // Semeia cooldown de carinho a partir do localStorage (persiste entre refreshes)
  useEffect(() => {
    const ts = lsPetGet(mascot.id);
    if (ts > 0 && ts > (_pettedAt.get(mascot.id) ?? 0)) {
      _pettedAt.set(mascot.id, ts);
      setNowMs(Date.now());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascot.id]); // roda só na montagem — localStorage é lido uma vez por componente

  // Cooldowns independentes — lidos do Map de módulo (sobrevive a remounts)
  const playEndMs = (_playedAt.get(mascot.id) ?? 0) + PLAY_CD_MS;
  const petEndMs  = (_pettedAt.get(mascot.id) ?? 0) + PET_CD_MS;
  const playOnCooldown = (_playedAt.get(mascot.id) ?? 0) > 0 && playEndMs > nowMs;
  const petOnCooldown  = (_pettedAt.get(mascot.id) ?? 0) > 0 && petEndMs  > nowMs;
  const playCooldownRemaining = Math.max(0, playEndMs - nowMs);
  const petCooldownRemaining  = Math.max(0, petEndMs  - nowMs);

  // Button availability — usa estado otimista local (localMood, localHappiness)
  const inExpedition = !!expedition && !claimable;
  const canPlay      = !arenaLocked && !inExpedition && !playOnCooldown && localMood !== "TIRED" && localMood !== "ANGRY";
  const canPet       = !arenaLocked && !inExpedition && !petOnCooldown && localMood !== "ANGRY" && !(mascot.personality === "TIMID" && localHappiness < 40);
  const canFeedFood  = !arenaLocked && mascot.hasFood  && hungerStatus !== "STUFFED"; // comida permitida em expedição
  const canFeedSweet = !arenaLocked && !inExpedition && mascot.hasSweet && hungerStatus !== "STUFFED";

  const act = (fn: () => Promise<{ error?: string; result?: unknown }>, successMsg?: string) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        if (successMsg) toast.success(successMsg);
        router.refresh(); // atualiza contadores de inventário e status no servidor
      }
    });
  };

  const handleRename = () => {
    if (!nameInput.trim()) return;
    act(() => renameMascotAction(mascot.id, nameInput), "Nome salvo!");
    setEditingName(false);
  };

  const handleFavorite = () => {
    startTransition(async () => {
      const r = await toggleFavoriteMascotAction(mascot.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success(mascot.isFavorite ? "Removido dos favoritos." : "Mascote favoritado!");
        router.refresh();
      }
    });
  };

  const handleInteract = (type: "PLAY" | "PET" | "FEED_FOOD" | "FEED_SWEET") => {
    startTransition(async () => {
      const r = await interactAction(mascot.id, type);
      if (r.error) { toast.error(r.error); return; }
      if (r.result) {
        // Ação recusada por personalidade/humor (ex: tímido, raiva)
        if (r.result.refused) {
          toast.info(r.result.message);
          return;
        }
        // Ação bloqueada por cooldown ou expedição — não aplica estado, não marca timer
        if (!r.result.success) {
          toast.info(r.result.message);
          // Refresh para ressincronizar lastInteractedAt e mostrar cooldown correto
          router.refresh();
          return;
        }
        toast.success(r.result.message);
        // Atualização otimista imediata — não espera re-render do servidor
        const happChange = r.result.happinessChange ?? 0;
        const expChange  = r.result.expGained ?? 0;
        setLocalHappiness(h => Math.min(100, Math.max(0, h + happChange)));
        if (r.result.newMood) setLocalMood(r.result.newMood as string);
        // EXP otimista — avança barra imediatamente; pode subir de nível (simplificado)
        if (expChange > 0) {
          setLocalExp(prev => {
            let exp = prev + expChange;
            let lvl = localLevel;
            while (exp >= expToNext(lvl)) { exp -= expToNext(lvl); lvl++; }
            setLocalLevel(lvl);
            return exp;
          });
        }
        if (type === "FEED_FOOD" || type === "FEED_SWEET") setLocalLastFed(new Date());
        // Grava no Map de módulo — persiste mesmo que o componente remonte
        if (type === "PLAY") { markPlayed(mascot.id); setNowMs(Date.now()); }
        if (type === "PET")  { markPetted(mascot.id); setNowMs(Date.now()); }
        // Re-render server para atualizar inventário e EXP
        router.refresh();
        onRefresh?.();
      }
    });
  };

  const spriteUrl = imgFailed
    ? (mascot.isShiny ? getShinySprite(mascot.pokemonId) : getStaticSpriteUrl(mascot.pokemonId))
    : (mascot.isShiny ? getShinySprite(mascot.pokemonId, true) : getSpriteUrl(mascot.pokemonId, true));

  const STATS = [
    { key: "statForce",    label: "Força",      emoji: "💪", value: mascot.statForce,    tip: "Poder em brigas com rivais e expedições pesadas" },
    { key: "statAgility",  label: "Agilidade",  emoji: "⚡", value: mascot.statAgility,  tip: "Eficiência em expedições e iniciativa em brigas" },
    { key: "statCharisma", label: "Carisma",    emoji: "💛", value: mascot.statCharisma, tip: "Chance de fazer amigos e receber mais presentes" },
    { key: "statInstinct", label: "Instinto",   emoji: "🔍", value: mascot.statInstinct, tip: "Encontra itens mais raros em expedições" },
    { key: "statVitality", label: "Vitalidade", emoji: "🛡",  value: mascot.statVitality, tip: "Resiste melhor a humor ruim e efeitos negativos" },
  ];

  return (
    <>
    {/* Expedition reward modal */}
    {expeditionReward && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setExpeditionReward(null)}>
        <div className="w-full max-w-xs rounded-2xl border border-[#FFCB05]/40 bg-slate-950 p-6 text-center shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
          <div className="text-6xl">{expeditionReward.emoji}</div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-white">{expeditionReward.title}</p>
            <p className="text-sm text-slate-400">{expeditionReward.description}</p>
          </div>
          <button
            onClick={() => setExpeditionReward(null)}
            className="w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-bold text-slate-900 hover:bg-[#FFD700] transition-colors">
            Fechar
          </button>
        </div>
      </div>
    )}
    {/* Loot preview modal */}
    {showLootPreview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowLootPreview(false)}>
        <div className="w-full max-w-sm rounded-2xl border border-blue-500/30 bg-slate-950 p-5 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">🎁 Possível Loot em Expedições</p>
            <button onClick={() => setShowLootPreview(false)} className="text-slate-500 hover:text-slate-300"><X size={14}/></button>
          </div>
          <p className="text-[11px] text-slate-500">Baseado em Instinto {mascot.statInstinct} · Nível {mascot.level}</p>
          <div className="space-y-3">
            {(Object.entries(EXPEDITION_DURATIONS) as [ExpeditionDuration, typeof EXPEDITION_DURATIONS[ExpeditionDuration]][]).map(([key, dur]) => {
              if (key === "7d") return null;
              const luck = mascot.statInstinct + Math.floor(mascot.level / 10);
              const eggChance   = Math.min(35, 5 + luck * 0.3 + dur.rewardBonus * 0.3).toFixed(0);
              const sweetChance = Math.min(25, 12 + dur.rewardBonus * 0.3).toFixed(0);
              const coinMin = 50 + dur.rewardBonus * 5;
              const coinMax = coinMin + 150 + dur.rewardBonus * 10;
              const eggQuality = key === "6h" ? "🥚 Especial/Raro" : key === "3h" ? "🥚 Raro/Comum" : "🥚 Comum";
              // EXP de treinamento: base × mult × levelMult (sem aliados/lucky egg = mínimo; com 3 aliados + lucky egg = máximo)
              const levelMult = 1 + Math.floor(mascot.level / 20) * 0.25;
              const expMult = TRAINING_EXP_MULT[key as ExpeditionDuration] ?? 0;
              const expMin = Math.round(EXP_REWARDS.EXPEDITION * expMult * levelMult);
              const expMax = Math.round(EXP_REWARDS.EXPEDITION * expMult * levelMult * 1.3 * 1.2); // +3 aliados (+30%) + lucky egg (+20%)
              return (
                <div key={key} className="rounded-xl border border-border/50 bg-slate-900/60 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-blue-400">{dur.label}</p>
                  <div className="mb-1 rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-1 text-[10px]">
                    <span className="text-green-400">⚔️ Treinamento: </span>
                    <strong className="text-green-200">{expMin.toLocaleString("pt-BR")}–{expMax.toLocaleString("pt-BR")} EXP</strong>
                    <span className="ml-1 text-slate-500">(max com aliados + Lucky Egg)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                    <span>🥚 Ovo: <strong className="text-slate-200">~{eggChance}%</strong> ({eggQuality.split(" ")[1]})</span>
                    <span>🍬 Doce: <strong className="text-slate-200">~{sweetChance}%</strong></span>
                    <span>🍖 Comida: <strong className="text-slate-200">~30%</strong></span>
                    <span>🪙 Moedas: <strong className="text-slate-200">{coinMin}–{coinMax} ZC</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600">Amuleto da Sorte dobra todas as chances de loot.</p>
        </div>
      </div>
    )}

    <div className={`rounded-2xl border bg-slate-950/60 transition-all ${mascot.isEquipped ? "border-[#FFCB05]/50 ring-1 ring-[#FFCB05]/20" : "border-border"}`}>
      {mascot.isEquipped && (
        <div className="bg-[#FFCB05]/10 border-b border-[#FFCB05]/20 px-3 py-1 text-center text-[10px] font-semibold text-[#FFCB05] uppercase tracking-wider flex items-center justify-center gap-2">
          ★ Mascote equipado
          {mascot.isShiny && <span className="text-purple-300">✨ Shiny</span>}
        </div>
      )}
      {!mascot.isEquipped && mascot.isShiny && (
        <div className="bg-purple-500/10 border-b border-purple-500/20 px-3 py-1 text-center text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
          ✨ Shiny
        </div>
      )}

      {/* Status badges */}
      {(mascot.bazarListed || mascot.arenaState !== "FREE" || (mascot.socialCooldownUntil && new Date(mascot.socialCooldownUntil) > new Date())) && (
        <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-4 py-2 bg-slate-900/30">
          {mascot.bazarListed && (
            <span className="flex items-center gap-1 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-0.5 text-[9px] font-semibold text-[#FFCB05]">
              🛒 No Bazar
            </span>
          )}
          {mascot.arenaState === "ARENA" && (
            <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-300">
              ⚔️ Na Arena Z
            </span>
          )}
          {mascot.arenaState === "INJURED" && (
            <span className="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[9px] font-semibold text-orange-300">
              🤕 Ferido
            </span>
          )}
          {mascot.arenaState === "RESTING" && (
            <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-300">
              💤 Em Repouso
            </span>
          )}
          {mascot.socialCooldownUntil && new Date(mascot.socialCooldownUntil) > new Date() && (
            <span className="flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[9px] font-semibold text-purple-300">
              😵 Atordoado por rival
            </span>
          )}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Sprite + Nome */}
        <div className="flex items-center gap-4">
          <div className="group relative shrink-0 flex h-[72px] w-[72px] cursor-help items-center justify-center">
            {/* Speech bubble on hover */}
            <MascotSpeechBubble
              mood={mascot.mood} happiness={mascot.happiness}
              personality={mascot.personality}
              lastFedAt={mascot.lastFedAt} lastInteractedAt={mascot.lastInteractedAt}
              battleWins={mascot.battleWins}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spriteUrl}
              alt={name}
              width={72} height={72}
              className="object-contain drop-shadow-[0_0_8px_rgba(255,203,5,0.3)]"
              style={{ imageRendering: "pixelated" }}
              onError={() => setImgFailed(true)}
            />
            <span className="absolute -top-1 -right-1 text-base leading-none select-none">
              {MOOD_EMOJI[mascot.mood] ?? "😐"}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input value={nameInput} onChange={e => setNameInput(e.target.value)} maxLength={20}
                  className="flex-1 rounded-lg border border-[#FFCB05]/40 bg-slate-900 px-2 py-1 text-sm text-white outline-none"
                  autoFocus onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingName(false); }} />
                <button onClick={handleRename} className="text-[#FFCB05]"><Check size={14}/></button>
                <button onClick={() => setEditingName(false)} className="text-slate-500"><X size={14}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white truncate">{name}</span>
                <button
                  type="button"
                  onClick={handleFavorite}
                  disabled={pending}
                  className={`shrink-0 transition-colors ${mascot.isFavorite ? "text-[#FFCB05]" : "text-slate-600 hover:text-[#FFCB05]"}`}
                  title={mascot.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <Star size={12} fill={mascot.isFavorite ? "currentColor" : "none"} />
                </button>
                <button onClick={() => setEditingName(true)} className="text-slate-600 hover:text-slate-400"><Edit2 size={11}/></button>
              </div>
            )}
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              #{mascot.pokemonId} ·{" "}
              <Tip text={PERSONALITY_DESCRIPTION[mascot.personality] ?? ""}>
                <span className="underline decoration-dotted cursor-help">
                  {PERSONALITY_LABEL[mascot.personality]}
                </span>
              </Tip>
              {" "}· Nv. {localLevel}
            </div>
            {/* Battle record */}
            {(mascot.battleWins > 0 || mascot.battleLosses > 0) && (
              <div className="text-[9px] text-slate-600">
                ⚔️ {mascot.battleWins}V {mascot.battleLosses}D em batalhas
              </div>
            )}

            {arena && (
              <div className={`mt-1 rounded-lg border px-2 py-1 text-[10px] ${arena.tone}`}>
                <p className="font-semibold">{arena.label}</p>
                <p className="text-[9px] opacity-80">{arena.detail}</p>
              </div>
            )}

            {/* EXP bar */}
            <div className="space-y-0.5 pt-0.5">
              <div className="flex justify-between text-[9px] text-slate-600">
                <span>EXP</span><span>{localExp}/{expNeeded}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#FFCB05] to-[#FFD700] transition-all" style={{ width: `${expPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Barras de status ── */}
        <div className="rounded-xl border border-border/50 bg-slate-900/40 p-3 space-y-2.5">
          {/* Felicidade */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-500 flex items-center gap-1"><Heart size={9}/> Felicidade</span>
              <StatusPill label={HAPPINESS_LABEL[happinessStatus]} color={HAPPINESS_COLOR[happinessStatus]} size="sm" />
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${mascot.happiness}%`,
                  background: mascot.happiness >= 60 ? "#4ade80" : mascot.happiness >= 30 ? "#fb923c" : "#ef4444"
                }} />
            </div>
          </div>

          {/* Status em linha */}
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="rounded-lg bg-slate-800/60 py-1.5 px-1">
              <p className="text-[8px] text-slate-600 uppercase tracking-wide">Fome</p>
              <StatusPill label={HUNGER_LABEL[hungerStatus]} color={HUNGER_COLOR[hungerStatus]} size="sm" />
            </div>
            <div className="rounded-lg bg-slate-800/60 py-1.5 px-1">
              <p className="text-[8px] text-slate-600 uppercase tracking-wide">Humor</p>
              <span className={`text-[11px] font-semibold ${mascot.mood === "CONFIDENT" ? "text-[#FFCB05]" : "text-slate-300"}`}>
                {MOOD_LABEL[mascot.mood] ?? mascot.mood}
              </span>
            </div>
            <div className="rounded-lg bg-slate-800/60 py-1.5 px-1">
              <p className="text-[8px] text-slate-600 uppercase tracking-wide">Desafio</p>
              <StatusPill label={CHALLENGE_LABEL[challengeStatus]} color={CHALLENGE_COLOR[challengeStatus]} size="sm" />
            </div>
          </div>
        </div>

        {/* ── Buffs ativos ── */}
        {mascot.activeBuffs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mascot.activeBuffs.map((buff, i) => (
              buff.type === "XP_SHARE" ? (
                <span key={i} className="flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                  📡 Comp. XP <span className="opacity-70">Permanente</span>
                  <button
                    type="button"
                    title="Remover Compartilhador de XP"
                    className="ml-1 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 px-1 leading-none"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Remover Compartilhador de XP deste mascote?")) return;
                      startTransition(async () => {
                        const r = await removeXpShareAction(mascot.id);
                        if (r.error) toast.error(r.error);
                        else { toast.success("Compartilhador de XP removido. 📡"); router.refresh(); }
                      });
                    }}
                  >✕</button>
                </span>
              ) : (
                <ActiveBuffBadge key={i} type={buff.type} expiresAt={buff.expiresAt} />
              )
            ))}
          </div>
        )}

        {/* ── Stats ── */}
        {!compactView && <div className="space-y-1.5">
          {STATS.map(s => (
            <Tip key={s.key} text={s.tip}>
              <div className="flex items-center gap-2">
                <span className="w-4 text-center text-xs shrink-0">{s.emoji}</span>
                <span className="w-16 text-[10px] text-slate-500 shrink-0">{s.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-500 transition-all" style={{ width: `${Math.min(100, Math.round((s.value / 250) * 100))}%` }} />
                </div>
                <span className="w-7 text-right text-[10px] font-bold text-slate-400 shrink-0">{s.value}</span>
                <Info size={9} className="text-slate-700 shrink-0" />
              </div>
            </Tip>
          ))}
        </div>}

        {/* ── Expedição ativa ── */}
        {expedition && !claimable && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
              <MapPin size={12} className="shrink-0" />
              <span>
                {(() => {
                  const mode = expedition.mode;
                  const modeLabel = mode === "TRAINING" ? "🏋️ Treinamento" : mode === "ITEMS" ? "📦 Itens" : "🗺 Padrão";
                  return <><strong className="text-blue-300">{modeLabel}</strong> — falta </>;
                })()}
                <ExpeditionCountdown finishAt={new Date(expedition.finishAt)} />
              </span>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm("Cancelar a expedição? O mascote volta sem recompensa.")) return;
                act(() => cancelExpeditionAction(expedition.id), "Expedição cancelada.");
              }}
              className="w-full rounded-xl border border-red-500/20 bg-red-500/5 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-40"
            >
              ✕ Cancelar expedição (sem recompensa)
            </button>
          </div>
        )}
        {claimable && expedition && (
          <button type="button" disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const r = await claimExpeditionAction(expedition.id);
                if (r.error) { toast.error(r.error); return; }
                if (r.result?.reward) {
                  setExpeditionReward(rewardToDisplay(r.result.reward as { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number }));
                }
                router.refresh();
              });
            }}
            className="w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 animate-pulse">
            🎁 Coletar presente da expedição!
          </button>
        )}

        {mascot.arenaState === "INJURED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Usar Atendimento SUS por 10 ZC e colocar este mascote em repouso?")) return;
              act(() => healMascotSusAction(mascot.id), "Atendimento SUS concluido.");
            }}
            className="w-full rounded-xl border border-red-400/40 bg-red-500/10 py-2 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-40"
          >
            Atendimento SUS - 10 ZC
          </button>
        )}

        {/* ── Ações ── */}
        <div className="grid grid-cols-2 gap-1.5">
          <Tip text={!canPlay ? (localMood === "TIRED" ? "Está cansado demais" : localMood === "ANGRY" ? "Está bravo" : playOnCooldown ? "Brincar ainda está em cooldown" : "Indisponível agora") : mascot.isEquipped ? "Brincar aumenta felicidade e dá EXP. +50% EXP bônus de mascote ativo. Cooldown: 45 min." : mascot.isFavorite ? "Brincar aumenta felicidade e dá EXP. +25% EXP bônus de favorito. Cooldown: 45 min." : "Brincar aumenta felicidade e dá EXP base. Cooldown: 45 min."}>
            <button type="button" disabled={pending || !canPlay} onClick={() => handleInteract("PLAY")}
              className="flex w-full flex-col items-center justify-center rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
              <span>⭐ Brincar</span>
              {playOnCooldown && <span className="text-[9px] text-slate-500 mt-0.5">{formatRemaining(playCooldownRemaining)}</span>}
            </button>
          </Tip>
          <Tip text={!canPet ? (localMood === "ANGRY" ? "Está bravo, não quer carinho" : petOnCooldown ? "Carinho ainda está em cooldown" : "Pode recusar o carinho agora") : `Carinho fortalece o vínculo gradualmente. Cooldown: 25 min. Menos intenso que brincar, mas cresce com o nível. Leal ganha bônus. Pode ser recusado por tímidos e bravos.`}>
            <button type="button" disabled={pending || !canPet} onClick={() => handleInteract("PET")}
              className="flex w-full flex-col items-center justify-center rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="flex items-center gap-1"><Heart size={12}/> Carinho</span>
              {petOnCooldown && <span className="text-[9px] text-slate-500 mt-0.5">{formatRemaining(petCooldownRemaining)}</span>}
            </button>
          </Tip>
          <Tip text={!canFeedFood ? (hungerStatus === "STUFFED" ? "Já está empanturrado" : "Sem comida no estoque") : "Comida sacia por mais tempo — funciona mesmo em expedição"}>
            <button type="button" disabled={pending || !canFeedFood} onClick={() => handleInteract("FEED_FOOD")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
              <Utensils size={12}/> Comida
            </button>
          </Tip>
          <Tip text={!canFeedSweet ? (hungerStatus === "STUFFED" ? "Já está empanturrado" : !mascot.hasSweet ? "Sem doces no estoque" : "Em expedição") : "Doce: bônus de EXP e anima o mascote"}>
            <button type="button" disabled={pending || !canFeedSweet} onClick={() => handleInteract("FEED_SWEET")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
              <Candy size={12}/> Doce
            </button>
          </Tip>
        </div>

        {/* ── Expedição + Equipar/Desequipar ── */}
        <div className="flex gap-2">
          {!arenaLocked && !expedition && (
            <div className="flex-1 space-y-1.5">
              <div className="flex gap-1">
                {(["STANDARD", "TRAINING", "ITEMS"] as const).map(m => (
                  <button key={m} type="button" onClick={() => setExpeditionMode(m)}
                    className={`flex-1 rounded-lg border py-1 text-[10px] font-semibold transition-colors ${
                      expeditionMode === m
                        ? m === "TRAINING" ? "border-purple-500/40 bg-purple-500/10 text-purple-400" : m === "ITEMS" ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-blue-500/40 bg-blue-500/10 text-blue-400"
                        : "border-border text-slate-500"
                    }`}>
                    {m === "TRAINING" ? "Treino" : m === "ITEMS" ? "Itens" : "Padrao"}
                  </button>
                ))}
              </div>
              {expeditionMode === "TRAINING" && (
                <p className="text-[9px] text-purple-400/80 leading-tight">
                  So EXP; sem itens/coins. EXP muito maior que o padrao.
                </p>
              )}
              {expeditionMode === "ITEMS" && (
                <p className="text-[9px] text-green-400/80 leading-tight">
                  So itens; comida, doces ou ovos. Nao gera EXP nem moedas.
                </p>
              )}
              <select
                value={expeditionDuration}
                onChange={e => setExpeditionDuration(e.target.value as ExpeditionDuration)}
                className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-blue-500/60"
              >
                {(Object.entries(EXPEDITION_DURATIONS) as [ExpeditionDuration, typeof EXPEDITION_DURATIONS[ExpeditionDuration]][])
                  .filter(([key]) => key !== "7d") // férias usa Ticket de Férias no painel de itens
                  .map(([key, v]) => (
                    <option key={key} value={key}>
                      {expeditionMode === "TRAINING"
                        ? `Treino ${v.label}`
                        : expeditionMode === "ITEMS"
                          ? `Itens ${v.label} - recompensas melhores${v.rewardBonus > 0 ? ` +${v.rewardBonus}%` : ""}`
                          : `Padrao ${v.label} - x${v.expMultiplier} EXP${v.rewardBonus > 0 ? ` +${v.rewardBonus}% loot` : ""}`}
                    </option>
                  ))}
              </select>
              <div className="flex gap-1.5">
                <button type="button" disabled={pending}
                  onClick={() => act(
                    () => startExpeditionAction(mascot.id, expeditionDuration, expeditionMode),
                    `Expedicao de ${EXPEDITION_DURATIONS[expeditionDuration].label} iniciada!`
                  )}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-[11px] font-medium disabled:opacity-40 ${
                    expeditionMode === "TRAINING"
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                      : expeditionMode === "ITEMS"
                        ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                  }`}>
                  <MapPin size={12}/> {expeditionMode === "TRAINING" ? "Treinar" : expeditionMode === "ITEMS" ? "Buscar" : "Partir"}
                </button>
                <button type="button" onClick={() => setShowLootPreview(true)}
                  className="rounded-xl border border-border bg-slate-900/60 px-2 py-1.5 text-[11px] text-slate-400 hover:text-slate-200">
                  Loot?
                </button>
              </div>
            </div>
          )}
          {!mascot.isEquipped && (
            <button type="button" disabled={pending || arenaLocked} onClick={() => act(() => equipMascotAction(mascot.id), "Mascote equipado!")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 py-2 text-xs font-medium text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">
              <Swords size={12}/> Equipar
            </button>
          )}
          {mascot.isEquipped && (
            <button type="button" disabled={pending} onClick={() => act(() => unequipMascotAction(mascot.id), "Desequipado.")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-600/40 bg-slate-800/40 py-2 text-xs font-medium text-slate-400 hover:bg-slate-700/40 disabled:opacity-40">
              Desequipar
            </button>
          )}
        </div>

        {/* ── Cadeia de evolução ── */}
        {(() => {
          const chain: { to: number; level: number; name: string }[] = [];
          let cur = mascot.pokemonId;
          while (true) {
            const evo = EVOLUTION_MAP.get(cur);
            if (!evo) break;
            chain.push({ to: evo.to, level: evo.level, name: getEvoName(evo.to) });
            cur = evo.to;
          }
          if (chain.length === 0) return null;
          const nextEvo = chain[0];
          const canEvolveNow = !mascot.evolutionLocked && mascot.level >= nextEvo.level;
          return (
            <div className="rounded-xl border border-border/40 bg-slate-900/30 px-3 py-2 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Evoluções</p>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-slate-400">{name}</span>
                {chain.map((evo, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-slate-600">→</span>
                    <span className={`font-semibold ${
                      i === 0 && canEvolveNow ? "text-[#FFCB05]" :
                      i === 0 ? "text-slate-300" : "text-slate-500"
                    }`}>
                      {evo.name}
                    </span>
                    <span className={`text-[9px] rounded-full px-1.5 py-0.5 ${
                      i === 0 && canEvolveNow
                        ? "bg-[#FFCB05]/20 text-[#FFCB05] font-bold"
                        : "bg-slate-800 text-slate-600"
                    }`}>
                      Nv.{evo.level}
                    </span>
                  </span>
                ))}
              </div>
              {mascot.evolutionLocked && (
                <p className="text-[9px] text-red-400">🔒 Evolução travada</p>
              )}
            </div>
          );
        })()}

        {/* ── Travar evolução ── */}
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-slate-900/30 px-3 py-2">
          <Tip text={mascot.evolutionLocked
            ? "Evolução bloqueada permanentemente. Não pode ser desfeito pelo jogador."
            : "Marque para impedir que este mascote evolua. Atenção: esta ação não pode ser desfeita."}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mascot.evolutionLocked}
                disabled={pending || mascot.evolutionLocked}
                onChange={() => {
                  if (mascot.evolutionLocked) return;
                  if (!confirm(`Travar evolução de ${name}? Esta ação NÃO pode ser desfeita.`)) return;
                  act(() => toggleEvolutionLockAction(mascot.id, true), "Evolução travada permanentemente.");
                }}
                className="h-3.5 w-3.5 accent-red-500"
              />
              <span className={`text-[11px] font-semibold ${mascot.evolutionLocked ? "text-red-400" : "text-slate-400"}`}>
                {mascot.evolutionLocked ? "🔒 Evolução bloqueada" : "Travar evolução"}
              </span>
            </label>
          </Tip>
          {!mascot.evolutionLocked && (
            <span className="text-[9px] text-slate-600">⚠️ irreversível</span>
          )}
        </div>

        {/* ── Amigos e Rivais ── */}
        {!compactView && mascot.relations && mascot.relations.length > 0 && (
          <div className="space-y-1.5">
            <button type="button" onClick={() => setShowRelations(r => !r)}
              className="w-full flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors">
              <span>
                💚 Amigos ({mascot.relations.filter(r => r.type === "FRIEND").length})
                {" & "}
                😤 Rivais ({mascot.relations.filter(r => r.type === "RIVAL").length})
              </span>
              <span>{showRelations ? "▲" : "▼"}</span>
            </button>
            {showRelations && (
              <div className="rounded-xl border border-border/40 bg-slate-900/30 p-2 space-y-1.5 max-h-48 overflow-y-auto">
                {mascot.relations.map(rel => {
                  const isFriend = rel.type === "FRIEND";
                  const tier = isFriend
                    ? (rel.interactionCount >= 5 ? "💛 Super Amigo" : "💚 Amigo")
                    : (rel.interactionCount >= 3 ? "🔥 Rival Direto" : "😤 Rival");
                  const name_ = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
                  return (
                    <div key={rel.mascotB.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border text-[10px] ${
                      isFriend ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
                    }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getSpriteUrl(rel.mascotB.pokemonId)} alt="" className="h-7 w-7 object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-200 truncate">{name_}</p>
                        <p className="text-slate-500 truncate">de {rel.mascotB.ownerName}</p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-semibold ${isFriend ? "text-green-300" : "text-red-300"}`}>{tier}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Histórico de eventos ── */}
        {!compactView && events.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Histórico</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {events.slice(0, 8).map(ev => (
                <div key={ev.id} className="flex items-start gap-1.5 text-[10px] text-slate-500">
                  <span className="shrink-0">{ev.emoji}</span>
                  <span className="leading-snug">{ev.description}</span>
                  <span className="ml-auto shrink-0 text-slate-700">
                    {new Date(ev.createdAt).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Admin tools ── */}
        {isAdmin && !compactView && (
          <div className="border-t border-border/40 pt-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FFCB05]/60">⚡ Admin</p>
            {/* Trigger global de eventos sociais */}
            <button type="button" disabled={pending}
              onClick={() => startTransition(async () => {
                const r = await adminTriggerSocialEventsAction();
                if (r.error) toast.error(r.error);
                else {
                  const s = r.summary!;
                  toast.success(`Eventos sociais: ${s.battles} batalhas, ${s.friendships} amizades`);
                  router.refresh();
                }
              })}
              className="w-full rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-purple-400 hover:bg-purple-500/20 disabled:opacity-50">
              🌐 Disparar Eventos Sociais (todos os mascotes)
            </button>
            <div className="flex flex-wrap gap-1.5">
              {expedition && (
                <button type="button" disabled={pending}
                  onClick={() => act(() => skipExpeditionAction(expedition.id), "Expedição pulada!")}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:bg-blue-500/20">
                  ⏩ Pular expedição
                </button>
              )}
              <button type="button" disabled={pending}
                onClick={() => act(() => addExpAdminAction(mascot.id, Math.max(1, expToNext(mascot.level) - mascot.exp)), "EXP para próximo nível adicionada!")}
                className="rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2.5 py-1 text-[11px] font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20">
                ⬆ EXP p/ upar
              </button>
              <button type="button" disabled={pending}
                onClick={() => act(() => addExpAdminAction(mascot.id, 9999), "+9999 EXP adicionada!")}
                className="rounded-lg border border-slate-600/30 bg-slate-800/40 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-700/40">
                +9999 EXP
              </button>
            </div>

            {/* Admin: batalha/amizade com outro mascote */}
            {otherMascots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-600">Trigger vs outro mascote:</p>
                <div className="flex flex-wrap gap-1">
                  {otherMascots.map(other => (
                    <div key={other.id} className="flex gap-1">
                      <button type="button" disabled={pending}
                        onClick={() => act(() => adminBattleMascotsAction(mascot.id, other.id), `Batalha vs ${other.name}!`)}
                        className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/20">
                        ⚔️ {other.name}
                      </button>
                      <button type="button" disabled={pending}
                        onClick={() => act(() => adminFormFriendshipAction(mascot.id, other.id), `Amizade com ${other.name}!`)}
                        className="rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400 hover:bg-green-500/20">
                        💚
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
