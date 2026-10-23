"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { describeAbility, getAbilityInfo } from "@/lib/abilities";
import { TYPE_LABELS_PT } from "@/lib/mascot-data";
import { COMBAT_ROLE_DESCRIPTIONS, COMBAT_ROLE_LABELS } from "@/lib/combat-roles";

// O log grava a postura pelo rótulo ("Defensor"); a descrição é indexada pelo código.
const ROLE_DESCRIPTION: Record<string, string> = Object.fromEntries(
  (Object.keys(COMBAT_ROLE_LABELS) as (keyof typeof COMBAT_ROLE_LABELS)[]).map((k) => [COMBAT_ROLE_LABELS[k], COMBAT_ROLE_DESCRIPTIONS[k]]),
);
import type { ActiveStatus } from "@/lib/replay-status";
import type { Combatant } from "./replay-canvas";

const KIND_HEX: Record<ActiveStatus["kind"], string> = {
  debuff: "#f87171", ability: "#e879f9", protection: "#38bdf8", buff: "#4ade80", personality: "#a78bfa", item: "#facc15",
};
const KIND_LABEL: Record<ActiveStatus["kind"], string> = {
  debuff: "Debuff", ability: "Habilidade", protection: "Proteção", buff: "Buff", personality: "Personalidade", item: "Item",
};
// Cor do anel = efeito mais relevante do mascote.
const PRIORITY: ActiveStatus["kind"][] = ["debuff", "ability", "protection", "buff", "personality", "item"];

function turnsLabel(s: ActiveStatus, turnIdx: number) {
  const n = turnIdx - s.since;
  if (!s.persistent) return n <= 0 ? "neste turno" : "no turno anterior";
  return n <= 0 ? "aplicado neste turno" : `ativo há ${n} turno${n > 1 ? "s" : ""}`;
}

/**
 * Faixa abaixo do campo: só mostra quem está sob algum efeito. Cada lado da
 * tela é um time. Passar o mouse (ou tocar, no celular) abre os detalhes.
 */
