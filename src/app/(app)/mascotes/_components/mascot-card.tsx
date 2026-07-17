"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart, Swords, Utensils, Candy, Edit2, Check, X, MapPin, Info, Star, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getSpriteUrl, getStaticSpriteUrl, getPokemonName, getPokemonTypes, expToNextLevel as expToNext,
  MOOD_EMOJI, MOOD_LABEL, PERSONALITY_LABEL,
  getHungerStatus, getHappinessStatus, getChallengeStatus,
  HUNGER_LABEL, HAPPINESS_LABEL, CHALLENGE_LABEL,
  HUNGER_COLOR, HAPPINESS_COLOR, CHALLENGE_COLOR,
} from "@/lib/mascot-data";
import { getPreferredSpriteUrl, type PlayerSpritePreferences } from "@/lib/sprite-preferences";
import {
  interactAction, equipMascotAction, unequipMascotAction,
  renameMascotAction, startExpeditionAction, claimExpeditionAction,
  skipExpeditionAction, cancelExpeditionAction, addExpAdminAction,
  adminBattleMascotsAction, adminFormFriendshipAction,
  adminTriggerSocialEventsAction,
  healMascotSusAction,
  toggleFavoriteMascotAction,
  toggleEvolutionLockAction,
  toggleExpLockAction,
  removeXpShareAction,
} from "../actions";
import { EXPEDITION_DURATIONS, TRAINING_EXP_MULT, EXP_REWARDS, getExpeditionAgilityReduction, getExpeditionOdds, getShinySprite, EVOLUTION_MAP, getPokemonName as getEvoName } from "@/lib/mascot-data";
import type { ExpeditionDuration, ExpeditionMode } from "@/lib/mascot-data";
import { getMegaStoneByType } from "@/lib/mega-evolution";
import { MascotSpeechBubble } from "./mascot-speech-bubble";
import { PerformanceTagPicker } from "./performance-tag-picker";
import { useTimerExpiry, formatRemaining } from "@/hooks/use-timer-expiry";
import { PERSONALITY_DESCRIPTION, getMascotRarity, RARITY_LABEL, RARITY_COLOR } from "@/lib/mascot-data";

interface Expedition { id: string; finishAt: Date; status: string; mode?: string }
interface MascotRelation {
  type: string;
  interactionCount: number;
  relationshipScore: number;
  specialBondType: string | null;
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
  hatchedFromEggType?: string | null;
  hatchedFromEggOrigin?: string | null;
  megaStoneName?: string | null;
  lastInteractedAt: Date | null;
  lastPlayedAt?: Date | null;  // presente após migração SQL
  lastPettedAt?: Date | null;  // presente após migração SQL
  lastFedAt: Date | null;
  socialCooldownUntil: Date | null;
  evolutionLocked: boolean;
  expLocked: boolean;
  isShiny: boolean;
  ivRating?: string | null;
  ivScore?: number | null;
  performanceTag?: string | null;
  activeBuffs: { type: string; expiresAt: Date }[];
  relations?: MascotRelation[];
  expeditions: Expedition[];
  events: MascotEvent[];
  hasFood: boolean;
  hasSweet: boolean;
  // Admin: lista de outros mascotes para debug
  otherMascots?: { id: string; name: string }[];
}

interface Props {
  mascot: MascotData;
  isAdmin?: boolean;
  compactView?: boolean;
  onRefresh?: () => void;
  spritePreferences?: PlayerSpritePreferences | null;
}

const IV_RATING_STYLE: Record<string, string> = {
  SSS: "text-fuchsia-300 border-fuchsia-400/50 bg-fuchsia-500/15",
  SS:  "text-purple-300 border-purple-400/50 bg-purple-500/15",
  S:   "text-amber-300 border-amber-400/50 bg-amber-500/15",
  A:   "text-emerald-300 border-emerald-400/50 bg-emerald-500/15",
  B:   "text-sky-300 border-sky-400/50 bg-sky-500/15",
  C:   "text-slate-300 border-slate-400/40 bg-slate-500/15",
  D:   "text-orange-300 border-orange-400/40 bg-orange-500/10",
  E:   "text-red-300 border-red-400/40 bg-red-500/10",
};

