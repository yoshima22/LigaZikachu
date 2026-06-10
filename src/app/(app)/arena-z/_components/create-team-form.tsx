"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSpriteUrl, getPokemonName } from "@/lib/mascot-data";
import { addMascotToArenaTeamAction, createArenaTeamAction } from "../actions";

export interface ValidMascot {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statVitality: number;
  statInstinct: number;
  arenaState: string;
  restingUntil: string | null;          // ISO string
  arenaEntryCooldownUntil: string | null; // ISO string
}

const MAX_MASCOTS = 6;

const TEAM_TYPE_OPTIONS = [
  { value: "PVE"  as const, label: "Somente PvE",  desc: "Apenas batalhas contra bots" },
  { value: "PVP"  as const, label: "Somente PvP",  desc: "Apenas desafios contra jogadores" },
  { value: "BOTH" as const, label: "PvE + PvP", desc: "Pode fazer bots e desafiar jogadores" },
];

type FilterTab = "available" | "all";

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

/** Returns null if available, or a { label, until } if blocked */
function getMascotBlock(m: ValidMascot, now: number): { label: string; until?: number } | null {
  if (m.arenaState === "ARENA") return { label: "Na arena" };
  if (m.arenaState === "INJURED") return { label: "Ferido" };
  const resting = m.restingUntil ? new Date(m.restingUntil).getTime() : 0;
  if (m.arenaState === "RESTING" && resting > now) return { label: "Repouso", until: resting };
  const cooldown = m.arenaEntryCooldownUntil ? new Date(m.arenaEntryCooldownUntil).getTime() : 0;
  if (cooldown > now) return { label: "Cooldown arena", until: cooldown };
  return null;
}

/** Live countdown that ticks every second */
function LiveCountdown({ until }: { until: number }) {
  const [remaining, setRemaining] = useState(() => until - Date.now());
  useEffect(() => {
    const tick = () => setRemaining(until - Date.now());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);
  if (remaining <= 0) return <span className="text-green-400">Pronto!</span>;
  return <span>{fmtCountdown(remaining)}</span>;
}

function MascotCard({
  m, selected, disabled, onToggle, now,
}: {
  m: ValidMascot; selected: boolean; disabled: boolean; onToggle: () => void; now: number;
}) {
  const block = getMascotBlock(m, now);
  const isBlocked = block !== null;
  const isClickable = !isBlocked && !disabled;

  const borderCls = selected
    ? "border-[#FFCB05]/50 bg-[#FFCB05]/8 shadow-[0_0_12px_rgba(255,203,5,0.15)]"
    : isBlocked
      ? "border-slate-700/40 bg-slate-900/30 opacity-60"
      : disabled
        ? "border-slate-700/40 opacity-40 cursor-not-allowed"
        : "border-slate-700/60 bg-slate-900/50 hover:border-[#FFCB05]/30 hover:bg-slate-900/80";

  const totalStat = m.statForce + m.statAgility + m.statVitality + m.statInstinct;

  return (
    <button
      type="button"
      disabled={!isClickable && !selected}
      onClick={() => isClickable || selected ? onToggle() : null}
      className={`w-full text-left rounded-xl border p-2.5 transition-all duration-150 ${borderCls}`}
    >
      <div className="flex items-center gap-2.5">
        {/* Sprite */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getSpriteUrl(m.pokemonId, true)}
            alt=""
            className={`h-11 w-11 object-contain ${isBlocked ? "grayscale" : ""}`}
            style={{ imageRendering: "pixelated" }}
            onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(m.pokemonId); }}
          />
          {selected && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFCB05] text-[8px] font-black text-[#1A1A2E]">✓</span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-semibold text-slate-200">
              {m.nickname ?? getPokemonName(m.pokemonId)}
            </p>
            <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">Nv.{m.level}</span>
          </div>

          {/* Stats bar */}
          <div className="mt-1 flex items-center gap-1">
            {[
              { label: "For", val: m.statForce,    color: "bg-red-500" },
              { label: "Vel", val: m.statAgility,  color: "bg-yellow-400" },
              { label: "Ins", val: m.statInstinct, color: "bg-blue-400" },
              { label: "Vit", val: m.statVitality, color: "bg-green-400" },
            ].map(s => (
              <div key={s.label} className="flex-1">
                <div className="mb-0.5 text-center text-[8px] text-slate-500">{s.label}</div>
                <div className="h-1 rounded-full bg-slate-700/60">
                  <div
                    className={`h-full rounded-full ${s.color}`}
                    style={{ width: `${Math.min(100, (s.val / 30) * 100)}%` }}
                  />
                </div>
                <div className="text-center text-[8px] text-slate-400">{s.val}</div>
              </div>
            ))}
            <div className="ml-1 text-[9px] text-slate-500 shrink-0">Σ{totalStat}</div>
          </div>
        </div>
      </div>

      {/* Block reason */}
      {block && (
        <div className={`mt-1.5 flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-medium ${
          block.label === "Cooldown arena"
            ? "bg-orange-500/10 text-orange-300 border border-orange-500/20"
            : block.label === "Repouso"
              ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
              : "bg-slate-700/40 text-slate-400"
        }`}>
          <span>{block.label === "Cooldown arena" ? "⏳" : block.label === "Repouso" ? "💤" : "🚫"}</span>
          <span>{block.label}</span>
          {block.until && <span className="ml-auto font-mono"><LiveCountdown until={block.until} /></span>}
        </div>
      )}
    </button>
  );
}