export function StatusStrip({ teams, statuses, turnIdx }: { teams: Combatant[]; statuses: Map<string, ActiveStatus[]>; turnIdx: number }) {
  const [open, setOpen] = useState<string | null>(null);
  // Fecha o painel se o mascote deixou de ter efeitos.
  useEffect(() => { if (open && !statuses.has(open)) setOpen(null); }, [open, statuses]);
  const side = (s: "A" | "B") => teams.filter((c) => c.side === s && statuses.has(c.id));
  const any = statuses.size > 0;

  return (
    <div className="relative flex min-h-[64px] items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1.5">
      <style>{`@keyframes zcStatusIn{0%{opacity:0;transform:translateY(8px) scale(.6)}70%{transform:translateY(-2px) scale(1.08)}100%{opacity:1;transform:none}}@keyframes zcStatusPing{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}`}</style>
      {(["A", "B"] as const).map((s) => (
        <div key={s} className={`flex min-w-0 flex-1 flex-wrap items-center gap-1.5 ${s === "B" ? "justify-end" : ""}`}>
          {side(s).map((c) => {
            const list = statuses.get(c.id)!;
            const top = PRIORITY.find((k) => list.some((x) => x.kind === k)) ?? "buff";
            const fresh = list.some((x) => x.since === turnIdx);
            const isOpen = open === c.id;
            return (
              <div key={c.id} className="relative" style={{ animation: "zcStatusIn .45s cubic-bezier(.2,.9,.3,1.3) both" }}
                onMouseEnter={(e) => { if (e.nativeEvent instanceof PointerEvent ? e.nativeEvent.pointerType === "mouse" : true) setOpen(c.id); }}
                onMouseLeave={() => setOpen((cur) => (cur === c.id ? null : cur))}>
                <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}
                  aria-label={`${c.name}: ${list.length} efeito${list.length > 1 ? "s" : ""} ativo${list.length > 1 ? "s" : ""}`}
                  className="relative grid h-11 w-11 place-items-center rounded-full bg-slate-900 transition-transform hover:scale-110"
                  style={{ boxShadow: `0 0 0 2px ${KIND_HEX[top]}, 0 0 14px ${KIND_HEX[top]}66` }}>
                  {fresh && <span key={turnIdx} className="absolute inset-0 rounded-full" style={{ border: `2px solid ${KIND_HEX[top]}`, animation: "zcStatusPing .9s ease-out" }} />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.sprite} alt="" className="h-9 w-9 object-contain" />
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black text-slate-950" style={{ background: KIND_HEX[top] }}>{list.length}</span>
                </button>
                {isOpen && (
                  <div className={`absolute bottom-full z-20 mb-2 w-64 max-w-[80vw] rounded-xl border border-slate-700 bg-slate-950/95 p-2.5 text-left shadow-2xl backdrop-blur ${s === "B" ? "right-0" : "left-0"}`}>
                    <p className="mb-1.5 truncate text-xs font-black text-white">{c.name}</p>
                    <ul className="space-y-1.5">
                      {list.map((x) => (
                        <li key={x.key} className="rounded-lg border border-white/5 bg-white/[.03] px-2 py-1.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-100">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_HEX[x.kind] }} />
                            <span className="truncate">{x.label}</span>
                            <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide" style={{ color: KIND_HEX[x.kind] }}>{KIND_LABEL[x.kind]}</span>
                          </p>
                          {x.detail && <p className="mt-0.5 text-[10px] leading-snug text-slate-300">{x.detail}</p>}
                          <p className="mt-0.5 text-[9px] text-slate-500">
                            {x.source ? `Origem: ${x.source} · ` : ""}{turnsLabel(x, turnIdx)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {!any && <p className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] text-slate-600">Nenhum mascote sob efeito agora</p>}
    </div>
  );
}

const STATE_PT: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Ativa", cls: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30" },
  REDUCED: { label: "Reduzida", cls: "bg-amber-400/15 text-amber-200 border-amber-400/30" },
  OFF: { label: "Desligada", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

/** Card sobre o campo com as habilidades de cada mascote, navegável por time e mascote. */
export function AbilitiesCard({ teams, sideNames, onClose, unrecorded = false }: { teams: Combatant[]; sideNames: { A: string; B: string }; onClose: () => void; unrecorded?: boolean }) {
  const [side, setSide] = useState<"A" | "B">("A");
  const [i, setI] = useState(0);
  const list = teams.filter((c) => c.side === side);
  const c = list[Math.min(i, list.length - 1)];
  const info = getAbilityInfo(c?.ability?.slug);
  const state = c?.ability?.state ? STATE_PT[c.ability.state] : null;
  const go = (d: number) => setI((v) => (v + d + list.length) % list.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#050916]/80 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}
      style={{ animation: "zcCardIn .25s ease-out both" }}>
      <style>{`@keyframes zcCardIn{from{opacity:0}to{opacity:1}}@keyframes zcCardPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}`}</style>
      <div role="dialog" aria-label="Habilidades das equipes" onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-fuchsia-300/25 bg-slate-950/95 shadow-[0_0_40px_rgba(217,70,239,.18)]"
        style={{ animation: "zcCardPop .3s cubic-bezier(.2,.9,.3,1.2) both" }}>
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Sparkles size={15} className="text-fuchsia-300" />
          <p className="text-xs font-black uppercase tracking-widest text-fuchsia-200">Habilidades</p>
          <span className="text-[10px] text-slate-500">combate pausado</span>
          <button type="button" onClick={onClose} aria-label="Fechar e continuar" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex gap-1 px-3 pt-2">
          {(["A", "B"] as const).map((s) => (
            <button key={s} type="button" onClick={() => { setSide(s); setI(0); }}
              className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-[11px] font-bold ${side === s ? "bg-fuchsia-400/20 text-fuchsia-100" : "bg-white/[.03] text-slate-400"}`}>
              {sideNames[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {/* Ordem de ativação: slot e % efetivo de cada mascote, de relance. */}
          {list.map((m, idx) => {
            const pct = typeof m.ability?.factor === "number" ? Math.round(m.ability.factor * 100) : null;
            return (
              <button key={m.id} type="button" onClick={() => setI(idx)} aria-label={`${m.name}${pct !== null ? `, habilidade a ${pct}%` : ""}`}
                className={`flex shrink-0 flex-col items-center gap-0.5 transition ${idx === i ? "" : "opacity-60 hover:opacity-100"}`}>
                <span className={`grid h-10 w-10 place-items-center rounded-full bg-slate-900 ${idx === i ? "ring-2 ring-fuchsia-300" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.sprite} alt="" className="h-8 w-8 object-contain" />
                </span>
                <span className={`text-[9px] font-bold tabular-nums ${pct === null ? "text-slate-600" : pct >= 100 ? "text-emerald-300" : pct > 0 ? "text-amber-300" : "text-slate-500"}`}>
                  {pct === null ? "—" : `${pct}%`}
                </span>
              </button>
            );
          })}
        </div>
        {c && (
          <div key={c.id} className="min-h-0 overflow-y-auto px-3 pb-3" style={{ animation: "zcCardPop .25s ease-out both" }}>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
              <button type="button" onClick={() => go(-1)} aria-label="Mascote anterior" className="rounded-lg p-1 text-slate-400 hover:text-white"><ChevronLeft size={18} /></button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.sprite} alt="" className="h-16 w-16 object-contain" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{c.name}</p>
                <p className="text-[10px] text-slate-400">{(c.types ?? [c.type]).map((t) => TYPE_LABELS_PT[t] ?? t).join(" · ")}</p>
              </div>
              <button type="button" onClick={() => go(1)} aria-label="Próximo mascote" className="rounded-lg p-1 text-slate-400 hover:text-white"><ChevronRight size={18} /></button>
            </div>
            <div className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[.05] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Postura</p>
              <p className="mt-0.5 text-sm font-black text-cyan-100">{c.role ?? "Não registrada"}</p>
              {c.role && ROLE_DESCRIPTION[c.role] && <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{ROLE_DESCRIPTION[c.role]}</p>}
            </div>
            {info ? (
              <div className="mt-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/[.06] p-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-black text-fuchsia-100">
                  ✨ {info.name}
                  {state && <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${state.cls}`}>{c.ability?.slot ? `Slot ${c.ability.slot} · ` : ""}{typeof c.ability?.factor === "number" ? `${Math.round(c.ability.factor * 100)}% · ` : ""}{state.label}</span>}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {[info.category, info.effectName, info.activations > 0 ? `${info.activations}× por luta` : "Passiva"].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">{describeAbility(info)}</p>
                {c.ability?.reason && <p className="mt-2 text-[11px] text-amber-200/90">{c.ability.reason}</p>}
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-white/10 p-3 text-center text-[11px] text-slate-500">
                {unrecorded
                  ? "Este replay é de antes do registro das habilidades: elas atuaram na luta (veja os efeitos no log), mas o detalhe de cada mascote não foi salvo. Lutas novas mostram tudo aqui."
                  : "Sem habilidade passiva nesta luta."}
              </p>
            )}
            <p className="mt-2 text-center text-[10px] text-slate-600">{Math.min(i, list.length - 1) + 1} de {list.length} · use ‹ › para navegar</p>
          </div>
        )}
      </div>
    </div>
  );
}