const TYPE_COLORS: Record<string, string> = {
  normal:"bg-slate-500/25 text-slate-300 border-slate-500/30", fire:"bg-orange-500/20 text-orange-300 border-orange-500/30",
  water:"bg-blue-500/20 text-blue-300 border-blue-500/30", grass:"bg-green-500/20 text-green-300 border-green-500/30",
  electric:"bg-yellow-400/20 text-yellow-300 border-yellow-400/30", psychic:"bg-pink-500/20 text-pink-300 border-pink-500/30",
  fighting:"bg-red-600/20 text-red-300 border-red-600/30", dark:"bg-slate-700/40 text-slate-400 border-slate-600/30",
  steel:"bg-slate-400/20 text-slate-300 border-slate-400/30", dragon:"bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  fairy:"bg-pink-400/20 text-pink-200 border-pink-400/30", ghost:"bg-purple-600/20 text-purple-300 border-purple-600/30",
  poison:"bg-purple-500/20 text-purple-300 border-purple-500/30", ground:"bg-amber-600/20 text-amber-300 border-amber-600/30",
  rock:"bg-stone-500/20 text-stone-300 border-stone-500/30", flying:"bg-sky-500/20 text-sky-300 border-sky-500/30",
  bug:"bg-lime-500/20 text-lime-300 border-lime-500/30", ice:"bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
};
const TYPE_LABELS: Record<string, string> = {
  normal:"Normal", fire:"Fogo", water:"Água", grass:"Grama", electric:"Elétrico",
  psychic:"Psíquico", fighting:"Lutador", dark:"Noturno", steel:"Metal",
  dragon:"Dragão", fairy:"Fada", ghost:"Fantasma", poison:"Venenoso",
  ground:"Terra", rock:"Pedra", flying:"Voador", bug:"Inseto", ice:"Gelo",
};

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
  orderClue?: {
    clueText: string;
    relatedStepKey?: string | null;
  };
}

const BUFF_ITEM_DISPLAY: Record<string, { emoji: string; label: string }> = {
  EXP_BOOST:       { emoji: "⚡",    label: "Boost de EXP" },
  LUCK_BOOST:      { emoji: "🍀",   label: "Boost de Sorte" },
  STAT_BOOST:      { emoji: "💊",   label: "Proteína Zika" },
  LUCKY_EGG:       { emoji: "🥚✨", label: "Ovo da Sorte" },
  WEAKNESS_POLICY: { emoji: "🛡️",  label: "Política de Fraqueza" },
  PICNIC_BASKET:   { emoji: "🧺",   label: "Cesta de Piquenique" },
  XP_SHARE:        { emoji: "📡",   label: "Compartilhador de XP" },
};

const ORDER_CLUE_STEP_LABELS: Record<string, string> = {
  ZIKALOOT_FAKE_NUMBER: "Travessura: ZikaLoot roubada",
  BAZAR_SLOT_SIX_CLICKS: "Travessura: Bazar sabotado",
  LAB_SMOKE_TO_MACHINE: "Travessura: Laboratorio travado",
  MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS: "Travessura: Liga Semanal adulterada",
  MASCOTS_EQUIPPED_WHISPER: "Travessura: Mascotes atacados",
};

export function getOrderClueStepLabel(stepKey?: string | null) {
  if (!stepKey) return "Pista geral da investigacao";
  return ORDER_CLUE_STEP_LABELS[stepKey] ?? "Pista da investigacao";
}

export function rewardToDisplay(reward: { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; exp?: number; expBonus?: number; gotEgg?: boolean; durationLabel?: string; shopItemType?: string }): ExpeditionRewardDisplay {
  if (reward.type === "TRAINING") {
    const exp = reward.exp ?? 0;
    const dur = reward.durationLabel ?? "";
    return {
      emoji: "🏋️",
      title: `Treinamento de ${dur} concluído!`,
      description: `+${exp.toLocaleString("pt-BR")} EXP recebido. Nenhum item — isso é esperado no modo Treinamento.`,
    };
  }
  if (reward.type === "VACATION") {
    const exp = reward.expBonus ?? 0;
    return {
      emoji: "🏖️",
      title: "Férias concluídas!",
      description: `Seu mascote voltou revigorado com felicidade máxima e +${exp.toLocaleString("pt-BR")} EXP.${reward.gotEgg ? " Também trouxe um Ovo Comum." : ""}`,
    };
  }
  if (reward.type === "EGG") {
    const label = reward.eggType === "RARE" ? "Raro" : reward.eggType === "SPECIAL" ? "Especial" : reward.eggType === "EVENT" ? "de Evento" : "Comum";
    return { emoji: "🥚", title: `Ovo ${label} encontrado!`, description: "Seu mascote voltou com um ovo misterioso." };
  }
  if (reward.type === "FOOD") {
    if (reward.foodType === "SWEET") return { emoji: "🍬", title: "Doce encontrado!", description: `${reward.quantity ?? 1}x Doce de Mascote` };
    return { emoji: "🍖", title: "Comida encontrada!", description: `${reward.quantity ?? 1}x Comida de Mascote` };
  }
  if (reward.type === "COINS") {
    return { emoji: "🪙", title: `${reward.amount} ZikaCoins encontrados!`, description: "Adicionados à sua carteira." };
  }
  if (reward.type === "BUFF_ITEM") {
    const info = (reward.shopItemType ? BUFF_ITEM_DISPLAY[reward.shopItemType] : null) ?? { emoji: "✨", label: "Item especial" };
    return { emoji: info.emoji, title: `${info.label} encontrado!`, description: "O item foi adicionado à sua caixa de presentes." };
  }
  if (reward.type === "MEGA_STONE") {
    const stone = reward.shopItemType ? getMegaStoneByType(reward.shopItemType) : null;
    const label = stone?.stoneName ?? "Pedra de Mega Evolução";
    const target = stone?.compatiblePokemonName ? ` para ${stone.compatiblePokemonName}` : "";
    return {
      emoji: "💎",
      title: `${label} encontrada!`,
      description: `Uma pedra de mega evolução raríssima${target} foi enviada para sua caixa de presentes.`,
    };
  }
  return { emoji: "😔", title: "Voltou de mãos vazias...", description: "Desta vez não encontrou nada." };
}

