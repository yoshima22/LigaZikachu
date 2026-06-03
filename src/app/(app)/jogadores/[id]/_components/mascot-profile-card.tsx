"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import {
  getSpriteUrl, getStaticSpriteUrl, getPokemonName,
  expToNextLevel, MOOD_EMOJI, MOOD_LABEL, PERSONALITY_LABEL, PERSONALITY_DESCRIPTION,
  getHungerStatus, getHappinessStatus, getChallengeStatus,
  HUNGER_LABEL, HAPPINESS_LABEL, CHALLENGE_LABEL,
  HUNGER_COLOR, HAPPINESS_COLOR, CHALLENGE_COLOR,
  generateMascotSpeech,
} from "@/lib/mascot-data";
import { startExpeditionAction } from "@/app/(app)/mascotes/actions";

interface MascotEvent { id: string; emoji: string; description: string; createdAt: Date }
interface MascotRelation {
  id: string;
  type: string;
  wins: number;
  losses: number;
  otherMascot: { id: string; pokemonId: number; nickname: string | null; player: { displayName: string } };
}

interface MascotProfileData {
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
  events: MascotEvent[];
  relations: MascotRelation[];
}

interface Props {
  mascot: MascotProfileData;
  isOwner: boolean;
}

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 w-max max-w-[200px] whitespace-normal rounded-lg border border-border bg-slate-900 px-2.5 py-1.5 text-[10px] text-slate-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 text-center">
        {text}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

