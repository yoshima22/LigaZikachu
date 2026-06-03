"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Heart, Swords, Utensils, Candy, Edit2, Check, X, MapPin, Info } from "lucide-react";
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
  skipExpeditionAction, addExpAdminAction,
  adminBattleMascotsAction, adminFormFriendshipAction,
} from "../actions";
import { MascotSpeechBubble } from "./mascot-speech-bubble";
import { PERSONALITY_DESCRIPTION } from "@/lib/mascot-data";

interface Expedition { id: string; finishAt: Date; status: string }

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
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
  battleWins: number;
  battleLosses: number;
  hatchedAt: Date;
  lastInteractedAt: Date | null;
  lastFedAt: Date | null;
  expeditions: Expedition[];
  events: MascotEvent[];
  hasFood: boolean;
  hasSweet: boolean;
  // Admin: lista de outros mascotes para debug
  otherMascots?: { id: string; name: string }[];
}

interface Props { mascot: MascotData; isAdmin?: boolean }

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

// Status pill
function StatusPill({ label, color, size = "normal" }: { label: string; color: string; size?: "sm" | "normal" }) {
  return (
    <span className={`font-semibold ${color} ${size === "sm" ? "text-[10px]" : "text-[11px]"}`}>{label}</span>
  );
}

export function MascotCard({ mascot, isAdmin = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(mascot.nickname ?? "");
  const [imgFailed, setImgFailed] = useState(false);

  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const expedition = mascot.expeditions.find(e => e.status === "ACTIVE");
  const claimable  = expedition && new Date() >= new Date(expedition.finishAt);
  const expNeeded  = expToNext(mascot.level);
  const expPct     = Math.min(100, Math.round((mascot.exp / expNeeded) * 100));

  // Derived status
  const hungerStatus    = getHungerStatus(mascot.lastFedAt);
  const happinessStatus = getHappinessStatus(mascot.happiness);
  const challengeStatus = getChallengeStatus(mascot.mood);

  // Cooldown 5 min
  const cooldownMs = mascot.lastInteractedAt
    ? Math.max(0, 5 * 60 * 1000 - (Date.now() - new Date(mascot.lastInteractedAt).getTime()))
    : 0;
  const onCooldown = cooldownMs > 0;

  // Button availability — cooldown applies to all interactions including pet
  const inExpedition = !!expedition && !claimable;
  const canPlay      = !inExpedition && !onCooldown && mascot.mood !== "TIRED" && mascot.mood !== "ANGRY";
  const canPet       = !inExpedition && !onCooldown && mascot.mood !== "ANGRY" && !(mascot.personality === "TIMID" && mascot.happiness < 40);
  const canFeedFood  = !inExpedition && mascot.hasFood  && hungerStatus !== "STUFFED";
  const canFeedSweet = !inExpedition && mascot.hasSweet && hungerStatus !== "STUFFED";

  const act = (fn: () => Promise<{ error?: string; result?: unknown }>, successMsg?: string) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else if (successMsg) toast.success(successMsg);
    });
  };

  const handleRename = () => {
    if (!nameInput.trim()) return;
    act(() => renameMascotAction(mascot.id, nameInput), "Nome salvo!");
    setEditingName(false);
  };

  const handleInteract = (type: "PLAY" | "PET" | "FEED_FOOD" | "FEED_SWEET") => {
    startTransition(async () => {
      const r = await interactAction(mascot.id, type);
      if (r.error) toast.error(r.error);
      else if (r.result) {
        if (r.result.refused) toast.info(r.result.message);
        else toast.success(r.result.message);
      }
    });
  };

  const spriteUrl = imgFailed ? getStaticSpriteUrl(mascot.pokemonId) : getSpriteUrl(mascot.pokemonId, true);

  const STATS = [
    { key: "statForce",    label: "Força",      emoji: "💪", value: mascot.statForce,    tip: "Poder em brigas com rivais e expedições pesadas" },
    { key: "statAgility",  label: "Agilidade",  emoji: "⚡", value: mascot.statAgility,  tip: "Eficiência em expedições e iniciativa em brigas" },
    { key: "statCharisma", label: "Carisma",    emoji: "💛", value: mascot.statCharisma, tip: "Chance de fazer amigos e receber mais presentes" },
    { key: "statInstinct", label: "Instinto",   emoji: "🔍", value: mascot.statInstinct, tip: "Encontra itens mais raros em expedições" },
    { key: "statVitality", label: "Vitalidade", emoji: "🛡",  value: mascot.statVitality, tip: "Resiste melhor a humor ruim e efeitos negativos" },
  ];

  return (
    <div className={`rounded-2xl border bg-slate-950/60 overflow-hidden transition-all ${mascot.isEquipped ? "border-[#FFCB05]/50 ring-1 ring-[#FFCB05]/20" : "border-border"}`}>
      {mascot.isEquipped && (
        <div className="bg-[#FFCB05]/10 border-b border-[#FFCB05]/20 px-3 py-1 text-center text-[10px] font-semibold text-[#FFCB05] uppercase tracking-wider">
          ★ Mascote equipado
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
              {" "}· Nv. {mascot.level}
            </div>
            {/* Battle record */}
            {(mascot.battleWins > 0 || mascot.battleLosses > 0) && (
              <div className="text-[9px] text-slate-600">
                ⚔️ {mascot.battleWins}V {mascot.battleLosses}D em batalhas
              </div>
            )}

            {/* EXP bar */}
            <div className="space-y-0.5 pt-0.5">
              <div className="flex justify-between text-[9px] text-slate-600">
                <span>EXP</span><span>{mascot.exp}/{expNeeded}</span>
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

        {/* ── Stats ── */}
        <div className="space-y-1.5">
          {STATS.map(s => (
            <Tip key={s.key} text={s.tip}>
              <div className="flex items-center gap-2">
                <span className="w-4 text-center text-xs shrink-0">{s.emoji}</span>
                <span className="w-16 text-[10px] text-slate-500 shrink-0">{s.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-500 transition-all" style={{ width: `${Math.min(100, s.value)}%` }} />
                </div>
                <span className="w-6 text-right text-[10px] font-bold text-slate-400 shrink-0">{s.value}</span>
                <Info size={9} className="text-slate-700 shrink-0" />
              </div>
            </Tip>
          ))}
        </div>

        {/* ── Expedição ativa ── */}
        {expedition && !claimable && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
            <MapPin size={12} className="shrink-0" />
            <span>Em expedição — volta em {new Date(expedition.finishAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
        {claimable && expedition && (
          <button type="button" disabled={pending}
            onClick={() => act(() => claimExpeditionAction(expedition.id), "🎁 Presente coletado!")}
            className="w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 animate-pulse">
            🎁 Coletar presente da expedição!
          </button>
        )}

        {/* Cooldown info */}
        {onCooldown && (
          <p className="text-[10px] text-center text-slate-600">
            Próxima interação em {Math.ceil(cooldownMs / 60000)} min
          </p>
        )}

        {/* ── Ações ── */}
        <div className="grid grid-cols-2 gap-1.5">
          <Tip text={!canPlay ? (mascot.mood === "TIRED" ? "Está cansado demais" : mascot.mood === "ANGRY" ? "Está bravo" : "Aguarde o cooldown") : "Brincar aumenta felicidade e dá EXP"}>
            <button type="button" disabled={pending || !canPlay} onClick={() => handleInteract("PLAY")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
              ⭐ Brincar
            </button>
          </Tip>
          <Tip text={!canPet ? (mascot.mood === "ANGRY" ? "Está bravo, não quer carinho" : "Pode recusar o carinho agora") : "Carinho sutil. Pode ser recusado."}>
            <button type="button" disabled={pending || !canPet} onClick={() => handleInteract("PET")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
              <Heart size={12}/> Carinho
            </button>
          </Tip>
          <Tip text={!canFeedFood ? (hungerStatus === "STUFFED" ? "Já está empanturrado" : !mascot.hasFood ? "Sem comida no estoque" : "Em expedição") : "Comida sacia por mais tempo"}>
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
          {!expedition && mascot.isEquipped && (
            <Tip text="Só o mascote equipado pode sair em expedição (1h)">
              <button type="button" disabled={pending} onClick={() => act(() => startExpeditionAction(mascot.id), "Expedição iniciada!")}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-40">
                <MapPin size={12}/> Expedição
              </button>
            </Tip>
          )}
          {!mascot.isEquipped && (
            <button type="button" disabled={pending} onClick={() => act(() => equipMascotAction(mascot.id), "Mascote equipado!")}
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

        {/* ── Histórico de eventos ── */}
        {mascot.events.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Histórico</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {mascot.events.slice(0, 8).map(ev => (
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
        {isAdmin && (
          <div className="border-t border-border/40 pt-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FFCB05]/60">⚡ Admin</p>
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
            {mascot.otherMascots && mascot.otherMascots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-600">Trigger vs outro mascote:</p>
                <div className="flex flex-wrap gap-1">
                  {mascot.otherMascots.map(other => (
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
  );
}
