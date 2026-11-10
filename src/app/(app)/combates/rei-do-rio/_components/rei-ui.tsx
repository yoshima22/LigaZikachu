"use client";

import { useEffect, useState, type ReactNode } from "react";
import { COMBAT_ROLE_LABELS, type CombatRole } from "@/lib/combat-roles";
import { getSpriteUrl } from "@/lib/mascot-data";
import { DAY_LABELS, PHASE_LABELS, type Phase } from "@/lib/rei-do-rio/schedule";
import { CATEGORY_LABELS, type PointCategory } from "@/lib/rei-do-rio/scoring";
import { fmtPts } from "@/lib/rei-do-rio/config";

export const roleLabel = (r: string) => COMBAT_ROLE_LABELS[r as CombatRole] ?? r;

/** Neve CSS pura (sem JS por frame). Respeita prefers-reduced-motion. */
export function Snow({ count = 22 }: { count?: number }) {
  return (
    <div aria-hidden className="rdr-snow pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes rdr-fall{0%{transform:translate3d(0,-10%,0)}100%{transform:translate3d(var(--dx),110%,0)}}
        @keyframes rdr-glow{0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes rdr-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .rdr-flake{position:absolute;top:-8%;border-radius:9999px;background:#fff;animation:rdr-fall linear infinite}
        .rdr-rise{animation:rdr-rise .35s ease both}
        .rdr-lights span{animation:rdr-glow 2.4s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.rdr-flake,.rdr-rise,.rdr-lights span{animation:none!important}}
      `}</style>
      {Array.from({ length: count }, (_, i) => {
        const size = 2 + ((i * 7) % 4);
        return <span key={i} className="rdr-flake" style={{ left: `${(i * 97) % 100}%`, width: size, height: size, opacity: 0.35 + ((i * 13) % 5) / 10, animationDuration: `${9 + ((i * 5) % 9)}s`, animationDelay: `-${(i * 3) % 12}s`, ["--dx" as string]: `${((i % 5) - 2) * 18}px` }} />;
      })}
    </div>
  );
}

export function Lights() {
  const colors = ["#ef4444", "#facc15", "#38bdf8", "#4ade80"];
  return (
    <div aria-hidden className="rdr-lights flex justify-between px-2">
      {Array.from({ length: 24 }, (_, i) => <span key={i} className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: colors[i % 4], animationDelay: `${(i % 6) * 0.4}s`, boxShadow: `0 0 8px ${colors[i % 4]}` }} />)}
    </div>
  );
}

export function Countdown({ to, label, className = "" }: { to: string | null; label: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!to) return null;
  const diff = now === null ? null : Math.max(0, new Date(to).getTime() - now);
  const fmt = (n: number) => String(n).padStart(2, "0");
  let text = "--:--:--";
  if (diff !== null) {
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    text = `${d > 0 ? `${d}d ` : ""}${fmt(Math.floor((s % 86400) / 3600))}:${fmt(Math.floor((s % 3600) / 60))}:${fmt(s % 60)}`;
  }
  return (
    <div className={`rounded-xl border border-sky-300/20 bg-sky-950/40 px-3 py-2 text-center ${className}`} role="timer" aria-live="off">
      <p className="text-[10px] font-bold uppercase tracking-widest text-sky-200/70">{label}</p>
      <p className="font-mono text-xl font-black tabular-nums text-white">{text}</p>
    </div>
  );
}

export function Card({ children, className = "", glow = false }: { children: ReactNode; className?: string; glow?: boolean }) {
  return <section className={`rdr-rise rounded-2xl border bg-slate-950/70 p-4 backdrop-blur ${glow ? "border-amber-300/40 shadow-[0_0_30px_-10px_rgba(250,204,21,.5)]" : "border-sky-200/10"} ${className}`}>{children}</section>;
}

export function Title({ children, sub, right }: { children: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-black tracking-tight text-white sm:text-lg">{children}</h2>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Sprite({ id, size = 40, dim = false }: { id: number; size?: number; dim?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={getSpriteUrl(id)} alt="" width={size} height={size} loading="lazy" className={`shrink-0 object-contain [image-rendering:pixelated] ${dim ? "opacity-40 grayscale" : ""}`} style={{ width: size, height: size }} />;
}

export function Pill({ children, tone = "slate", title }: { children: ReactNode; tone?: "slate" | "gold" | "red" | "green" | "blue" | "purple"; title?: string }) {
  const tones = { slate: "bg-slate-800 text-slate-300", gold: "bg-amber-400/15 text-amber-200", red: "bg-red-500/15 text-red-300", green: "bg-emerald-500/15 text-emerald-300", blue: "bg-sky-500/15 text-sky-300", purple: "bg-violet-500/15 text-violet-300" };
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function HpBar({ hp, max, dead }: { hp: number; max: number; dead?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  const color = dead ? "bg-slate-600" : pct > 60 ? "bg-emerald-400" : pct > 30 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800" role="img" aria-label={dead ? "Derrotado" : `HP ${Math.round(pct)}%`}>
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${dead ? 0 : pct}%` }} />
    </div>
  );
}