export function MascotProfileCard({ mascot, isOwner }: Props) {
  const [pending, startTransition] = useTransition();
  const [imgFailed, setImgFailed] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const spriteUrl = imgFailed ? getStaticSpriteUrl(mascot.pokemonId) : getSpriteUrl(mascot.pokemonId, true);
  const expNeeded = expToNextLevel(mascot.level);
  const expPct = Math.min(100, Math.round((mascot.exp / expNeeded) * 100));

  const hungerStatus    = getHungerStatus(mascot.lastFedAt);
  const happinessStatus = getHappinessStatus(mascot.happiness);
  const challengeStatus = getChallengeStatus(mascot.mood);

  const hasActiveExpedition = false; // would need expedition data — simplify for profile

  const speech = generateMascotSpeech({
    mood: mascot.mood, happiness: mascot.happiness,
    personality: mascot.personality,
    lastFedAt: mascot.lastFedAt, lastInteractedAt: mascot.lastInteractedAt,
    battleWins: mascot.battleWins,
  });

  const friends = mascot.relations.filter(r => r.type === "FRIEND");
  const rivals  = mascot.relations.filter(r => r.type === "RIVAL");
  const eventsToShow = showAllEvents ? mascot.events : mascot.events.slice(0, 5);

  const handleExpedition = () => {
    if (!confirm("Enviar mascote em expedição de 1 hora?")) return;
    startTransition(async () => {
      const r = await startExpeditionAction(mascot.id);
      if (r.error) toast.error(r.error);
      else toast.success("Expedição iniciada! Volte em 1 hora.");
    });
  };

  return (
    <div className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/60 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FFCB05]/8 to-transparent border-b border-border/50 px-4 py-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-[#FFCB05]/60 font-semibold">Mascote</span>
        {mascot.isEquipped && <span className="text-[10px] text-[#FFCB05]">★ Equipado</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Sprite + Info principal */}
        <div className="flex items-start gap-4">
          {/* Sprite com balão */}
          <div className="group relative shrink-0 cursor-help">
            {/* Speech bubble */}
            <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 w-max max-w-[160px] opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-[11px] text-slate-200 shadow-xl text-center leading-snug">
                {speech}
              </div>
              <div className="flex justify-center">
                <div className="border-8 border-transparent border-t-slate-900 -mt-px" />
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={spriteUrl} alt={name} width={80} height={80}
              className="object-contain drop-shadow-[0_0_10px_rgba(255,203,5,0.25)]"
              style={{ imageRendering: "pixelated" }}
              onError={() => setImgFailed(true)} />
            <span className="absolute -top-1 -right-1 text-lg leading-none">{MOOD_EMOJI[mascot.mood] ?? "😐"}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div>
              <p className="font-bold text-white text-base leading-tight">{name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                #{mascot.pokemonId} ·{" "}
                <Tip text={PERSONALITY_DESCRIPTION[mascot.personality] ?? ""}>
                  <span className="underline decoration-dotted cursor-help">
                    {PERSONALITY_LABEL[mascot.personality]}
                  </span>
                </Tip>
                {" "}· Nv. {mascot.level}
              </p>
              {(mascot.battleWins > 0 || mascot.battleLosses > 0) && (
                <p className="text-[9px] text-slate-600 mt-0.5">
                  ⚔️ {mascot.battleWins}V {mascot.battleLosses}D em batalhas
                </p>
              )}
            </div>

            {/* EXP */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-slate-600">
                <span>EXP</span><span>{mascot.exp}/{expNeeded}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#FFCB05] to-[#FFD700]" style={{ width: `${expPct}%` }} />
              </div>
            </div>

            {/* Happiness */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-slate-600">
                <span>Felicidade</span><span>{mascot.happiness}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${mascot.happiness}%`,
                  background: mascot.happiness >= 60 ? "#4ade80" : mascot.happiness >= 30 ? "#fb923c" : "#ef4444"
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Status 3-em-1 */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="rounded-lg bg-slate-900/60 py-1.5 px-1">
            <p className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Fome</p>
            <span className={`text-[10px] font-semibold ${HUNGER_COLOR[hungerStatus]}`}>{HUNGER_LABEL[hungerStatus]}</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-1.5 px-1">
            <p className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Humor</p>
            <span className={`text-[10px] font-semibold ${HAPPINESS_COLOR[happinessStatus]}`}>{HAPPINESS_LABEL[happinessStatus]}</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-1.5 px-1">
            <p className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Desafio</p>
            <span className={`text-[10px] font-semibold ${CHALLENGE_COLOR[challengeStatus]}`}>{CHALLENGE_LABEL[challengeStatus]}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-1">
          {[
            { label: "Força",      emoji: "💪", value: mascot.statForce,    tip: "Poder em batalhas e expedições pesadas" },
            { label: "Agilidade",  emoji: "⚡", value: mascot.statAgility,  tip: "Eficiência em expedições e iniciativa em batalhas" },
            { label: "Carisma",    emoji: "💛", value: mascot.statCharisma, tip: "Chance de amizades e mais presentes" },
            { label: "Instinto",   emoji: "🔍", value: mascot.statInstinct, tip: "Encontra itens mais raros em expedições" },
            { label: "Vitalidade", emoji: "🛡",  value: mascot.statVitality, tip: "Resistência a humor ruim e efeitos negativos" },
          ].map(s => (
            <Tip key={s.label} text={s.tip}>
              <div className="flex items-center gap-2 cursor-help">
                <span className="w-4 text-center text-xs shrink-0">{s.emoji}</span>
                <span className="w-16 text-[10px] text-slate-500 shrink-0">{s.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${Math.min(100, s.value)}%` }} />
                </div>
                <span className="w-5 text-right text-[10px] font-bold text-slate-400 shrink-0">{s.value}</span>
              </div>
            </Tip>
          ))}
        </div>

        {/* Relações — visível para todos */}
        {(friends.length > 0 || rivals.length > 0) && (
          <div className="space-y-2">
            {friends.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-green-400 mb-1">💚 Amigos ({friends.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {friends.map(r => (
                    <div key={r.id} className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getSpriteUrl(r.otherMascot.pokemonId)} alt="" width={18} height={18} style={{ imageRendering: "pixelated" }} />
                      <span className="text-[10px] text-slate-300">
                        {r.otherMascot.nickname ?? getPokemonName(r.otherMascot.pokemonId)}
                        <span className="text-slate-500"> ({r.otherMascot.player.displayName})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {rivals.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-400 mb-1">⚔️ Rivais ({rivals.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {rivals.map(r => (
                    <div key={r.id} className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2 py-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getSpriteUrl(r.otherMascot.pokemonId)} alt="" width={18} height={18} style={{ imageRendering: "pixelated" }} />
                      <span className="text-[10px] text-slate-300">
                        {r.otherMascot.nickname ?? getPokemonName(r.otherMascot.pokemonId)}
                        <span className="text-slate-500"> ({r.otherMascot.player.displayName})</span>
                        <span className="text-[9px] text-slate-600 ml-1">{r.wins}V {r.losses}D</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Histórico de eventos — visível para todos */}
        {mascot.events.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Histórico</p>
            <div className="space-y-1">
              {eventsToShow.map(ev => (
                <div key={ev.id} className="flex items-start gap-1.5 text-[10px] text-slate-500">
                  <span className="shrink-0">{ev.emoji}</span>
                  <span className="leading-snug flex-1">{ev.description}</span>
                  <span className="shrink-0 text-slate-700">
                    {new Date(ev.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
            {mascot.events.length > 5 && (
              <button type="button" onClick={() => setShowAllEvents(v => !v)}
                className="text-[10px] text-slate-600 hover:text-slate-400 underline">
                {showAllEvents ? "Ver menos" : `Ver todos (${mascot.events.length})`}
              </button>
            )}
          </div>
        )}

        {/* Expedição — só para o dono */}
        {isOwner && (
          <button type="button" disabled={pending} onClick={handleExpedition}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-40">
            <MapPin size={12} /> Enviar em expedição (1h)
          </button>
        )}
      </div>
    </div>
  );
}
