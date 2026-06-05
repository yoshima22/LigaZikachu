"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSpriteUrl, getPokemonName } from "@/lib/mascot-data";
import { createArenaTeamAction } from "../actions";

interface ValidMascot {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statVitality: number;
  arenaState: string;
}

const MAX_MASCOTS = 6;

const TEAM_TYPE_OPTIONS = [
  { value: "BOTH" as const, label: "⚔️🤖 PvE + PvP", desc: "Pode fazer bots e desafiar jogadores" },
  { value: "PVE"  as const, label: "🤖 Somente PvE",  desc: "Apenas batalhas contra bots" },
  { value: "PVP"  as const, label: "⚔️ Somente PvP",  desc: "Apenas desafios contra jogadores" },
];

export function CreateTeamForm({ mascots }: { mascots: ValidMascot[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [teamType, setTeamType] = useState<"PVE" | "PVP" | "BOTH">("BOTH");

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_MASCOTS) {
          toast.error(`Máximo de ${MAX_MASCOTS} mascotes por equipe.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) { toast.error("Selecione ao menos 1 mascote."); return; }
    startTransition(async () => {
      const r = await createArenaTeamAction([...selected], name.trim() || "Equipe Arena Z", teamType);
      if (r.error) toast.error(r.error);
      else { toast.success("Equipe criada!"); router.refresh(); setSelected(new Set()); setName(""); }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nome da equipe"
        className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60"
      />

      {/* Tipo de equipe */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-500">Tipo de equipe</p>
        <div className="grid gap-1.5">
          {TEAM_TYPE_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setTeamType(opt.value)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                teamType === opt.value
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-white"
                  : "border-border text-slate-400 hover:border-slate-600"
              }`}>
              <span className="font-semibold">{opt.label}</span>
              <span className="text-slate-500 text-[10px]">— {opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de mascotes */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Mascotes válidos</p>
          <span className={`text-[10px] font-semibold ${selected.size >= MAX_MASCOTS ? "text-[#FFCB05]" : "text-slate-500"}`}>
            {selected.size}/{MAX_MASCOTS} selecionados
          </span>
        </div>
        <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
          {mascots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">
              Nenhum mascote disponível. Mascotes feridos, em repouso, expedição, Bazar ou já em uma equipe ativa não aparecem aqui.
            </p>
          ) : mascots.map(m => {
            const isSel = selected.has(m.id);
            const isDisabled = !isSel && selected.size >= MAX_MASCOTS;
            return (
              <label key={m.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                  isSel ? "border-[#FFCB05]/40 bg-[#FFCB05]/5" :
                  isDisabled ? "border-border/40 opacity-40 cursor-not-allowed" : "border-border/60 bg-slate-900/50 hover:border-[#FFCB05]/30"
                }`}>
                <input
                  type="checkbox"
                  checked={isSel}
                  disabled={isDisabled}
                  onChange={() => !isDisabled && toggle(m.id)}
                  className="h-4 w-4 accent-[#FFCB05]"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-10 w-10 object-contain shrink-0"
                  style={{ imageRendering: "pixelated" }}
                  onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(m.pokemonId); }} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-200">
                    {m.nickname ?? getPokemonName(m.pokemonId)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Nv.{m.level} | For {m.statForce} | Vel {m.statAgility} | Vit {m.statVitality}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || selected.size === 0}
        className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Criando equipe…" : `Criar equipe Arena Z (${selected.size} mascote${selected.size !== 1 ? "s" : ""})`}
      </button>
    </form>
  );
}