export function Empty({ icon = "❄️", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-sky-200/15 px-6 py-10 text-center">
      <p className="text-3xl" aria-hidden>{icon}</p>
      <p className="mt-2 font-bold text-white">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-slate-400">{children}</div>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-2" aria-busy>{Array.from({ length: rows }, (_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-800/60" />)}</div>;
}

const STEPS = [
  { key: "PREPARATION", label: "Seg", sub: "Preparação" },
  { key: "RUNNING", label: "Ter–Sex", sub: "Disputa" },
  { key: "FINISHED", label: "Sex 21h", sub: "Coroação" },
];
export function PhaseStepper({ phase, restDay }: { phase: string; restDay: number | null }) {
  const idx = phase === "PREPARATION" ? 0 : phase === "FINISHED" ? 2 : 1;
  return (
    <ol className="flex items-center gap-1 text-[11px]" aria-label="Fase do evento">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1">
          <span className={`rounded-full px-2.5 py-1 font-bold ${i === idx ? "bg-amber-400 text-slate-900" : i < idx ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"}`}>{s.label} · {s.sub}</span>
          {i < STEPS.length - 1 && <span className="text-slate-600">›</span>}
        </li>
      ))}
      <li className="ml-2 text-slate-400">{PHASE_LABELS[phase as Phase] ?? phase}{phase === "REST" && restDay ? ` · edita ${DAY_LABELS[restDay]}` : ""}</li>
    </ol>
  );
}

export const CAT_ORDER: PointCategory[] = ["damage", "ko", "support", "resilience", "win", "leadership"];
export const CAT_COLORS: Record<PointCategory, string> = { damage: "#f97316", ko: "#ef4444", support: "#22c55e", resilience: "#38bdf8", win: "#facc15", leadership: "#a78bfa" };

/** Barra empilhada por categoria de pontos (com legenda numérica opcional). */
export function StackBar({ parts, labels = false, thin = false }: { parts: { key: PointCategory; value: number }[]; labels?: boolean; thin?: boolean }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  if (total <= 0) return <div className={`${thin ? "h-1.5" : "h-2.5"} rounded-full bg-slate-800`} />;
  return (
    <div>
      <div className={`flex overflow-hidden rounded-full bg-slate-800 ${thin ? "h-1.5" : "h-2.5"}`} role="img" aria-label="Composição dos pontos">
        {parts.map((p) => p.value > 0 && <span key={p.key} title={CATEGORY_LABELS[p.key]} style={{ width: `${(p.value / total) * 100}%`, background: CAT_COLORS[p.key] }} />)}
      </div>
      {labels && <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">{parts.filter((p) => p.value > 0).map((p) => <li key={p.key} className="flex items-center gap-1 text-[10px] text-slate-400"><i className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[p.key] }} />{CATEGORY_LABELS[p.key]} <b className="text-white">{fmtPts(p.value)}</b> <span className="text-slate-600">({Math.round((p.value / total) * 100)}%)</span></li>)}</ul>}
    </div>
  );
}

export function Hero({ name, phase, restDay, isTest, right, banner }: { name: string; phase: string; restDay: number | null; isTest: boolean; right?: ReactNode; banner?: string | null }) {
  return (
    <header className={`relative overflow-hidden rounded-3xl border border-sky-200/15 bg-gradient-to-br from-[#0b1d3a] via-[#10294f] to-[#1a1033] p-5 sm:p-7 ${banner ? "sm:min-h-[340px] lg:min-h-[400px]" : ""}`}>
      {banner && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="absolute inset-0 hidden h-full w-full object-cover object-right sm:block" />
          {/* Celular: a arte inteira numa faixa acima do texto (nada de texto sobre a imagem). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative -mx-5 -mt-5 mb-3 overflow-hidden sm:hidden"><img src={banner} alt="" className="block h-auto w-full max-w-none" /></div>
          {/* Escurece a esquerda para o título ficar legível; a arte aparece inteira à direita. */}
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-[#0b1d3a]/70 via-[#0b1d3a]/35 to-transparent sm:block" />
        </>
      )}
      <Snow />
      <div aria-hidden className="absolute -right-6 -top-6 select-none text-[120px] opacity-10">👑</div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-sky-300/10 to-transparent" />
      <div className="relative flex h-full flex-col">
        <Lights />
        <div className="mt-3 flex flex-1 flex-wrap items-start justify-between gap-4">
          <div className="flex h-full min-w-0 flex-col sm:max-w-[55%]">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="red">🔒 Só ADMIN</Pill>
              {isTest && <Pill tone="purple">Edição de teste</Pill>}
            </div>
            <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-4xl">
              <span className="mr-2" aria-hidden>🎄</span>{name}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-sky-100/70">Dezoito mascotes, seis posturas, uma coroa. Monte a equipe na segunda e sobreviva até sexta — os combates acontecem mesmo sem você entrar no site.</p>
            <div className="mt-3"><PhaseStepper phase={phase} restDay={restDay} /></div>
            {banner && right && <div className="mt-auto pt-4">{right}</div>}
          </div>
          {!banner && right}
        </div>
      </div>
    </header>
  );
}