export function CreateTeamForm({ mascots }: { mascots: ValidMascot[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [teamType, setTeamType] = useState<"PVE" | "PVP" | "BOTH">("PVE");
  const [filter, setFilter] = useState<FilterTab>("available");
  const [now, setNow] = useState(() => Date.now());

  // Update "now" every 5 seconds so block status refreshes
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else {
        if (next.size >= MAX_MASCOTS) { toast.error(`Máximo de ${MAX_MASCOTS} mascotes por equipe.`); return prev; }
        next.add(id);
      }
      return next;
    });
  }, []);

  const available = mascots.filter(m => getMascotBlock(m, now) === null);
  const blocked   = mascots.filter(m => getMascotBlock(m, now) !== null);
  const displayed = filter === "available" ? available : mascots;

  // Sort: selected first, then by level desc
  const sorted = [...displayed].sort((a, b) => {
    const aSel = selected.has(a.id) ? 1 : 0;
    const bSel = selected.has(b.id) ? 1 : 0;
    if (bSel !== aSel) return bSel - aSel;
    return b.level - a.level;
  });

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

      {/* Seletor de mascotes com filtro */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Filtro tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden text-[10px]">
            <button type="button" onClick={() => setFilter("available")}
              className={`px-3 py-1.5 font-semibold transition-colors ${filter === "available" ? "bg-[#FFCB05]/15 text-[#FFCB05]" : "text-slate-500 hover:text-slate-300"}`}>
              ✅ Disponíveis ({available.length})
            </button>
            <button type="button" onClick={() => setFilter("all")}
              className={`px-3 py-1.5 font-semibold transition-colors border-l border-border ${filter === "all" ? "bg-[#FFCB05]/15 text-[#FFCB05]" : "text-slate-500 hover:text-slate-300"}`}>
              Todos ({mascots.length})
            </button>
          </div>
          <span className={`text-[10px] font-semibold ${selected.size >= MAX_MASCOTS ? "text-[#FFCB05]" : "text-slate-500"}`}>
            {selected.size}/{MAX_MASCOTS}
          </span>
        </div>

        {filter === "all" && blocked.length > 0 && (
          <p className="text-[9px] text-slate-600">
            {blocked.length} mascote(s) com cooldown — clique em &quot;Disponíveis&quot; para escondê-los.
          </p>
        )}

        <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-0.5">
          {sorted.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">
              {filter === "available"
                ? "Nenhum mascote disponível agora. Veja a aba \"Todos\" para ver os cooldowns."
                : "Nenhum mascote encontrado."}
            </p>
          ) : sorted.map(m => (
            <MascotCard
              key={m.id}
              m={m}
              selected={selected.has(m.id)}
              disabled={!selected.has(m.id) && selected.size >= MAX_MASCOTS}
              onToggle={() => toggle(m.id)}
              now={now}
            />
          ))}
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

export function AddMascotToTeamForm({ teamId, mascots, slotsUsed }: { teamId: string; mascots: ValidMascot[]; slotsUsed: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mascotId, setMascotId] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const slotsLeft = Math.max(0, MAX_MASCOTS - slotsUsed);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (slotsLeft === 0) return null;

  const available = mascots.filter(m => getMascotBlock(m, now) === null);
  const blocked   = mascots.filter(m => getMascotBlock(m, now) !== null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!mascotId) { toast.error("Escolha um mascote para repor a equipe."); return; }
    startTransition(async () => {
      const result = await addMascotToArenaTeamAction(teamId, mascotId);
      if (result.error) toast.error(result.error);
      else { toast.success("Mascote adicionado ao time!"); setMascotId(""); router.refresh(); }
    });
  };

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Repor equipe ({slotsLeft} slot{slotsLeft > 1 ? "s" : ""})
      </p>
      <div className="flex gap-2">
        <select
          value={mascotId}
          onChange={event => setMascotId(event.target.value)}
          disabled={pending || available.length === 0}
          className="flex-1 min-w-0 rounded-lg border border-border bg-slate-900 px-2 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60 disabled:opacity-50"
        >
          <option value="">{available.length === 0 ? "Nenhum mascote livre" : "Escolha um mascote…"}</option>
          {available.map(m => (
            <option key={m.id} value={m.id}>
              {(m.nickname ?? getPokemonName(m.pokemonId))} Nv.{m.level} (For {m.statForce} / Vel {m.statAgility} / Vit {m.statVitality})
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !mascotId}
          className="rounded-xl bg-[#FFCB05] px-3 py-2 text-xs font-bold text-[#1A1A2E] disabled:opacity-40 shrink-0"
        >
          {pending ? "…" : "Adicionar"}
        </button>
      </div>
      {blocked.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] text-slate-600">{blocked.length} mascote(s) em cooldown:</p>
          {blocked.map(m => {
            const blk = getMascotBlock(m, now)!;
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-900/30 px-2 py-1 text-[9px]">
                <span className="text-slate-400">{m.nickname ?? getPokemonName(m.pokemonId)} Nv.{m.level}</span>
                <span className="text-orange-400 font-mono">
                  {blk.label}{blk.until ? ` – ${fmtCountdown(blk.until - now)}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
