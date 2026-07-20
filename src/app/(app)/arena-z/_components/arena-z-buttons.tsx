"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useTimerExpiry, formatRemaining } from "@/hooks/use-timer-expiry";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Timer, Zap, Shield, Skull, ChevronRight, Sparkles } from "lucide-react";
import { getSpriteUrl } from "@/lib/mascot-data";
import {
  adminRepairArenaAction,
  adminSetMascotStateAction,
  deleteArenaTeamAction,
  getArenaBattleDetailsAction,
  healMascotSusAction,
  lockBotAction,
  markPvpDefenseSeenAction,
  purgeAdminArenaDataAction,
  listAllArenaTeamsAction,
  deleteAllArenaTeamsAction,
  retireArenaTeamAction,
  runBotBattleAction,
  runOpportunisticAttackAction,
  runPvpBattleAction,
  useSusShieldAction,
} from "../actions";
import type { ArenaDifficulty } from "@/lib/arena-z";

// ── Badge de penalidade de retirada (10 min após coletar recompensas) ──────────
export function RetirePenaltyBadge({ retiredAt }: { retiredAt: string | Date | null | undefined }) {
  const cooldownUntil = retiredAt ? new Date(new Date(retiredAt).getTime() + 10 * 60_000) : null;
  const { expired, remaining } = useTimerExpiry(cooldownUntil);
  if (expired || !cooldownUntil) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
      <Timer size={12} className="shrink-0 text-orange-400" />
      <span>
        <span className="font-bold">Penalidade de saída ativa:</span>{" "}
        nova equipe disponível em{" "}
        <span className="font-mono font-bold text-orange-300">{formatRemaining(remaining)}</span>
      </span>
    </div>
  );
}

// ── Cooldown counter — usa timestamp absoluto para evitar dessincronia ────────
// Aceita Date/string (timestamp absoluto) para não depender de duração relativa calculada no servidor
export function CooldownBadge({ until }: { until: Date | string | null | undefined }) {
  const { expired, remaining } = useTimerExpiry(until);
  if (expired || !until) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFCB05]/50 bg-[#FFCB05]/10 px-2.5 py-1 text-[10px] font-bold text-[#FFCB05] shadow-[0_0_12px_rgba(255,203,5,0.12)]">
      <Timer size={10} /> {formatRemaining(remaining)}
    </span>
  );
}

// Indicador de cooldown PvP por equipe (usa timestamp absoluto)
export function PvpCooldownIndicator({ until }: { until: Date | null }) {
  const { expired } = useTimerExpiry(until);
  const onCooldown = !expired && !!until;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-red-200">
      <span>Cooldown PvP</span>
      {onCooldown ? <CooldownBadge until={until} /> : <span className="text-green-300">Liberado</span>}
    </div>
  );
}

type BotBattleResult = NonNullable<Awaited<ReturnType<typeof runBotBattleAction>>["result"]>;
type ArenaStaleNotice = NonNullable<Awaited<ReturnType<typeof lockBotAction>>["stale"]>;

type AnimTurn = {
  turn: number;
  action?: "ATTACK" | "DEFEND" | "HEAL";
  attackerId: string;
  attackerName: string;
  attackerPokemonId: number;
  defenderId: string;
  defenderName: string;
  defenderPokemonId: number;
  damage: number;
  advantageApplied: boolean;
  isPlayerAttacker: boolean;
  actorRole?: string;
  targetRole?: string;
  effect?: string;
};

type MascotInfo = { id: string; pokemonId: number; name: string; level: number; maxHp: number };

