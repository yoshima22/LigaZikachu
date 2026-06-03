"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Heart, Swords, Utensils, Candy, Star, Edit2, Check, X, MapPin } from "lucide-react";
import { getSpriteUrl, getPokemonName, expToNextLevel, MOOD_EMOJI, MOOD_LABEL, PERSONALITY_LABEL } from "@/lib/mascot-data";
import { interactAction, equipMascotAction, renameMascotAction, startExpeditionAction, claimExpeditionAction } from "../actions";

interface Expedition { id: string; finishAt: Date; status: string }

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
  hatchedAt: Date;
  expeditions: Expedition[];
  hasFood: boolean;
  hasSweet: boolean;
}

interface Props { mascot: MascotData }

export function MascotCard({ mascot }: Props) {
  const [pending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(mascot.nickname ?? "");

  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const expedition = mascot.expeditions.find(e => e.status === "ACTIVE");
  const claimable  = mascot.expeditions.find(e => e.status === "ACTIVE" && new Date() >= new Date(e.finishAt));
  const expNeeded  = expToNextLevel(mascot.level);
  const expPct     = Math.min(100, Math.round((mascot.exp / expNeeded) * 100));

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
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getSpriteUrl(mascot.pokemonId)}
              alt={name}
              width={72} height={72}
              className="object-contain pixelated drop-shadow-[0_0_8px_rgba(255,203,5,0.3)]"
              style={{ imageRendering: "pixelated" }}
            />
            <span className="absolute -top-1 -right-1 text-base leading-none">
              {MOOD_EMOJI[mascot.mood] ?? "😐"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={20}
                  className="flex-1 rounded-lg border border-[#FFCB05]/40 bg-slate-900 px-2 py-1 text-sm text-white outline-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingName(false); }}
                />
                <button onClick={handleRename} className="text-[#FFCB05]"><Check size={14}/></button>
                <button onClick={() => setEditingName(false)} className="text-slate-500"><X size={14}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white truncate">{name}</span>
                <button onClick={() => setEditingName(true)} className="text-slate-600 hover:text-slate-400">
                  <Edit2 size={11}/>
                </button>
              </div>
            )}
            <div className="text-[10px] text-slate-500 mt-0.5">
              #{mascot.pokemonId} · {PERSONALITY_LABEL[mascot.personality]} · Nv. {mascot.level}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{MOOD_LABEL[mascot.mood]}</div>

            {/* EXP bar */}
            <div className="mt-2 space-y-0.5">
              <div className="flex justify-between text-[9px] text-slate-600">
                <span>EXP</span>
                <span>{mascot.exp}/{expNeeded}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#FFCB05] to-[#FFD700] transition-all" style={{ width: `${expPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Felicidade */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><Heart size={10} /> Felicidade</span>
            <span>{mascot.happiness}/100</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 transition-all"
              style={{ width: `${mascot.happiness}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { label: "💪", value: mascot.statForce,    tip: "Força" },
            { label: "⚡", value: mascot.statAgility,  tip: "Agilidade" },
            { label: "💛", value: mascot.statCharisma, tip: "Carisma" },
            { label: "🔍", value: mascot.statInstinct, tip: "Instinto" },
            { label: "🛡", value: mascot.statVitality, tip: "Vitalidade" },
          ].map(s => (
            <div key={s.tip} className="rounded-lg bg-slate-900/50 py-1">
              <div className="text-sm">{s.label}</div>
              <div className="text-[10px] font-bold text-slate-300">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Expedição ativa */}
        {expedition && !claimable && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
            <MapPin size={12} className="shrink-0" />
            <span>Em expedição — volta em {new Date(expedition.finishAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

        {claimable && (
          <button
            type="button" disabled={pending}
            onClick={() => act(() => claimExpeditionAction(claimable.id), "Presente coletado!")}
            className="w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20"
          >
            🎁 Coletar presente da expedição!
          </button>
        )}

        {/* Ações */}
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={pending || !!expedition} onClick={() => handleInteract("PLAY")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-40">
            <Star size={12}/> Brincar
          </button>
          <button type="button" disabled={pending || !!expedition} onClick={() => handleInteract("PET")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-40">
            <Heart size={12}/> Carinho
          </button>
          <button type="button" disabled={pending || !mascot.hasFood || !!expedition} onClick={() => handleInteract("FEED_FOOD")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-40">
            <Utensils size={12}/> Comida
          </button>
          <button type="button" disabled={pending || !mascot.hasSweet || !!expedition} onClick={() => handleInteract("FEED_SWEET")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-slate-300 hover:border-slate-500 disabled:opacity-40">
            <Candy size={12}/> Doce
          </button>
        </div>

        {/* Expedição + Equipar */}
        <div className="flex gap-2">
          {!expedition && (
            <button type="button" disabled={pending} onClick={() => act(() => startExpeditionAction(mascot.id), "Expedição iniciada! Volte em 1 hora.")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-40">
              <MapPin size={12}/> Expedição
            </button>
          )}
          {!mascot.isEquipped && (
            <button type="button" disabled={pending} onClick={() => act(() => equipMascotAction(mascot.id), "Mascote equipado!")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 py-2 text-xs font-medium text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">
              <Swords size={12}/> Equipar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
