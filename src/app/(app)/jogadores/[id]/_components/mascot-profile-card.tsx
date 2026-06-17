"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  addExpAdminAction,
  adminCancelExpeditionAction,
  adminClaimExpeditionAction,
  adminStartExpeditionAction,
  startExpeditionAction,
} from "@/app/(app)/mascotes/actions";

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
  activeExpedition?: { id: string; finishAt: Date; status: string; rewardJson?: unknown } | null;
}

interface Props {
  mascot: MascotProfileData;
  isOwner: boolean;
  isAdmin?: boolean;
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

export function MascotProfileCard({ mascot, isOwner, isAdmin = false }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [imgFailed, setImgFailed] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [adminExpAmount, setAdminExpAmount] = useState("1000");

  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const spriteUrl = imgFailed ? getStaticSpriteUrl(mascot.pokemonId) : getSpriteUrl(mascot.pokemonId, true);
  const expNeeded = expToNextLevel(mascot.level);
  const expPct = Math.min(100, Math.round((mascot.exp / expNeeded) * 100));

  const hungerStatus    = getHungerStatus(mascot.lastFedAt);
  const happinessStatus = getHappinessStatus(mascot.happiness);
  const challengeStatus = getChallengeStatus(mascot.mood);
  const relations = Array.isArray(mascot.relations) ? mascot.relations : [];
  const events = Array.isArray(mascot.events) ? mascot.events : [];

  const expedition = mascot.activeExpedition;
  const [expRemaining, setExpRemaining] = useState(0);
  useEffect(() => {
    if (!expedition) return;
    const update = () => setExpRemaining(Math.max(0, new Date(expedition.finishAt).getTime() - Date.now()));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expedition]);
  const expReady = expedition && expRemaining === 0;
  const expMinutes = Math.floor(expRemaining / 60000);
  const expSecs = Math.floor((expRemaining % 60000) / 1000);

  const speech = generateMascotSpeech({
    mood: mascot.mood, happiness: mascot.happiness,
    personality: mascot.personality,
    lastFedAt: mascot.lastFedAt, lastInteractedAt: mascot.lastInteractedAt,
    battleWins: mascot.battleWins,
  });

  const friends = relations.filter(r => r.type === "FRIEND");
  const rivals  = relations.filter(r => r.type === "RIVAL");
  const eventsToShow = showAllEvents ? events : events.slice(0, 5);

  const handleExpedition = () => {
    if (!confirm("Enviar mascote em expedição de 1 hora?")) return;
    startTransition(async () => {
      const r = await startExpeditionAction(mascot.id);
      if (r.error) toast.error(r.error);
      else toast.success("Expedição iniciada! Volte em 1 hora.");
    });
  };

  const handleAdminAddExp = () => {
    const amount = Number(adminExpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe uma quantidade positiva de EXP.");
      return;
    }
    if (!confirm(`Adicionar ${Math.floor(amount)} EXP para ${name}?`)) return;
    startTransition(async () => {
      const r = await addExpAdminAction(mascot.id, Math.floor(amount));
      if (r.error) toast.error(r.error);
      else {
        const result = r.result;
        toast.success(result?.leveled ? `EXP aplicada. Novo nivel: ${result.newLevel}.` : "EXP aplicada.");
        router.refresh();
      }
    });
  };


  const expeditionMode = (() => {
    const data = (expedition?.rewardJson ?? {}) as Record<string, unknown>;
    return typeof data.mode === "string" ? data.mode : "STANDARD";
  })();
  const expeditionModeLabel = expeditionMode === "TRAINING" ? "Treinamento" : expeditionMode === "ITEMS" ? "Itens" : "Padrao";

  const runAdminAction = (action: () => Promise<{ error?: string }>, message: string) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else {
        toast.success(message);
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/60">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FFCB05]/8 to-transparent border-b border-border/50 px-4 py-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-[#FFCB05]/60 font-semibold">Mascote</span>
        {mascot.isEquipped && <span className="text-[10px] text-[#FFCB05]">★ Equipado</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Sprite + Info principal */}
        <div className="flex items-start gap-4">
          {/* Sprite com balão — balão aponta PARA BAIXO para evitar clipping */}
          <div className="group relative shrink-0 cursor-help">
            {/* Speech bubble (aparece abaixo do sprite) */}
            <div className="pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 w-max max-w-[180px] opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex justify-center -mb-px">
                <div className="border-8 border-transparent border-b-slate-800" />
              </div>
              <div className="rounded-xl border border-border bg-slate-800 px-3 py-2 text-[11px] text-slate-200 shadow-xl text-center leading-snug">
                {speech}
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

        {/* Status 3-em-1 — melhor espaçamento e legibilidade */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border/50 bg-slate-900/60 py-2.5 px-2">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Fome</p>
            <span className={`text-xs font-bold ${HUNGER_COLOR[hungerStatus]}`}>{HUNGER_LABEL[hungerStatus]}</span>
          </div>
          <div className="rounded-xl border border-border/50 bg-slate-900/60 py-2.5 px-2">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Humor</p>
            <span className={`text-xs font-bold ${HAPPINESS_COLOR[happinessStatus]}`}>{HAPPINESS_LABEL[happinessStatus]}</span>
          </div>
          <div className="rounded-xl border border-border/50 bg-slate-900/60 py-2.5 px-2">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Desafio</p>
            <span className={`text-xs font-bold ${CHALLENGE_COLOR[challengeStatus]}`}>{CHALLENGE_LABEL[challengeStatus]}</span>
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
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${Math.min(100, Math.round((s.value / 250) * 100))}%` }} />
                </div>
                <span className="w-7 text-right text-[10px] font-bold text-slate-400 shrink-0">{s.value}</span>
              </div>
            </Tip>
          ))}
        </div>

        {/* Relações — visível para todos */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Relações</p>
          {friends.length === 0 && rivals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-slate-900/30 px-3 py-3 text-[11px] text-slate-400 leading-relaxed">
              Nenhuma relação registrada ainda.<br/>
              <span className="text-slate-500">Combates são gerados automaticamente quando uma partida é confirmada e ambos os treinadores têm mascotes equipados.</span>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Histórico de eventos — visível para todos */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Histórico</p>
          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-slate-900/30 px-3 py-3 text-[11px] text-slate-400 leading-relaxed">
              Nenhum evento registrado ainda.<br/>
              <span className="text-slate-500">O histórico cresce conforme o mascote interage, batalha com rivais e retorna de expedições.</span>
            </div>
          ) : (
            <>
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
              {events.length > 5 && (
                <button type="button" onClick={() => setShowAllEvents(v => !v)}
                  className="text-[10px] text-slate-600 hover:text-slate-400 underline">
                  {showAllEvents ? "Ver menos" : `Ver todos (${events.length})`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Expedicao */}
        {(isOwner || isAdmin || expedition) && (
          <>
            {expedition && !expReady && (
              <div className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/5 py-2 text-xs text-blue-400">
                <MapPin size={12} /> {expeditionModeLabel}: falta {expMinutes > 0 ? `${expMinutes}m ` : ""}{String(expSecs).padStart(2,"0")}s
              </div>
            )}
            {expedition && expReady && (
              <div className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-green-500/20 bg-green-500/5 py-2 text-xs text-green-300">
                <MapPin size={12} /> {expeditionModeLabel}: pronta para coleta
              </div>
            )}
            {isOwner && !expedition && (
              <button type="button" disabled={pending} onClick={handleExpedition}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-40">
                <MapPin size={12} /> Enviar em expedicao (1h)
              </button>
            )}
            {isAdmin && (
              <div className="grid gap-2 sm:grid-cols-3">
                {expedition ? (
                  <>
                    <button type="button" disabled={pending} onClick={() => runAdminAction(() => adminClaimExpeditionAction(expedition.id), "Expedicao concluida e coletada.")} className="rounded-xl border border-green-500/30 bg-green-500/10 py-2 text-[11px] font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-40">
                      Concluir
                    </button>
                    <button type="button" disabled={pending} onClick={() => runAdminAction(() => adminCancelExpeditionAction(expedition.id), "Expedicao cancelada.")} className="rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40 sm:col-span-2">
                      Cancelar expedicao
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={pending} onClick={() => runAdminAction(() => adminStartExpeditionAction(mascot.id, "30min", "TRAINING"), "Treinamento iniciado.")} className="rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-40">
                      Treinar 30m
                    </button>
                    <button type="button" disabled={pending} onClick={() => runAdminAction(() => adminStartExpeditionAction(mascot.id, "1h", "STANDARD"), "Expedicao padrao iniciada.")} className="rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-40">
                      Padrao 1h
                    </button>
                    <button type="button" disabled={pending} onClick={() => runAdminAction(() => adminStartExpeditionAction(mascot.id, "1h", "ITEMS"), "Expedicao de itens iniciada.")} className="rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-40">
                      Itens 1h
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {isAdmin && (
          <div className="w-full rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFCB05]">Admin: ajustar EXP</p>
            <p className="mt-1 text-[10px] text-slate-500">
              Usa a rotina oficial de level up, status e evolucao. Nao reduz EXP por mascote estar no banco.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                max={100000}
                value={adminExpAmount}
                onChange={(event) => setAdminExpAmount(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
              />
              <button
                type="button"
                disabled={pending}
                onClick={handleAdminAddExp}
                className="rounded-xl bg-[#FFCB05] px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