// ── Animação de combate ───────────────────────────────────────────────────────
function HpBar({ current, max, isPlayer }: { current: number; max: number; isPlayer: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const color = pct > 50 ? "bg-green-400" : pct > 20 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MascotPanel({
  mascot,
  currentHp,
  isActive,
  isAttacking,
  isHit,
  isPlayer,
}: {
  mascot: MascotInfo;
  currentHp: number;
  isActive: boolean;
  isAttacking: boolean;
  isHit: boolean;
  isPlayer: boolean;
}) {
  const dead = currentHp <= 0;
  return (
    <div className={`min-w-0 rounded-xl border p-1.5 sm:p-2 transition-all duration-200 ${
      dead
        ? "border-slate-800 bg-slate-950/40 opacity-30 grayscale"
        : isActive
          ? "border-[#FFCB05]/70 bg-[#FFCB05]/10 shadow-[0_0_18px_rgba(255,203,5,0.18)]"
          : "border-border/60 bg-slate-950/60 opacity-80"
    }`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`${mascot.id}-hit-${isHit}`}
        src={getSpriteUrl(mascot.pokemonId, true)}
        alt=""
        className="mx-auto h-11 w-11 object-contain sm:h-14 sm:w-14 lg:h-16 lg:w-16 xl:h-[4.5rem] xl:w-[4.5rem]"
        style={{
          imageRendering: "pixelated",
          animation: isHit ? "mascotShake 0.35s ease-in-out" : isAttacking ? "mascotLunge 0.3s ease-in-out" : "none",
          filter: isHit ? "brightness(2) saturate(0)" : "none",
          transition: "filter 0.1s",
        }}
      />
      <span className={`block truncate text-center text-[8px] font-semibold sm:text-[9px] ${isPlayer ? "text-blue-300" : "text-red-300"}`}>
        {mascot.name}
      </span>
      <div className="mt-1 w-full">
        <HpBar current={currentHp} max={mascot.maxHp} isPlayer={isPlayer} />
        <span className="block truncate text-center text-[7px] text-slate-500 sm:text-[8px]">{Math.max(0, currentHp)}/{mascot.maxHp}</span>
      </div>
    </div>
  );
}

function BattleAnimationModal({
  turns,
  playerMascots,
  botMascots,
  playerTeamName,
  botName,
  onFinish,
}: {
  turns: AnimTurn[];
  playerMascots: MascotInfo[];
  botMascots: MascotInfo[];
  playerTeamName: string;
  botName: string;
  onFinish: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<"wait" | "attack" | "hit">("wait");

  // HP tracking keyed by stable mascot id; names can repeat.
  const [hpMap, setHpMap] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const p of playerMascots) m[p.id] = p.maxHp;
    for (const b of botMascots) m[b.id] = b.maxHp;
    return m;
  });

  // Keep onFinish in a ref so it never enters useEffect deps
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; });

  useEffect(() => {
    if (currentIdx >= turns.length) {
      const t = setTimeout(() => onFinishRef.current(), 700);
      return () => clearTimeout(t);
    }

    const turn = turns[currentIdx];
    setPhase("wait");

    // t1: attacker lunges
    const t1 = setTimeout(() => setPhase("attack"), 300);
    // t2: hit flash + damage
    const t2 = setTimeout(() => {
      setPhase("hit");
      if ((turn.action ?? "ATTACK") === "ATTACK") {
        setHpMap(prev => ({
          ...prev,
          [turn.defenderId]: Math.max(0, (prev[turn.defenderId] ?? 0) - turn.damage),
        }));
      } else if (turn.action === "HEAL") {
        const allMascots = [...playerMascots, ...botMascots];
        const healed = allMascots.find(m => m.id === turn.defenderId);
        setHpMap(prev => ({
          ...prev,
          [turn.defenderId]: Math.min(healed?.maxHp ?? Infinity, (prev[turn.defenderId] ?? 0) + turn.damage),
        }));
      }
    }, 600);
    // t3: back to idle
    const t3 = setTimeout(() => setPhase("wait"), 950);
    // t4: advance
    const t4 = setTimeout(() => setCurrentIdx(i => i + 1), 1600);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [currentIdx, turns.length]); // intentionally omit onFinish — use ref

  const turn = turns[currentIdx] ?? null;
  const progress = turns.length > 0 ? Math.round((currentIdx / turns.length) * 100) : 100;
  const showDamage = phase === "hit";

  return (
    <>
      {/* Shake + lunge keyframes injected once */}
      <style>{`
        @keyframes mascotShake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-7px)}
          35%{transform:translateX(7px)}
          55%{transform:translateX(-5px)}
          75%{transform:translateX(5px)}
        }
        @keyframes mascotLunge {
          0%,100%{transform:translateX(0)}
          50%{transform:translateX(${turn?.isPlayerAttacker ? "8px" : "-8px"})}
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4">
        <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2 sm:px-5 sm:pt-4">
            <p className="text-[11px] uppercase tracking-widest text-[#FFCB05] font-semibold">⚔️ Combate em andamento…</p>
            <button type="button" onClick={() => onFinishRef.current()}
              className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] text-slate-400 hover:text-white">
              Pular →
            </button>
          </div>

          {/* Progress bar */}
          <div className="mx-3 h-1 rounded-full bg-slate-800 mb-3 sm:mx-5">
            <div className="h-1 rounded-full bg-[#FFCB05] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Sprites */}
          <div className="grid items-center gap-2 px-3 sm:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] sm:gap-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)]">
            {/* Player side */}
            <div>
              <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-blue-300 sm:text-left">Sua equipe</p>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 xl:grid-cols-6">
                {playerMascots.map(m => (
                  <MascotPanel
                    key={m.id}
                    mascot={m}
                    currentHp={hpMap[m.id] ?? m.maxHp}
                    isActive={turn?.isPlayerAttacker ? turn.attackerId === m.id : turn?.defenderId === m.id}
                    isAttacking={phase === "attack" && turn?.isPlayerAttacker === true && turn.attackerId === m.id}
                    isHit={phase === "hit" && turn?.isPlayerAttacker === false && turn.defenderId === m.id}
                    isPlayer
                  />
                ))}
              </div>
            </div>

            {/* Damage bubble */}
            <div className="order-first flex items-center justify-center gap-3 sm:order-none sm:flex-col sm:gap-1">
              <span className="text-[9px] text-slate-600">{turn ? `T.${turn.turn}` : ""}</span>
              <div className="flex h-12 min-w-[74px] items-center justify-center rounded-2xl border border-border bg-slate-900/70 sm:h-20 sm:min-w-0 sm:w-full xl:h-24">
                {showDamage && turn ? (
                  <div className="text-center">
                    <div className={`text-2xl font-black sm:text-3xl ${(turn.action ?? "ATTACK") === "DEFEND" ? "text-blue-300" : turn.advantageApplied ? "text-yellow-300" : "text-red-400"}`}
                      style={{ textShadow: "0 0 10px currentColor" }}>
                      {(turn.action ?? "ATTACK") === "DEFEND" ? "DEF" : `-${turn.damage}`}
                    </div>
                    {(turn.action ?? "ATTACK") === "DEFEND" ? (
                      <div className="text-[8px] text-blue-300 font-bold">POSTURA</div>
                    ) : turn.advantageApplied && <div className="text-[8px] text-yellow-400 font-bold">SUPER EF.!</div>}
                  </div>
                ) : (
                  <ChevronRight size={16} className="text-slate-700" />
                )}
              </div>
            </div>

            {/* Bot side */}
            <div>
              <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-red-300 sm:text-right">{botName}</p>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 xl:grid-cols-6">
                {botMascots.map(m => (
                  <MascotPanel
                    key={m.id}
                    mascot={m}
                    currentHp={hpMap[m.id] ?? m.maxHp}
                    isActive={turn?.isPlayerAttacker ? turn.defenderId === m.id : turn?.attackerId === m.id}
                    isAttacking={phase === "attack" && turn?.isPlayerAttacker === false && turn.attackerId === m.id}
                    isHit={phase === "hit" && turn?.isPlayerAttacker === true && turn.defenderId === m.id}
                    isPlayer={false}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Action text */}
          <div className="mx-3 mt-3 rounded-xl border border-border bg-slate-900/60 px-3 py-2 text-center sm:mx-5">
            {turn ? (
              <p className="text-[11px] text-slate-300">
                <span className={turn.isPlayerAttacker ? "text-blue-300 font-semibold" : "text-red-300 font-semibold"}>{turn.attackerName}</span>
                {turn.actorRole && <span className="ml-1 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#FFCB05]">{turn.actorRole}</span>}
                {(turn.action ?? "ATTACK") === "DEFEND" ? (
                  <span className="text-blue-200"> preparou defesa.</span>
                ) : (
                  <>
                    {" "}atacou <span className={turn.isPlayerAttacker ? "text-red-300 font-semibold" : "text-blue-300 font-semibold"}>{turn.defenderName}</span>
                    {turn.targetRole && <span className="ml-1 rounded-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">{turn.targetRole}</span>}
                    {showDamage && (
                      <span className={turn.advantageApplied ? " text-yellow-300" : " text-slate-400"}>
                        {" "}- {turn.damage} dano{turn.advantageApplied ? " ?" : ""}
                      </span>
                    )}
                  </>
                )}
                {turn.effect && <span className="block pt-1 text-[10px] text-slate-500">{turn.effect}</span>}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">Calculando resultado...</p>
            )}
          </div>

          {/* Turn dots */}
          <div className="flex justify-center gap-1 px-4 py-3">
            {turns.slice(0, Math.min(turns.length, 14)).map((_, i) => (
              <div key={i} className={`rounded-full transition-all ${i === currentIdx ? "w-3 h-2 bg-[#FFCB05]" : i < currentIdx ? "w-2 h-2 bg-slate-600" : "w-2 h-2 bg-slate-800"}`} />
            ))}
            {turns.length > 14 && <span className="text-[9px] text-slate-600 ml-1">+{turns.length - 14}</span>}
          </div>
        </div>
      </div>
    </>
  );
}

function useArenaAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else {
        toast.success(success);
        router.refresh();
      }
    });
  };
  return { pending, run };
}

function formatLoot(reward: { coins: number; exp: number; food: number; sweet: number }) {
  const parts = [`${reward.coins} ZC`, `${reward.exp} EXP`];
  if (reward.food > 0) parts.push(`${reward.food} comida`);
  if (reward.sweet > 0) parts.push(`${reward.sweet} doce`);
  return parts.join(" / ");
}

function formatSpoilItems(items?: Array<{ label?: string; type?: string; quantity?: number }> | null) {
  if (!items || items.length === 0) return "";
  return items.map(item => `${item.quantity ?? 1}x ${item.label ?? item.type ?? "item"}`).join(" / ");
}

const DIFFICULTY_STYLES: Record<ArenaDifficulty, { border: string; bg: string; text: string; badge: string }> = {
  easy:   { border: "border-green-500/40",  bg: "bg-green-500/10",  text: "text-green-300",  badge: "bg-green-500/20 text-green-200" },
  normal: { border: "border-yellow-500/40", bg: "bg-yellow-500/10", text: "text-yellow-300", badge: "bg-yellow-500/20 text-yellow-200" },
  hard:   { border: "border-red-500/40",    bg: "bg-red-500/10",    text: "text-red-300",    badge: "bg-red-500/20 text-red-200" },
};
const DIFFICULTY_LABELS: Record<ArenaDifficulty, string> = { easy: "🟢 Fácil", normal: "🟡 Normal", hard: "🔴 Difícil" };

type BattleDetails = NonNullable<Awaited<ReturnType<typeof getArenaBattleDetailsAction>>["battle"]>;

const EGG_LABEL: Record<string, string> = {
  COMMON: "🥚 Ovo Comum",
  RARE: "🔵 Ovo Raro",
  SPECIAL: "🌟 Ovo Especial",
  EVENT: "🧪 Ovo Laboratório",
};

function ArenaBattleResultModal({ battle, onClose }: { battle: BattleDetails; onClose: () => void }) {
  const [showReplay, setShowReplay] = useState(false);
  const defenderGained = battle.defenderLoot && battle.defenderLoot.coins > 0;
  const defenderLost = battle.defenderLoot && battle.defenderLoot.coins < 0;
  // Ovo relevante para o usuário atual
  const myEgg = battle.isCurrentUserDefender ? battle.defenderEgg : battle.attackerEgg;

  if (showReplay) {
    return (
      <BattleAnimationModal
        turns={battle.battleAnimation as AnimTurn[]}
        playerMascots={battle.playerMascots as MascotInfo[]}
        botMascots={battle.opponentMascots as MascotInfo[]}
        playerTeamName={battle.isCurrentUserDefender ? battle.defenderName : battle.attackerName}
        botName={battle.isCurrentUserDefender ? battle.attackerName : battle.defenderName}
        onFinish={() => setShowReplay(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-400/40 bg-slate-950 p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-red-300">Combate PvP recebido</p>
        <h3 className={`mt-2 text-lg font-black ${battle.defenderWon ? "text-green-300" : battle.attackerWon ? "text-red-300" : "text-yellow-300"}`}>
          {battle.defenderWon ? "🛡️ Sua defesa venceu!" : battle.attackerWon ? "💀 Você foi derrotado" : "🤝 Empate"}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          <span className="text-red-300 font-semibold">{battle.attackerName}</span> atacou{" "}
          <span className="text-blue-300 font-semibold">{battle.defenderName}</span>
          {" "}· {battle.rounds} turnos
        </p>
        <p className="mt-0.5 text-[11px] text-slate-600">
          {new Date(battle.happenedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>

        {/* Resultado do cofre (loot roubado/perdido) */}
        {battle.defenderLoot && (defenderGained || defenderLost) && (
          <div className={`mt-3 rounded-xl border p-3 ${defenderGained ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"}`}>
            <p className={`text-xs font-bold ${defenderGained ? "text-green-300" : "text-red-300"}`}>
              {defenderGained ? "💰 Loot roubado do atacante" : "💸 Cofre: perdas do ataque"}
            </p>
            <p className="mt-1 text-sm text-slate-200">
              {defenderGained
                ? `+${battle.defenderLoot.coins} ZC · +${battle.defenderLoot.exp} EXP${battle.defenderLoot.food > 0 ? ` · +${battle.defenderLoot.food} comida` : ""}`
                : `${battle.defenderLoot.coins} ZC · ${battle.defenderLoot.exp} EXP${battle.defenderLoot.food < 0 ? ` · ${battle.defenderLoot.food} comida` : ""}`}
            </p>
            {defenderGained && (
              <p className="mt-1 text-[11px] text-green-400/70">Já adicionado ao cofre da sua equipe.</p>
            )}
          </div>
        )}

        {/* Recompensa ZC de defesa */}
        {battle.isCurrentUserDefender && battle.defenderWon && battle.defenseRewardCoins > 0 && (
          <div className="mt-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 p-3">
            <p className="text-xs font-bold text-[#FFCB05]">🏅 Recompensa de defesa</p>
            <p className="mt-1 text-sm text-slate-200">+{battle.defenseRewardCoins} ZC adicionados ao cofre</p>
          </div>
        )}

        {/* Drop de ovo */}
        {myEgg && (
          <div className="mt-2 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
            <p className="text-xs font-bold text-purple-300">🎁 Drop de ovo!</p>
            <p className="mt-1 text-sm text-slate-200">{EGG_LABEL[myEgg] ?? myEgg} adicionado à sua coleção.</p>
          </div>
        )}

        {battle.injuredCount > 0 && (
          <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-xs font-bold text-red-300">
              {battle.attackerWon
                ? `${battle.injuredCount} mascote(s) seus ficaram feridos`
                : `${battle.injuredCount} mascote(s) do atacante ficaram feridos`}
            </p>
          </div>
        )}

        {/* Resumo de turnos */}
        {battle.turnLines.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
              Ver log de turnos ({battle.rounds} turnos)
            </summary>
            <div className="mt-2 space-y-0.5 max-h-40 overflow-y-auto rounded-lg bg-slate-900/60 p-2">
              {battle.turnLines.map((line, i) => (
                <p key={i} className="text-[10px] text-slate-400">{line}</p>
              ))}
            </div>
          </details>
        )}

        {battle.battleAnimation.length > 0 && (
          <button
            type="button"
            onClick={() => setShowReplay(true)}
            className="mt-4 w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2.5 text-sm font-bold text-[#FFCB05]"
          >
            ▶ Assistir replay completo
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-bold text-slate-950"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export function ArenaHistoryReplayButton({
  battleId,
  perspectivePlayerId,
}: {
  battleId: string;
  perspectivePlayerId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [battle, setBattle] = useState<BattleDetails | null>(null);

  async function openReplay() {
    setLoading(true);
    const response = await getArenaBattleDetailsAction(battleId, perspectivePlayerId);
    setLoading(false);
    if (response.error) {
      toast.error(response.error);
      return;
    }
    if (!response.battle || response.battle.battleAnimation.length === 0) {
      toast.error("Este combate não possui turnos gravados para replay.");
      return;
    }
    setBattle(response.battle);
  }

  if (battle) {
    return (
      <BattleAnimationModal
        turns={battle.battleAnimation as AnimTurn[]}
        playerMascots={battle.playerMascots as MascotInfo[]}
        botMascots={battle.opponentMascots as MascotInfo[]}
        playerTeamName={battle.isCurrentUserDefender ? battle.defenderName : battle.attackerName}
        botName={battle.isCurrentUserDefender ? battle.attackerName : battle.defenderName}
        onFinish={() => setBattle(null)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={openReplay}
      disabled={loading}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#FFCB05]/35 bg-[#FFCB05]/10 px-3 py-1.5 text-[11px] font-semibold text-[#FFCB05] transition hover:bg-[#FFCB05]/15 disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? "Carregando replay..." : "▶ Assistir replay"}
    </button>
  );
}

function ArenaStaleModal({ notice, onClose }: { notice: ArenaStaleNotice; onClose: () => void }) {
  const router = useRouter();
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [battleDetails, setBattleDetails] = useState<BattleDetails | null>(null);

  const handleViewBattle = async () => {
    if (!notice.battleId) return;
    setLoadingBattle(true);
    const r = await getArenaBattleDetailsAction(notice.battleId);
    setLoadingBattle(false);
    if (r.error) { toast.error(r.error); return; }
    if (r.battle) setBattleDetails(r.battle);
  };

  if (battleDetails) {
    return (
      <ArenaBattleResultModal
        battle={battleDetails}
        onClose={() => {
          setBattleDetails(null);
          onClose();
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-400/50 bg-slate-950 p-5 shadow-[0_0_45px_rgba(248,113,113,0.25)]">
        <p className="text-xs font-bold uppercase tracking-widest text-red-300">Arena — ataque PvP recebido</p>
        <h3 className="mt-2 text-xl font-black text-white">Você foi atacado!</h3>
        <p className="mt-2 text-sm text-slate-300">{notice.message}</p>
        {notice.happenedAt && (
          <p className="mt-2 text-[11px] text-slate-500">Ocorrido em {new Date(notice.happenedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        )}
        <div className={`mt-4 grid gap-2 ${notice.battleId ? "sm:grid-cols-2" : ""}`}>
          {notice.battleId && (
            <button
              type="button"
              disabled={loadingBattle}
              onClick={handleViewBattle}
              className="rounded-xl border border-red-400/50 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
            >
              {loadingBattle ? "Carregando…" : "⚔️ Ver combate"}
            </button>
          )}
          <button
            type="button"
            onClick={() => { onClose(); router.refresh(); }}
            className="rounded-xl bg-[#FFCB05] px-3 py-2 text-xs font-bold text-slate-950"
          >
            Atualizar Arena
          </button>
        </div>
      </div>
    </div>
  );
}

export function BotBattleButton({ teamId, teamName = "Sua equipe", teamUpdatedAt, cooldownUntil = null, cooldownAfterMs = 3 * 60 * 1000 }: { teamId: string; teamName?: string; teamUpdatedAt?: string; cooldownUntil?: Date | null; cooldownAfterMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BotBattleResult | null>(null);
  const [staleNotice, setStaleNotice] = useState<ArenaStaleNotice | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>("normal");
  // Após batalha: seta o timestamp absoluto de quando o cooldown termina
  const [postBattleCooldownUntil, setPostBattleCooldownUntil] = useState<Date | null>(null);
  // Usa o cooldown pós-batalha se disponível, senão usa o do servidor
  const activeCooldownUntil = postBattleCooldownUntil ?? cooldownUntil;
  const cooldownExpiry = useTimerExpiry(activeCooldownUntil);
  const onCooldown = !!activeCooldownUntil && !cooldownExpiry.expired;
  const localCooldown = cooldownExpiry.remaining;

  const styles = DIFFICULTY_STYLES[difficulty];

  const handleCloseResult = () => {
    setResult(null);
    router.refresh();
  };

  return (
    <>
      {/* Difficulty selector + battle button */}
      <div className="flex flex-col gap-2 items-end">
        <div className="flex gap-1">
          {(["easy", "normal", "hard"] as ArenaDifficulty[]).map(d => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition-all ${
                difficulty === d ? DIFFICULTY_STYLES[d].border + " " + DIFFICULTY_STYLES[d].bg + " " + DIFFICULTY_STYLES[d].text
                : "border-border text-slate-500 hover:text-slate-300"
              }`}>
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onCooldown && <CooldownBadge until={activeCooldownUntil} />}
          <button
            type="button"
            disabled={pending || onCooldown}
            title={onCooldown ? "Cooldown PvE desta equipe ainda ativo." : undefined}
            onClick={() => {
              startTransition(async () => {
                const lockResult = await lockBotAction(teamId, difficulty);
                if (lockResult.stale) { setStaleNotice(lockResult.stale); toast.error("Voce foi atacado antes desta acao."); return; }
                if (lockResult.error) { toast.error(lockResult.error); return; }
                const response = await runBotBattleAction(teamId, difficulty);
                if (response.stale) { setStaleNotice(response.stale); toast.error("Voce foi atacado antes desta acao."); return; }
                if (response.error) { toast.error(response.error); return; }
                if (response.result) {
                  setResult(response.result);
                  if (!response.result.debugMode) setPostBattleCooldownUntil(new Date(Date.now() + cooldownAfterMs));
                  // Mostra animação primeiro, depois o modal de resultado
                  if (response.result.battleAnimation && response.result.battleAnimation.length > 0) {
                    setShowAnimation(true);
                  }
                } else {
                  router.refresh();
                }
              });
            }}
            className={`rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 transition-all ${
              onCooldown ? "border border-border bg-slate-900 text-slate-500" : "bg-[#FFCB05] text-[#1A1A2E]"
            }`}
          >
            {pending ? "Combatendo…" : "⚔️ Combater"}
          </button>
        </div>
      </div>

      {/* Animação de combate — aparece primeiro */}
      {result && showAnimation && (
        <BattleAnimationModal
          turns={(result.battleAnimation ?? []) as AnimTurn[]}
          playerMascots={(result.playerMascots ?? []) as MascotInfo[]}
          botMascots={result.botMascots as MascotInfo[]}
          playerTeamName={teamName}
          botName={result.botName}
          onFinish={() => setShowAnimation(false)}
        />
      )}

      {/* Modal de resultado — aparece após a animação */}
      {result && !showAnimation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={result.teamDefeated ? undefined : handleCloseResult}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#FFCB05]/30 bg-slate-950 p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#FFCB05]">Resultado da Arena Z</p>
                <h3 className={`mt-1 text-lg font-bold ${result.won ? "text-green-300" : "text-red-300"}`}>
                  {result.won ? "⚔️ Vitória contra bot!" : "💀 Derrota contra bot"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Treinador: <span className="font-semibold text-slate-200">{result.botName}</span>
                  {" "}| {result.rounds} turno(s)
                  {result.difficultyLabel && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      result.difficulty === "easy" ? "bg-green-500/20 text-green-300" :
                      result.difficulty === "hard" ? "bg-red-500/20 text-red-300" :
                      "bg-yellow-500/20 text-yellow-300"
                    }`}>
                      {result.difficultyLabel}
                    </span>
                  )}
                </p>
              </div>
              {!result.teamDefeated && (
                <button type="button" onClick={handleCloseResult} className="rounded-lg border border-border p-2 text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
              <p className="text-xs font-bold text-[#FFCB05]">Cofre</p>
              <p className="mt-1 text-sm text-slate-200">
                {result.won ? `Loot adicionado: ${formatLoot(result.reward)}` : "Nenhum loot foi adicionado nesta luta."}
              </p>
            </div>

            {!result.debugMode && activeCooldownUntil && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                <div>
                  <p className="text-xs font-bold text-sky-200">Próximo combate PvE</p>
                  <p className="mt-0.5 text-[10px] text-sky-100/70">O timer já está contando, sem precisar atualizar a página.</p>
                </div>
                <CooldownBadge until={activeCooldownUntil} />
              </div>
            )}

            {result.injuredMascots.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs font-bold text-red-200">
                  {result.won ? "Mascotes nocauteados (saíram feridos)" : "Mascotes feridos"}
                </p>
                <p className="mt-1 text-sm text-red-100">{result.injuredMascots.join(", ")}</p>
                <p className="mt-1 text-[11px] text-red-200/70">
                  {result.won
                    ? "Eles foram removidos da equipe. O slot fica livre para adicionar um novo mascote."
                    : "Use Atendimento SUS para liberar o mascote depois."}
                </p>
              </div>
            )}

            {result.teamDefeated && (
              <div className="mt-3 rounded-xl border border-red-400/40 bg-red-500/15 p-4">
                <p className="text-sm font-bold text-red-100">💀 Equipe encerrada</p>
                <p className="mt-1 text-sm text-red-100/80">
                  Todos os mascotes foram nocauteados. O time foi dissolvido e o cofre restante foi creditado automaticamente. Cure os mascotes feridos antes de montar uma nova equipe.
                </p>
                {result.preservedLoot && (
                  <p className="mt-2 text-xs text-green-300">
                    ✅ Recebido: {result.preservedLoot.coins} ZC + {result.preservedLoot.exp} EXP
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs font-bold text-slate-300">Equipe do bot</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {result.botMascots.map((m, index) => (
                  <div key={`${m.pokemonId}-${index}`} className="flex items-center gap-2 rounded-xl border border-border bg-slate-900/50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-11 w-11 object-contain" style={{ imageRendering: "pixelated" }} />
                    <span>
                      <span className="block text-xs font-semibold text-slate-100">{m.name}</span>
                      <span className="text-[10px] text-slate-500">Nv.{m.level} | {m.type}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {result.highlights.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-300">Golpes marcantes</p>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  {result.highlights.map(turn => (
                    <p key={turn.turn}>
                      Turno {turn.turn}: <span className="text-slate-200">{turn.actorName}</span> causou <span className="text-[#FFCB05] font-bold">{turn.damage}</span> dano em {turn.targetName}{turn.advantageApplied ? " ⚡ vantagem de tipo" : ""}.
                    </p>
                  ))}
                </div>
              </div>
            )}

            {result.reward.buffItem && result.won && (
              <div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
                <p className="text-xs font-bold text-purple-300">Item especial dificil</p>
                <p className="mt-1 text-sm text-purple-100">{result.reward.buffItem} foi adicionado ao seu inventario.</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleCloseResult}
              className="mt-4 w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-bold text-[#1A1A2E] hover:bg-yellow-400 transition-colors"
            >
              {result.teamDefeated ? "Entendido — fechar" : "Fechar"}
            </button>
          </div>
        </div>
      )}
      {staleNotice && (
        <ArenaStaleModal
          notice={staleNotice}
          onClose={() => {
            markPvpDefenseSeenAction(teamId).catch(() => null);
            setStaleNotice(null);
          }}
        />
      )}
    </>
  );
}

export function RetireTeamButton({ teamId, defeated = false, teamUpdatedAt }: { teamId: string; defeated?: boolean; teamUpdatedAt?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [staleNotice, setStaleNotice] = useState<ArenaStaleNotice | null>(null);

  const handleRetire = () => {
    if (!confirm(defeated ? "Coletar o cofre restante desta equipe derrotada?" : "Retirar equipe da Arena e coletar o cofre agora?")) return;
    startTransition(async () => {
      const r = await retireArenaTeamAction(teamId);
      if (r.stale) { setStaleNotice(r.stale); toast.error("Voce foi atacado antes de sair. Veja o combate primeiro."); return; }
      if (r.error) { toast.error(r.error); return; }
      toast.success(defeated ? "Cofre restante coletado." : "Equipe retirada e cofre coletado.");
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={handleRetire}
        className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300 disabled:opacity-50"
      >
        {pending ? "Processando…" : defeated ? "Coletar cofre restante" : "Retirar e coletar"}
      </button>
      {staleNotice && (
        <ArenaStaleModal
          notice={staleNotice}
          onClose={() => {
            // Ao fechar, marca os ataques PvP como vistos para liberar a próxima ação
            markPvpDefenseSeenAction(teamId).catch(() => null);
            setStaleNotice(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

type PvpResult = Awaited<ReturnType<typeof runPvpBattleAction>>["result"];

export function PvpBattleButton({
  attackTeamId,
  defenseTeamId,
  attackTeamUpdatedAt,
  pvpCooldownUntil,
  label,
  confirmMessage,
}: {
  attackTeamId: string;
  defenseTeamId: string;
  attackTeamUpdatedAt?: string;
  pvpCooldownUntil?: Date | null;
  label?: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PvpResult | null>(null);
  const [animatingResult, setAnimatingResult] = useState<PvpResult | null>(null);
  const [staleNotice, setStaleNotice] = useState<ArenaStaleNotice | null>(null);
  const { expired: cooldownExpired } = useTimerExpiry(pvpCooldownUntil);
  const onCooldown = !!pvpCooldownUntil && !cooldownExpired;

  const handleClose = () => { setResult(null); router.refresh(); };

  return (
    <>
      <button
        type="button"
        disabled={pending || onCooldown}
        title={onCooldown ? "Cooldown PvP desta equipe ainda ativo." : undefined}
        onClick={() => {
          const msg = confirmMessage ?? "Atacar esta equipe? Você pode ganhar ou perder loot do cofre.";
          if (!confirm(msg)) return;
          startTransition(async () => {
            const r = await runPvpBattleAction(attackTeamId, defenseTeamId, attackTeamUpdatedAt);
            if (r.stale) { setStaleNotice(r.stale); toast.error("Voce foi atacado antes desta acao."); return; }
            if (r.error) { toast.error(r.error); return; }
            if (r.result) {
              if (r.result.battleAnimation && r.result.battleAnimation.length > 0) {
                setAnimatingResult(r.result);
              } else {
                setResult(r.result);
              }
              const won = r.result.winnerName !== null;
              const isTraining = r.result.isTrainingBattle;
              toast.success(isTraining ? (won ? "Treino concluído! Vitória 🥊" : "Treino concluído! Derrota.") : (won ? "Vitória no PvP! 🏆" : "Derrota no PvP."));
            } else {
              router.refresh();
            }
          });
        }}
        className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 ${label ? "border-sky-400/40 bg-sky-500/10 text-sky-200 hover:border-sky-300" : "border-red-400/40 bg-red-500/10 text-red-200 hover:border-red-300"}`}
      >
        {pending ? "Combatendo..." : onCooldown ? "Cooldown" : (label ?? "⚔️ Atacar")}
      </button>

      {animatingResult && (
        <BattleAnimationModal
          turns={(animatingResult.battleAnimation ?? []) as AnimTurn[]}
          playerMascots={(animatingResult.playerMascots ?? []) as MascotInfo[]}
          botMascots={(animatingResult.botMascots ?? []) as MascotInfo[]}
          playerTeamName={animatingResult.playerTeamName ?? "Sua equipe"}
          botName={animatingResult.botName ?? "Oponente"}
          onFinish={() => {
            setResult(animatingResult);
            setAnimatingResult(null);
          }}
        />
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={handleClose}>
          <div className="max-w-sm rounded-2xl border border-red-500/30 bg-slate-950 p-5 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs uppercase tracking-widest ${result.isTrainingBattle ? "text-sky-400" : "text-red-400"}`}>
                  {result.isTrainingBattle ? "🥊 Treino" : "Arena PvP"}
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">
                  {result.winnerName ? `${result.isTrainingBattle ? "🥊" : "🏆"} ${result.winnerName} venceu!` : "Empate"}
                </h3>
                {result.isTrainingBattle && (
                  <p className="text-xs text-sky-400/80 mt-0.5">Sem loot, lesões ou impacto no ranking.</p>
                )}
                {result.loserName && (
                  <p className="text-sm text-slate-400">Perdedor: {result.loserName}</p>
                )}
              </div>
              <button onClick={handleClose} className="rounded-lg border border-border p-2 text-slate-400 hover:text-white">
                <X size={14}/>
              </button>
            </div>
            {result.attackerWon && (result.stolen.coins > 0 || result.stolen.exp > 0) && (
              <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
                <p className="text-xs font-bold text-[#FFCB05]">Loot roubado</p>
                <p className="text-sm text-slate-200">
                  {[
                    result.stolen.coins > 0 ? `${result.stolen.coins} ZC` : null,
                    result.stolen.exp > 0 ? `${result.stolen.exp} EXP` : null,
                    result.stolen.food > 0 ? `${result.stolen.food} comida` : null,
                    result.stolen.sweet > 0 ? `${result.stolen.sweet} doce` : null,
                  ].filter(Boolean).join(" / ")}
                </p>
              </div>
            )}
            {result.attackerWon && result.foundGroundSpoils && (
              <div className="relative overflow-hidden rounded-2xl border border-yellow-300/60 bg-gradient-to-br from-yellow-300/20 via-amber-500/10 to-sky-400/10 p-4 shadow-[0_0_35px_rgba(255,203,5,0.25)]">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#FFCB05]/30 blur-2xl animate-pulse" />
                <div className="absolute left-6 top-5 h-3 w-3 rounded-full bg-white/80 animate-ping" />
                <div className="relative flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-200/70 bg-[#FFCB05] text-[#1A1A2E] shadow-lg animate-bounce">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <p className="font-pixel text-xs text-[#FFCB05]">Espolios no chao!</p>
                    <p className="mt-1 text-sm font-semibold text-yellow-50">
                      Sua equipe encontrou {formatLoot(result.foundGroundSpoils)} perdidos pela Arena.
                    </p>
                    {formatSpoilItems((result.foundGroundSpoils as { items?: Array<{ label?: string; type?: string; quantity?: number }> }).items) && (
                      <p className="mt-1 text-sm font-semibold text-yellow-50">
                        Itens enviados para presentes: {formatSpoilItems((result.foundGroundSpoils as { items?: Array<{ label?: string; type?: string; quantity?: number }> }).items)}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-yellow-100/70">
                      Esses recursos vieram dos 10% derrubados por equipes que cairam em combate.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <button onClick={handleClose} className="w-full rounded-xl bg-slate-800 py-2 text-xs text-slate-300">Fechar</button>
          </div>
        </div>
      )}
      {staleNotice && <ArenaStaleModal notice={staleNotice} onClose={() => setStaleNotice(null)} />}
    </>
  );
}

export function SusButton({ mascotId }: { mascotId: string }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => healMascotSusAction(mascotId), "Atendimento SUS concluido.")}
      className="rounded-lg bg-[#FFCB05] px-2 py-1 text-[10px] font-bold text-[#1A1A2E] disabled:opacity-50"
    >
      Atendimento SUS
    </button>
  );
}

export function SusShieldButton({ mascotId, shieldUsedToday }: { mascotId: string; shieldUsedToday: boolean }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending || shieldUsedToday}
      onClick={() => run(() => useSusShieldAction(mascotId), "🛡️ Escudo usado! Repouso reduzido em 20 min.")}
      className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
      title={shieldUsedToday ? "Você já usou seu escudo hoje" : "Usar escudo diário — reduz 20 min de repouso"}
    >
      {shieldUsedToday ? "🛡️ Escudo usado" : "🛡️ Usar Escudo"}
    </button>
  );
}

export function DeleteTeamButton({ teamId, isAdmin = false, teamStatus = "RETIRED" }: { teamId: string; isAdmin?: boolean; teamStatus?: string }) {
  const { pending, run } = useArenaAction();
  const isActive = teamStatus === "ACTIVE";
  const confirmMsg = isActive
    ? "Abandonar equipe? O cofre acumulado será PERDIDO. Os mascotes voltam ao banco sem penalidade de 10 min. Confirmar?"
    : "Remover equipe? Os mascotes voltam ao banco.";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(confirmMsg)) return;
        run(() => deleteArenaTeamAction(teamId), isActive ? "Equipe abandonada." : "Equipe removida.");
      }}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
        isActive
          ? "border-orange-600/40 bg-orange-600/10 text-orange-400 hover:border-orange-400/60 hover:text-orange-300"
          : "border-slate-600/40 bg-slate-800/40 text-slate-400 hover:border-red-500/40 hover:text-red-400"
      }`}
    >
      {isActive ? "🚪 Abandonar" : "🗑 Remover"}
    </button>
  );
}

export function PurgeAdminArenaButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remover TODOS os registros de arena de contas admin? (Batalhas, equipes, loot). Irreversível.")) return;
        startTransition(async () => {
          const r = await purgeAdminArenaDataAction();
          if (r.error) toast.error(r.error);
          else {
            toast.success(`Limpo: ${r.teams} equipes e ${r.battles} batalhas de admin removidas.`);
            router.refresh();
          }
        });
      }}
      className="w-full rounded-xl border border-red-600/40 bg-red-600/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-600/20 disabled:opacity-50"
    >
      {pending ? "Limpando…" : "🧹 Limpar dados de admin da Arena"}
    </button>
  );
}

type AdminArenaTeam = {
  id: string; name: string; status: string; roomLevel: number | null;
  isTraining: boolean; vaultCoins: number; playerName: string; memberCount: number;
};

export function AdminArenaTeamManager() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<AdminArenaTeam[] | null>(null);

  const load = () => {
    setLoading(true);
    startTransition(async () => {
      const r = await listAllArenaTeamsAction();
      setLoading(false);
      if (r.error) { toast.error(r.error); return; }
      setTeams(r.teams ?? []);
    });
  };

  const removeOne = (team: AdminArenaTeam) => {
    if (!confirm(`Remover a equipe "${team.name}" de ${team.playerName}? Os mascotes voltam ao banco (feridos continuam feridos). O cofre não é creditado.`)) return;
    startTransition(async () => {
      const r = await deleteArenaTeamAction(team.id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Equipe removida.");
      setTeams(prev => prev?.filter(t => t.id !== team.id) ?? null);
      router.refresh();
    });
  };

  const removeAll = () => {
    const count = teams?.length ?? 0;
    if (!confirm(`Remover TODAS as ${count} equipes da Arena (de todos os jogadores)? Os mascotes voltam ao banco. Cofres NÃO são creditados. Ação irreversível.`)) return;
    startTransition(async () => {
      const r = await deleteAllArenaTeamsAction();
      if (r.error) { toast.error(r.error); return; }
      toast.success(`${r.teams} equipe(s) removida(s) da Arena.`);
      setTeams([]);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 w-full">
      {teams === null ? (
        <button
          type="button"
          disabled={loading || pending}
          onClick={load}
          className="w-full rounded-xl border border-slate-600/40 bg-slate-800/40 px-3 py-2 text-xs font-bold text-slate-300 hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
        >
          {loading ? "Carregando…" : "🗂 Gerenciar equipes da Arena (todos os jogadores)"}
        </button>
      ) : (
        <div className="rounded-xl border border-border/60 bg-slate-900/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200">{teams.length} equipe(s) na Arena</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={load}
                className="rounded-lg border border-slate-600/40 bg-slate-800/40 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                ↻ Atualizar
              </button>
              {teams.length > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={removeAll}
                  className="rounded-lg border border-red-600/40 bg-red-600/10 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-600/20 disabled:opacity-50"
                >
                  🗑 Remover todas
                </button>
              )}
            </div>
          </div>
          {teams.length === 0 ? (
            <p className="text-[11px] text-slate-500">Nenhuma equipe na Arena.</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {teams.map(team => (
                <div key={team.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-slate-950/40 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-200">{team.name}</p>
                    <p className="truncate text-[10px] text-slate-500">
                      {team.playerName} · {team.isTraining ? "Treino" : `Sala ${team.roomLevel}`} · {team.memberCount} mascote(s)
                      {team.status === "DEFEATED" ? " · derrotada" : ""}
                      {team.vaultCoins > 0 ? ` · ${team.vaultCoins} ZC no cofre` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeOne(team)}
                    className="shrink-0 rounded-lg border border-slate-600/40 bg-slate-800/40 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                  >
                    🗑 Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RepairArenaButton({ targetPlayerId }: { targetPlayerId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<string[] | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const r = await adminRepairArenaAction(targetPlayerId);
            if (r.error) { toast.error(r.error); return; }
            const total = (r.fixedOrphanArena ?? 0) + (r.fixedExpiredResting ?? 0) + (r.deletedEmptyTeams ?? 0) + (r.fixedMismatchedTeamMembers ?? 0);
            toast.success(`Reparo concluído: ${total} item(ns) corrigido(s).`);
            setReport(r.details ?? []);
            router.refresh();
          });
        }}
        className="w-full rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-50"
      >
        {pending ? "Reparando…" : `🔧 Reparar estado da Arena${targetPlayerId ? " (jogador)" : " (global)"}`}
      </button>
      {report && report.length > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-slate-900/60 p-3 text-[10px] text-slate-400 space-y-0.5 max-h-48 overflow-y-auto">
          {report.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}
      {report && report.length === 0 && (
        <p className="text-[10px] text-green-400">✅ Nenhuma inconsistência encontrada.</p>
      )}
    </div>
  );
}

export function AdminMascotStateButton({ mascotId, state, label }: { mascotId: string; state: "FREE" | "INJURED" | "RESTING"; label: string }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => adminSetMascotStateAction(mascotId, state), "Estado atualizado.")}
      className="rounded-lg border border-border bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:text-[#FFCB05] disabled:opacity-50"
    >
      {label}
    </button>
  );
}

// ── Travar bot antes da batalha (determinístico) ──────────────────────────────

export function LockBotButton({ teamId, difficulty }: { teamId: string; difficulty: ArenaDifficulty }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await lockBotAction(teamId, difficulty);
          if (r.error) toast.error(r.error);
          else { toast.success("Adversário travado! Clique em Combater para confirmar."); router.refresh(); }
        });
      }}
      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
    >
      {pending ? "Gerando…" : "🔒 Travar bot"}
    </button>
  );
}

// ── Ataque oportunista contra rival ferido ────────────────────────────────────

export function OpportunisticAttackButton({ mascotId, mascotName, ownerName }: { mascotId: string; mascotName: string; ownerName: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ stolenExp: number; stolenFood: number; extraRestMinutes: number } | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Atacar ${mascotName} de ${ownerName} enquanto está ferido? Você vai roubar EXP e aumentar o tempo de repouso.`)) return;
          startTransition(async () => {
            const r = await runOpportunisticAttackAction(mascotId);
            if (r.error) { toast.error(r.error); return; }
            if (r.result) {
              setResult(r.result);
              toast.success(`Ataque oportunista bem-sucedido! +${r.result.stolenExp} EXP roubados.`);
            }
          });
        }}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
      >
        😈 Atacar enquanto ferido
      </button>
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setResult(null)}>
          <div className="max-w-sm rounded-2xl border border-red-500/30 bg-slate-950 p-5 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-red-200">😈 Ataque Oportunista!</p>
            <p className="text-xs text-slate-300">Você roubou <strong className="text-[#FFCB05]">{result.stolenExp} EXP</strong>{result.stolenFood > 0 ? " e 1 petisco" : ""}.</p>
            <p className="text-xs text-slate-400">Repouso de {mascotName} aumentado em {result.extraRestMinutes} min.</p>
            <button type="button" onClick={() => setResult(null)} className="w-full rounded-lg bg-slate-800 py-2 text-xs text-slate-300">Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}