const BUFF_DISPLAY: Record<string, { emoji: string; label: string; color: string; permanent?: boolean; areas?: string }> = {
  EXP_BOOST:       { emoji: "⚡",   label: "EXP +25%",       color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300", areas: "Expedição ✓ · Arena ✓ · Interações ✓ · Férias ✗" },
  LUCK_BOOST:      { emoji: "🍀",   label: "Sorte",           color: "border-green-500/40 bg-green-500/10 text-green-300" },
  STAT_BOOST:      { emoji: "💊",   label: "Proteína Zika",   color: "border-purple-500/40 bg-purple-500/10 text-purple-300", permanent: true },
  LUCKY_EGG:       { emoji: "🥚✨", label: "Ovo da Sorte",    color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-200", areas: "Expedição ✓ · Arena ✗ · Interações ✗" },
  WEAKNESS_POLICY: { emoji: "🛡️",  label: "Política Fraqueza", color: "border-blue-500/40 bg-blue-500/10 text-blue-300", permanent: true },
  PICNIC_BASKET:   { emoji: "🧺",   label: "Piquenique +15%", color: "border-orange-500/40 bg-orange-500/10 text-orange-300", areas: "Expedição ✓ · Arena ✓ · Interações ✓ · Férias ✗" },
  XP_SHARE:        { emoji: "📡",   label: "Comp. XP",        color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300", permanent: true },
};

const EGG_TYPE_LABEL: Record<string, string> = {
  COMMON: "Ovo Comum",
  RARE: "Ovo Raro",
  SPECIAL: "Ovo Especial",
  EVENT: "Ovo de Evento",
  LAB: "Ovo de Laboratorio",
};

function getHatchedEggLabel(type?: string | null, origin?: string | null) {
  if (!type) return null;
  if (origin?.startsWith("GEN_CHOICE:")) {
    const [, originalType, generationType] = origin.split(":");
    const generation = generationType?.replace("EGG_GEN", "").replace("PLUS", "+");
    if (generation) return `${EGG_TYPE_LABEL[originalType] ?? "Ovo"} de Geração ${generation}`;
  }
  if (type.startsWith("EGG_GEN")) {
    const generation = type.replace("EGG_GEN", "").replace("PLUS", "+");
    return `Ovo de Geração ${generation}`;
  }
  if (origin?.startsWith("LAB_REGION:")) {
    return `Ovo de Laboratorio (Geracao ${origin.replace("LAB_REGION:EGG_GEN", "")})`;
  }
  return EGG_TYPE_LABEL[type] ?? type.replaceAll("_", " ");
}

function getRelationTier(relation: MascotRelation) {
  const legacyScore = relation.type === "FRIEND"
    ? Math.min(94, 15 + Math.max(1, relation.interactionCount) * 5)
    : Math.max(-79, -15 - Math.max(1, relation.interactionCount) * 8);
  const score = typeof relation.relationshipScore === "number" && relation.relationshipScore !== 0
    ? relation.relationshipScore
    : legacyScore;
  if (score <= -80) return { score, label: "Nêmesis", emoji: "☠️" };
  if (score <= -60) return { score, label: "Rival Direto", emoji: "🔥" };
  if (score <= -35) return { score, label: "Rival Forte", emoji: "⚔️" };
  if (score <= -15) return { score, label: "Rival", emoji: "😤" };
  if (score <= 14) return { score, label: "Conhecido", emoji: "👀" };
  if (score <= 34) return { score, label: "Colega", emoji: "🤝" };
  if (score <= 59) return { score, label: "Amigo", emoji: "💚" };
  if (score <= 79) return { score, label: "Grande Amigo", emoji: "💛" };
  if (score <= 94) return { score, label: "Melhor Amigo", emoji: "🌟" };
  return { score, label: "Quase Irmãos", emoji: "✨" };
}

function ActiveBuffBadge({ type, expiresAt }: { type: string; expiresAt: Date }) {
  const { remaining, expired } = useTimerExpiry(expiresAt);
  if (expired) return null;
  const info = BUFF_DISPLAY[type] ?? { emoji: "✨", label: type, color: "border-blue-500/40 bg-blue-500/10 text-blue-300" };
  const isPermanent = info.permanent || new Date(expiresAt).getFullYear() >= 2090;
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

function XpShareBadge({ mascotId }: { mascotId: string }) {
  const [pending, startTransition] = useTransition();
  const handleRemove = () => {
    if (!confirm("Desequipar Compartilhador de XP? O item voltará ao seu inventário.")) return;
    startTransition(async () => {
      const res = await removeXpShareAction(mascotId);
      if (res.error) toast.error(res.error);
      else toast.success("Compartilhador de XP removido e devolvido ao inventário. 📡");
    });
  };
  return (
    <span className="flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
      📡 Comp. XP
      <button
        type="button"
        disabled={pending}
        onClick={handleRemove}
        title="Desequipar e devolver ao inventário"
        className="ml-0.5 rounded-full hover:text-red-300 disabled:opacity-40 transition-colors"
      >
        ✕
      </button>
    </span>
  );
}

export function MascotCard({ mascot, isAdmin = false, compactView = false, onRefresh, spritePreferences = null }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(mascot.nickname ?? "");
  const [imgFailed, setImgFailed] = useState(false);
  const [expeditionReward, setExpeditionReward] = useState<ExpeditionRewardDisplay | null>(null);
  const [expeditionRewardPendingRefresh, setExpeditionRewardPendingRefresh] = useState(false);
  const closeExpeditionReward = () => {
    setExpeditionReward(null);
    if (expeditionRewardPendingRefresh) {
      setExpeditionRewardPendingRefresh(false);
      router.refresh();
    }
  };
  const [expeditionDuration, setExpeditionDuration] = useState<ExpeditionDuration>("1h");
  const [expeditionMode, setExpeditionMode] = useState<ExpeditionMode>("STANDARD");
  const [showLootPreview, setShowLootPreview] = useState(false);
  const [lootPreviewDuration, setLootPreviewDuration] = useState<ExpeditionDuration>("1h");
  const [showRelations, setShowRelations] = useState(false);
  const [showPermanentItems, setShowPermanentItems] = useState(false);

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
  const permanentItemCounts = mascot.activeBuffs.reduce<Record<string, number>>((counts, buff) => {
    if (new Date(buff.expiresAt).getFullYear() >= 2090 || BUFF_DISPLAY[buff.type]?.permanent) {
      counts[buff.type] = (counts[buff.type] ?? 0) + 1;
    }
    return counts;
  }, {});
  const permanentItems = Object.entries(permanentItemCounts).map(([type, quantity]) => ({
    key: type,
    emoji: BUFF_DISPLAY[type]?.emoji ?? "✨",
    label: BUFF_DISPLAY[type]?.label ?? type.replaceAll("_", " "),
    quantity,
  }));
  if (mascot.megaStoneName) {
    permanentItems.push({ key: "MEGA_STONE", emoji: "💎", label: mascot.megaStoneName, quantity: 1 });
  }
  const hatchedEggLabel = getHatchedEggLabel(mascot.hatchedFromEggType, mascot.hatchedFromEggOrigin);
  const expedition = expeditions.find(e => e.status === "ACTIVE");
  // useTimerExpiry: atualiza automaticamente quando a expedição termina
  const expeditionExpiry = useTimerExpiry(expedition?.finishAt ?? null);
  const claimable = !!expedition && expeditionExpiry.expired;
  const expNeeded  = Math.max(1, expToNext(localLevel));
  const expPct     = Math.min(100, Math.max(0, Math.round((localExp / expNeeded) * 100)));

  // Derived status — usa estado local otimista
  const hungerStatus    = getHungerStatus(localLastFed, mascot.isEquipped);
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

  // Semeia o Map de cooldown a partir do servidor (sobrevive a refresh de pagina).
  // Brincar e carinho possuem cooldowns independentes.
  useEffect(() => {
    const ts = mascot.lastPlayedAt ? new Date(mascot.lastPlayedAt).getTime() : 0;
    if (ts > 0 && ts > (_playedAt.get(mascot.id) ?? 0)) {
      _playedAt.set(mascot.id, ts);
      setNowMs(Date.now());
    }
  }, [mascot.id, mascot.lastPlayedAt]);
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
    : getPreferredSpriteUrl(mascot.pokemonId, spritePreferences, { shiny: mascot.isShiny });

  const STATS = [
    { key: "statForce",    label: "Força",      emoji: "💪", value: mascot.statForce,    tip: "Poder em brigas com rivais e expedições pesadas" },
    { key: "statAgility",  label: "Agilidade",  emoji: "⚡", value: mascot.statAgility,  tip: "Pode acelerar em até 13% a segunda metade da expedição (até 6,5% do tempo total); também influencia iniciativa em brigas" },
    { key: "statCharisma", label: "Carisma",    emoji: "💛", value: mascot.statCharisma, tip: "Chance de fazer amigos e receber mais presentes" },
    { key: "statInstinct", label: "Instinto",   emoji: "🔍", value: mascot.statInstinct, tip: "Encontra itens mais raros em expedições" },
    { key: "statVitality", label: "Vitalidade", emoji: "🛡",  value: mascot.statVitality, tip: "Resiste melhor a humor ruim e efeitos negativos" },
  ];

  return (
    <>
    {/* Expedition reward modal */}
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
            className="w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-bold text-slate-900 hover:bg-[#FFD700] transition-colors">
            Fechar
          </button>
        </div>
      </div>
    )}
    {/* Loot preview modal */}
    {showLootPreview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowLootPreview(false)}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-500/30 bg-slate-950 p-5 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">🎁 Possível Loot em Expedições</p>
            <button onClick={() => setShowLootPreview(false)} className="text-slate-500 hover:text-slate-300"><X size={14}/></button>
          </div>
          {(() => {
            const allyCount = (mascot.relations ?? []).filter(relation => relation.type === "FRIEND").length;
            const rivalRelations = (mascot.relations ?? []).filter(relation => relation.type === "RIVAL");
            const luckBuff = mascot.activeBuffs.some(buff => buff.type === "LUCK_BOOST" && new Date(buff.expiresAt) > new Date());
            const agility = getExpeditionAgilityReduction(mascot.statAgility);
            const pct = (value: number) => value.toFixed(1).replace(".0", "");
            return (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Influência deste mascote</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-slate-900/70 p-2"><p className="text-[9px] text-slate-500">🔍 Instinto + nível</p><p className="text-xs font-bold text-white">{mascot.statInstinct} + {Math.floor(mascot.level / 5)} = {mascot.statInstinct + Math.floor(mascot.level / 5)} sorte</p><p className="text-[9px] text-slate-500">Aumenta ovos e define sua raridade.</p></div>
                  <div className="rounded-lg bg-slate-900/70 p-2"><p className="text-[9px] text-slate-500">🤝 Amizades</p><p className="text-xs font-bold text-white">{allyCount} aliado{allyCount !== 1 ? "s" : ""} · +{Math.min(20, allyCount * 4)} peso de ovo</p><p className="text-[9px] text-slate-500">Também concede +{allyCount * 10}% EXP em treino.</p></div>
                  <div className="rounded-lg bg-slate-900/70 p-2"><p className="text-[9px] text-slate-500">🍀 Bônus ativos</p><p className={`text-xs font-bold ${luckBuff ? "text-green-300" : "text-slate-300"}`}>{luckBuff ? "Amuleto: sorte dobrada" : "Sem Amuleto da Sorte"}</p><p className="text-[9px] text-slate-500">{rivalRelations.length} {rivalRelations.length === 1 ? "rival influencia" : "rivais influenciam"} apenas EXP.</p></div>
                  <div className="rounded-lg bg-slate-900/70 p-2"><p className="text-[9px] text-slate-500">⚡ Agilidade</p><p className="text-xs font-bold text-white">{mascot.statAgility}/250 · {pct(agility.min)}%–{pct(agility.max)}%</p><p className="text-[9px] text-slate-500">Acelera somente a segunda metade; até {pct(agility.max / 2)}% do tempo total. Reiniciar não rerrola o bônus.</p></div>
                </div>
                <p className="mt-2 text-[9px] text-slate-600">Agilidade reduz a duração, mas não muda o loot. Força, Vitalidade, Carisma e personalidade não alteram este sorteio.</p>
              </div>
            );
          })()}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => { const keys: ExpeditionDuration[] = ["30min", "1h", "3h", "6h"]; const index = keys.indexOf(lootPreviewDuration); setLootPreviewDuration(keys[(index + keys.length - 1) % keys.length]); }} className="rounded-lg border border-border bg-slate-900 p-2 text-slate-300"><ChevronLeft size={13}/></button>
            <div className="flex flex-wrap justify-center gap-1">
              {(["30min", "1h", "3h", "6h"] as ExpeditionDuration[]).map(duration => <button key={duration} type="button" onClick={() => setLootPreviewDuration(duration)} className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${lootPreviewDuration === duration ? "border-blue-400/60 bg-blue-500/15 text-blue-200" : "border-border text-slate-500"}`}>{EXPEDITION_DURATIONS[duration].label}</button>)}
            </div>
            <button type="button" onClick={() => { const keys: ExpeditionDuration[] = ["30min", "1h", "3h", "6h"]; const index = keys.indexOf(lootPreviewDuration); setLootPreviewDuration(keys[(index + 1) % keys.length]); }} className="rounded-lg border border-border bg-slate-900 p-2 text-slate-300"><ChevronRight size={13}/></button>
          </div>
          <div className="space-y-3">
            {(Object.entries(EXPEDITION_DURATIONS) as [ExpeditionDuration, typeof EXPEDITION_DURATIONS[ExpeditionDuration]][]).map(([key, dur]) => {
              if (key === "7d" || key !== lootPreviewDuration) return null;
              const allyCount = (mascot.relations ?? []).filter(relation => relation.type === "FRIEND").length;
              const rivalRelations = (mascot.relations ?? []).filter(relation => relation.type === "RIVAL");
              const luckBuff = mascot.activeBuffs.some(buff => buff.type === "LUCK_BOOST" && new Date(buff.expiresAt) > new Date());
              const rb          = dur.rewardBonus;
              const standard = getExpeditionOdds({ duration: key, mode: "STANDARD", level: mascot.level, instinct: mascot.statInstinct, allyCount, luckBuff });
              const items = getExpeditionOdds({ duration: key, mode: "ITEMS", level: mascot.level, instinct: mascot.statInstinct, allyCount, luckBuff });
              const pct = (value: number) => value.toFixed(1).replace(".0", "");
              const eggQuality = standard.eggType === "SPECIAL" ? "Especial" : standard.eggType === "RARE" ? "Raro" : "Comum";
              const agility = getExpeditionAgilityReduction(mascot.statAgility);
              const baseMinutes = dur.ms / 60_000;
              const fastestMinutes = Math.round(baseMinutes * (1 - agility.max / 200));
              const slowestMinutes = Math.round(baseMinutes * (1 - agility.min / 200));
              const formatMinutes = (minutes: number) => minutes >= 60
                ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`
                : `${minutes}min`;
              const modeLabel = expeditionMode === "TRAINING" ? "Treinamento" : expeditionMode === "ITEMS" ? "Itens" : "Padrão";

              const levelMult = 1 + Math.floor(mascot.level / 20) * 0.25;
              const expMult   = TRAINING_EXP_MULT[key as ExpeditionDuration] ?? 0;
              const allyExpBonus = 1 + allyCount * 0.1;
              const rivalCount = rivalRelations.length;
              const directRival = rivalRelations.some(relation => relation.interactionCount >= 3);
              const rivalBonus = 1 + Math.min((directRival ? 0.10 : rivalCount > 0 ? 0.05 : 0) * rivalCount, 0.15);
              const luckyEgg = mascot.activeBuffs.some(buff => buff.type === "LUCKY_EGG" && new Date(buff.expiresAt) > new Date()) ? 1.2 : 1;
              const expBoost = mascot.activeBuffs.some(buff => buff.type === "EXP_BOOST" && new Date(buff.expiresAt) > new Date()) ? 1.25 : 1;
              const picnic = mascot.activeBuffs.some(buff => buff.type === "PICNIC_BASKET" && new Date(buff.expiresAt) > new Date()) ? 1.15 : 1;
              const trainingExp = Math.round(EXP_REWARDS.EXPEDITION * expMult * levelMult * allyExpBonus * rivalBonus * luckyEgg * expBoost * picnic);
              const standardExp = Math.round(EXP_REWARDS.EXPEDITION * dur.expMultiplier * levelMult * allyExpBonus * rivalBonus * expBoost * picnic);

              return (
                <div key={key} className="rounded-xl border border-border/50 bg-slate-900/60 p-3 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-blue-400">{dur.label} · {modeLabel}</p>
                    <p className="mt-1 text-[10px] text-cyan-300">
                      ⚡ Duração sorteada: {formatMinutes(fastestMinutes)}–{formatMinutes(slowestMinutes)}
                      <span className="text-slate-500"> (Agilidade acelera a segunda metade em {pct(agility.min)}%–{pct(agility.max)}%; redução total de {pct(agility.min / 2)}%–{pct(agility.max / 2)}%)</span>
                    </p>
                  </div>

                  {/* Treinamento */}
                  {expeditionMode === "TRAINING" && <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-1 text-[10px]">
                    <span className="text-green-400">⚔️ Treinamento: </span>
                    <strong className="text-green-200">{trainingExp.toLocaleString("pt-BR")} EXP</strong>
                    <span className="ml-1 text-slate-500">(valor atual com relações e bônus ativos)</span>
                  </div>}

                  {/* Padrão */}
                  {expeditionMode === "STANDARD" && <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">🗺 Padrão</p>
                    <div className="mb-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[10px]">
                      <span className="text-blue-400">✨ EXP garantida: </span>
                      <strong className="text-blue-200">{standardExp.toLocaleString("pt-BR")} EXP</strong>
                      <span className="ml-1 text-slate-500">(valor atual com relações e bônus ativos)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                      <span>🥚 Ovo <span className="text-slate-600">({eggQuality})</span> <strong className="text-slate-200">{pct(standard.egg)}%</strong></span>
                      <span>🍬 Doce <strong className="text-slate-200">{pct(standard.sweet)}%</strong></span>
                      <span>🍖 Comida <strong className="text-slate-200">{pct(standard.food)}%</strong></span>
                      <span>🪙 Moedas <strong className="text-slate-200">{pct(standard.coins)}% · {standard.coinMin}–{standard.coinMax} ZC</strong></span>
                      {standard.specialItem > 0 && (
                        <span className="col-span-2 text-purple-400">🧪 Item especial <strong className="text-purple-200">{pct(standard.specialItem)}%</strong> <span className="text-slate-600">(Vitamina, Amuleto…)</span></span>
                      )}
                      {standard.nothing > 0 && <span className="col-span-2 text-slate-500">🌫 Sem recompensa <strong>{pct(standard.nothing)}%</strong></span>}
                    </div>
                  </div>}

                  {/* Itens */}
                  {expeditionMode === "ITEMS" && <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">📦 Itens</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                      <span>🥚 Ovo <span className="text-slate-600">({items.eggType === "SPECIAL" ? "Especial" : items.eggType === "RARE" ? "Raro" : "Comum"})</span> <strong className="text-slate-200">{pct(items.egg)}%</strong></span>
                      <span>🍬 Doce <strong className="text-slate-200">{pct(items.sweet)}%</strong></span>
                      <span>🍖 Comida <strong className="text-slate-200">{pct(items.food)}%</strong></span>
                      <span className="col-span-2 text-purple-400">🧪 Item especial <strong className="text-purple-200">{pct(items.specialItem)}%</strong> <span className="text-slate-600">(Vitamina, Amuleto, Piquenique…)</span></span>
                      {items.megaStone > 0 && <span className="col-span-2 text-fuchsia-300">💎 Pedra de Mega Evolução <strong>{pct(items.megaStone)}%</strong> <span className="text-slate-500">(somente Itens 6h; Instinto 80+ garante a chance máxima de 0,5%)</span></span>}
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600">Percentuais exatos do sorteio atual. Arredondamento visual de até 0,1 ponto percentual.</p>
        </div>
      </div>
    )}

    <div className={`h-fit self-start rounded-2xl border bg-slate-950/60 transition-all ${mascot.isEquipped ? "border-[#FFCB05]/50 ring-1 ring-[#FFCB05]/20" : "border-border"}`}>
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

      {/* Rarity tag */}
      {(() => {
        const rarity = getMascotRarity(mascot.pokemonId);
        if (rarity === "COMMON") return null;
        return (
          <div className={`border-b px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-wider ${RARITY_COLOR[rarity]}`}>
            {rarity === "LEGENDARY" && "⭐ "}{rarity === "MYTHICAL" && "🌟 "}{rarity === "ULTRA_BEAST" && "🌀 "}{rarity === "PSEUDO_LEGENDARY" && "💎 "}
            {rarity === "MEGA" && "✦ "}
            {RARITY_LABEL[rarity]}
          </div>
        );
      })()}

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
              id={mascot.id}
              mood={mascot.mood}
              happiness={mascot.happiness}
              personality={mascot.personality}
              isEquipped={mascot.isEquipped}
              lastFedAt={mascot.lastFedAt}
              lastInteractedAt={mascot.lastInteractedAt}
              lastPlayedAt={mascot.lastPlayedAt}
              lastPettedAt={mascot.lastPettedAt}
              battleWins={mascot.battleWins}
              battleLosses={mascot.battleLosses}
              arenaState={mascot.arenaState}
              restingUntil={mascot.restingUntil}
              level={mascot.level}
              exp={mascot.exp}
              isShiny={mascot.isShiny}
              statForce={mascot.statForce}
              statAgility={mascot.statAgility}
              statVitality={mascot.statVitality}
              statCharisma={mascot.statCharisma}
              statInstinct={mascot.statInstinct}
              relations={mascot.relations}
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
                {mascot.ivRating && (
                  <span
                    className={`shrink-0 inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${IV_RATING_STYLE[mascot.ivRating] ?? IV_RATING_STYLE.C}`}
                    title={`Análise do Laboratório: ranking ${mascot.ivRating} · potencial ${mascot.ivScore ?? "?"}%. Reanalise no Laboratório para atualizar.`}
                  >
                    IV {mascot.ivRating}{typeof mascot.ivScore === "number" ? ` · ${mascot.ivScore}%` : ""}
                  </span>
                )}
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
            <div className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
              #{mascot.pokemonId} ·{" "}
              <Tip text={PERSONALITY_DESCRIPTION[mascot.personality] ?? ""}>
                <span className="underline decoration-dotted cursor-help">
                  {PERSONALITY_LABEL[mascot.personality]}
                </span>
              </Tip>
              {" "}· Nv. {localLevel}
              {getPokemonTypes(mascot.pokemonId).map(t => (
                <span key={t} className={`rounded border px-1.5 py-px text-[9px] font-bold ${TYPE_COLORS[t] ?? "bg-slate-500/20 text-slate-400 border-slate-500/20"}`}>
                  {TYPE_LABELS[t] ?? t}
                </span>
              ))}
              <PerformanceTagPicker mascotId={mascot.id} initial={mascot.performanceTag ?? "NEUTRO"} size="md" />
            </div>
            {/* Battle record */}
            {(mascot.battleWins > 0 || mascot.battleLosses > 0) && (
              <div className="text-[9px] text-slate-600">
                ⚔️ {mascot.battleWins}V {mascot.battleLosses}D em batalhas
              </div>
            )}
            {hatchedEggLabel && (
              <div className="text-[9px] text-slate-600" title={`Nasceu de ${hatchedEggLabel}`}>
                🥚 Nasceu de {hatchedEggLabel}
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
        {mascot.activeBuffs.some(buff => buff.type !== "STAT_BOOST") && (
          <div className="flex flex-wrap gap-1.5">
            {mascot.activeBuffs.filter(buff => buff.type !== "STAT_BOOST").map((buff, i) => (
              buff.type === "XP_SHARE" ? (
                <XpShareBadge key={i} mascotId={mascot.id} />
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
                  const modeLabel = mode === "TRAINING" ? "🏋️ Treinamento" : mode === "ITEMS" ? "📦 Itens" : mode === "VACATION" ? "🏖️ Férias" : "🗺 Padrão";
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
                  const display = rewardToDisplay(r.result.reward as { type: string; eggType?: string; foodType?: string; quantity?: number; amount?: number; shopItemType?: string });
                  if (r.result.mode === "STANDARD" && r.result.expGained > 0) {
                    display.description += ` +${r.result.expGained.toLocaleString("pt-BR")} EXP recebido.`;
                  }
                  if (r.result.orderClue) display.orderClue = r.result.orderClue;
                  setExpeditionReward(display);
                  setExpeditionRewardPendingRefresh(true);
                } else {
                  router.refresh();
                }
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
                  onClick={() => startTransition(async () => {
                    const response = await startExpeditionAction(mascot.id, expeditionDuration, expeditionMode);
                    if (response.error) {
                      toast.error(response.error);
                      return;
                    }
                    const reduction = response.result?.agilityTimeReductionPct ?? 0;
                    toast.success(
                      `Expedição de ${EXPEDITION_DURATIONS[expeditionDuration].label} iniciada! Agilidade acelerará a segunda metade em ${reduction.toFixed(1).replace(".0", "")}% (${(reduction / 2).toFixed(1).replace(".0", "")}% do tempo total).`
                    );
                    router.refresh();
                  })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-[11px] font-medium disabled:opacity-40 ${
                    expeditionMode === "TRAINING"
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                      : expeditionMode === "ITEMS"
                        ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                  }`}>
                  <MapPin size={12}/> {expeditionMode === "TRAINING" ? "Treinar" : expeditionMode === "ITEMS" ? "Buscar" : "Partir"}
                </button>
                <button type="button" onClick={() => { setLootPreviewDuration(expeditionDuration); setShowLootPreview(true); }}
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
          const chain: { names: string[]; level: number; primary: number }[] = [];
          let cur = mascot.pokemonId;
          while (true) {
            const evo = EVOLUTION_MAP.get(cur);
            if (!evo) break;
            const targets = evo.toOptions ?? [evo.to];
            chain.push({ names: targets.map(id => getEvoName(id)), level: evo.level, primary: evo.to });
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
                      {evo.names.length > 1
                        ? evo.names.join(" / ")
                        : evo.names[0]}
                      {evo.names.length > 1 && (
                        <span className="ml-1 text-[9px] font-normal opacity-70">(sorteio)</span>
                      )}
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

        {/* ── Travar EXP ── */}
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-slate-900/30 px-3 py-2">
          <Tip text={mascot.expLocked
            ? "EXP bloqueada. Este mascote não ganha experiência de nenhuma fonte."
            : "Marque para impedir que este mascote ganhe EXP. Pode ser desativado a qualquer momento."}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mascot.expLocked}
                disabled={pending}
                onChange={() => {
                  act(() => toggleExpLockAction(mascot.id, !mascot.expLocked),
                    mascot.expLocked ? "EXP desbloqueada." : "EXP travada.");
                }}
                className="h-3.5 w-3.5 accent-yellow-500"
              />
              <span className={`text-[11px] font-semibold ${mascot.expLocked ? "text-yellow-400" : "text-slate-400"}`}>
                {mascot.expLocked ? "🔒 EXP bloqueada" : "Travar EXP"}
              </span>
            </label>
          </Tip>
        </div>

        {/* ── Itens permanentes aplicados ── */}
        {!compactView && permanentItems.length > 0 && (
          <div className="space-y-1.5">
            <button type="button" onClick={() => setShowPermanentItems(value => !value)}
              className="w-full flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors">
              <span>✨ Itens permanentes ({permanentItems.reduce((total, item) => total + item.quantity, 0)})</span>
              <span>{showPermanentItems ? "▲" : "▼"}</span>
            </button>
            {showPermanentItems && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-2 space-y-1.5">
                {permanentItems.map(item => (
                  <div key={item.key} className="flex items-center gap-2 rounded-lg border border-purple-500/15 bg-slate-900/35 px-2 py-1.5 text-[10px]">
                    <span className="text-base" aria-hidden>{item.emoji}</span>
                    <span className="min-w-0 flex-1 font-semibold text-slate-200">{item.label}</span>
                    <span className="shrink-0 rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 font-bold text-purple-300">
                      x{item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                  const tier = getRelationTier(rel);
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
                      <span className={`shrink-0 text-right text-[9px] font-semibold ${isFriend ? "text-green-300" : "text-red-300"}`}>
                        <span className="block">{tier.emoji} {tier.label}</span>
                        <span className="block opacity-60">{tier.score > 0 ? "+" : ""}{tier.score} · {rel.interactionCount} interações</span>
                      </span>
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
