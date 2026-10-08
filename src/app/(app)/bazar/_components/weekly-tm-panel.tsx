"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2, Lock, Search, ShoppingCart, Sparkles, Users, X } from "lucide-react";
import { buyWeeklyTmSlot } from "../weekly-tm-actions";
import type { WeeklyTmView } from "@/lib/weekly-tm";
import { getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import { ABILITY_CATEGORY_STYLE } from "@/lib/abilities/style";
import type { AbilityCategory } from "@/lib/abilities";

type Slot = WeeklyTmView["slots"][number];

const CATEGORY_GLOW: Record<string, string> = {
  Dano: "#f87171",
  Defesa: "#38bdf8",
  Reflexo: "#fb923c",
  Controle: "#e879f9",
  Suporte: "#34d399",
  "Sobrevivência": "#fbbf24",
};
const SCALE_LABEL: Record<string, string> = { force: "Força", agility: "Agilidade", charisma: "Carisma", instinct: "Instinto", vitality: "Vitalidade" };
const GOLD = "#c9a800";

const fmt = (n: number) => n.toLocaleString("pt-BR");

// ── Contagem regressiva até a segunda-feira 00:00 (Brasília) ──────────────────

function useCountdown(endsAt: string, onEnd: () => void) {
  const [left, setLeft] = useState<number | null>(null);
  const firedRef = useRef(0);
  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, target - Date.now());
      setLeft(remaining);
      // Throttle de 5s: cobre a diferença de relógio entre cliente e servidor sem loop de refresh.
      if (remaining === 0 && Date.now() - firedRef.current > 5000) {
        firedRef.current = Date.now();
        onEnd();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onEnd]);
  return left;
}

function Countdown({ endsAt, onEnd }: { endsAt: string; onEnd: () => void }) {
  const left = useCountdown(endsAt, onEnd);
  const total = left ?? 0;
  const d = Math.floor(total / 86_400_000);
  const h = Math.floor((total % 86_400_000) / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const box = (value: number, label: string) => (
    <div className="min-w-[2.6rem] rounded-lg border border-violet-300/20 bg-violet-950/40 px-1.5 py-1 text-center">
      <p className="text-sm font-black tabular-nums leading-none text-violet-50">{String(value).padStart(2, "0")}</p>
      <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-300/70">{label}</p>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5" role="timer" aria-label="Tempo até o reset dos TMs da semana">
      {left === null ? <span className="text-xs text-violet-200/70">…</span> : (
        <>
          {box(d, "dias")}{box(h, "horas")}{box(m, "min")}{box(s, "seg")}
        </>
      )}
    </div>
  );
}

// ── Modal base (portal, ESC, clique fora, trava a rolagem) ────────────────────

function Modal({ labelledBy, onClose, children, wide = false }: { labelledBy: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-violet-300/25 bg-[#0e0a18] shadow-[0_0_60px_rgba(139,92,246,0.25)] sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-md"}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ── "Quem pode usar": espécies compatíveis e mascotes do jogador ──────────────

function CompatModal({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const hasMine = slot.mine.length > 0;
  const [tab, setTab] = useState<"mine" | "all">(hasMine ? "mine" : "all");
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const term = q.trim().toLowerCase();

  const species = useMemo(
    () => slot.compatibleIds
      .map((id) => ({ id, name: getPokemonName(id) }))
      .filter((x) => !term || x.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [slot.compatibleIds, term],
  );
  const ownedSpecies = useMemo(() => new Set(slot.mine.map((m) => m.pokemonId)), [slot.mine]);
  const mine = useMemo(
    () => slot.mine.filter((m) => !term || (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase().includes(term) || getPokemonName(m.pokemonId).toLowerCase().includes(term)),
    [slot.mine, term],
  );
  const usable = slot.mine.filter((m) => !m.unlocked).length;

  return (
    <Modal labelledBy={`compat-title-${slot.index}`} onClose={onClose} wide>
      <div className="flex shrink-0 items-start gap-3 border-b border-white/10 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slot.imageUrl ?? "/items/ability-tm.svg"} alt="" className="h-12 w-12 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h3 id={`compat-title-${slot.index}`} className="truncate text-base font-black text-white">Quem pode usar o {slot.name}</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
            Libera a habilidade oculta <b className="text-violet-200">{slot.ability?.name}</b> em mascotes que a têm como oculta. Mascotes ainda não lançados não aparecem.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="shrink-0 space-y-3 border-b border-white/10 p-4">
        <div role="tablist" aria-label="Lista" className="flex gap-1.5">
          {([
            ["mine", `Meus mascotes (${slot.mine.length})`, hasMine],
            ["all", `Todos os compatíveis (${slot.compatibleIds.length})`, true],
          ] as const).map(([id, label, enabled]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              disabled={!enabled}
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${tab === id ? "bg-violet-400 text-slate-950" : "border border-white/10 text-slate-300 hover:bg-white/5"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 focus-within:border-violet-300/50">
          <Search size={14} className="shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por nome…"
            aria-label="Filtrar mascotes por nome"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
          />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Limpar filtro" className="text-slate-500 hover:text-white"><X size={13} /></button>}
        </label>
        {tab === "mine" && hasMine && (
          <p className="text-[11px] text-emerald-300/90">
            {usable > 0
              ? `${usable} dos seus mascotes ${usable === 1 ? "pode" : "podem"} receber este TM agora.`
              : "Todos os seus mascotes compatíveis já têm esta habilidade oculta liberada."}
          </p>
        )}
      </div>

      <div className="min-h-[8rem] flex-1 overflow-y-auto p-4">
        {tab === "mine" ? (
          mine.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{q ? `Nenhum mascote seu com “${q}”.` : "Você não tem mascotes compatíveis com este TM."}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {mine.map((m) => (
                <li key={m.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${m.unlocked ? "border-white/10 bg-white/[.02] opacity-60" : "border-emerald-400/40 bg-emerald-400/[.06]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-12 w-12 shrink-0 object-contain [image-rendering:pixelated]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{m.nickname?.trim() || getPokemonName(m.pokemonId)}</p>
                    <p className="text-[10px] text-slate-400">{getPokemonName(m.pokemonId)} · Nv.{m.level}</p>
                  </div>
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black ${m.unlocked ? "border-slate-500/40 text-slate-400" : "border-emerald-400/50 text-emerald-300"}`}>
                    {m.unlocked ? "Oculta já liberada" : "Pode receber"}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : species.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{q ? `Nenhum mascote com “${q}”.` : "Nenhum mascote liberado usa este TM ainda."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-4">
            {species.map((x) => (
              <li key={x.id} className={`flex flex-col items-center rounded-xl border p-2 text-center ${ownedSpecies.has(x.id) ? "border-emerald-400/40 bg-emerald-400/[.05]" : "border-white/10 bg-white/[.02]"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getStaticSpriteUrl(x.id)} alt="" className="h-14 w-14 object-contain [image-rendering:pixelated]" />
                <p className="mt-1 w-full truncate text-[11px] font-bold text-white">{x.name}</p>
                <p className="text-[9px] text-slate-500">#{x.id}</p>
                {ownedSpecies.has(x.id) && <span className="mt-1 rounded bg-emerald-400/15 px-1.5 text-[8px] font-black text-emerald-300">Você tem</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="shrink-0 border-t border-white/10 px-4 py-2.5 text-[10px] leading-relaxed text-slate-500">
        O TM é consumido ao usar e o desbloqueio é permanente (continua após evoluir). Para usar: Mascotes &gt; Itens Especiais.
      </p>
    </Modal>
  );
}

// ── Confirmação de compra ─────────────────────────────────────────────────────

function ConfirmModal({
  slot, currency, price, busy, onConfirm, onClose,
}: { slot: Slot; currency: "ZC" | "LC"; price: number; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const usable = slot.mine.filter((m) => !m.unlocked).length;
  return (
    <Modal labelledBy={`confirm-title-${slot.index}`} onClose={busy ? () => {} : onClose}>
      <div className="p-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.imageUrl ?? "/items/ability-tm.svg"} alt="" className="h-14 w-14 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">Confirmar compra</p>
            <h3 id={`confirm-title-${slot.index}`} className="truncate text-lg font-black text-white">{slot.name}</h3>
          </div>
        </div>
        <dl className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs">
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Valor</dt><dd className="font-black text-white">{fmt(price)} {currency}</dd></div>
          {slot.discountPct > 0 && (
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Promoção</dt><dd className="font-bold text-emerald-300">-{slot.discountPct}% sobre {fmt(slot.originalPrice)} ZC</dd></div>
          )}
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Cópias disponíveis</dt><dd className="font-bold text-amber-200">Só esta, na semana</dd></div>
        </dl>
        {usable > 0 ? (
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-snug text-emerald-300"><Check size={13} className="mt-px shrink-0" /> {usable} {usable === 1 ? "mascote seu pode" : "mascotes seus podem"} receber este TM.</p>
        ) : (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/[.06] p-2 text-[11px] leading-snug text-amber-100"><Lock size={13} className="mt-px shrink-0" /> Nenhum mascote seu pode usar este TM agora. Confira “Quem pode usar” antes de comprar.</p>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">A moeda escolhida não é substituída automaticamente. A compra é definitiva e o slot some para todos até a segunda-feira.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-white/15 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40">Cancelar</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black text-slate-950 transition disabled:opacity-60"
            style={{ background: currency === "LC" ? "#67e8f9" : "#FFCB05" }}
          >
            {busy ? <><Loader2 size={13} className="animate-spin" /> Comprando…</> : <><ShoppingCart size={13} /> Comprar por {fmt(price)} {currency}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Card do slot ──────────────────────────────────────────────────────────────

function SlotCard({
  slot, balance, ligaCashBalance, ligaCashEnabled, loggedIn, busy, onBuy, onCompat,
}: {
  slot: Slot; balance: number; ligaCashBalance: number; ligaCashEnabled: boolean; loggedIn: boolean; busy: boolean;
  onBuy: (slot: Slot, currency: "ZC" | "LC") => void; onCompat: (slot: Slot) => void;
}) {
  const category = slot.ability?.category as AbilityCategory | null | undefined;
  const glow = (category && CATEGORY_GLOW[category]) || "#a78bfa";
  const promo = slot.discountPct > 0;
  const canBuyBase = loggedIn && !slot.sold && slot.available && !busy;
  const canBuyZc = canBuyBase && balance >= slot.finalPrice;
  const canBuyLc = canBuyBase && ligaCashEnabled && ligaCashBalance >= slot.priceLc;
  const usable = slot.mine.filter((m) => !m.unlocked).length;
  const zcLabel = !loggedIn ? "Entre para comprar" : slot.sold ? "Vendido" : !slot.available ? "Indisponível" : balance < slot.finalPrice ? "ZC insuficiente" : `Pagar ${fmt(slot.finalPrice)} ZC`;

  return (
    <li className="relative flex flex-col" aria-label={`${slot.name}, slot ${slot.index + 1}`}>
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-2xl border transition-[box-shadow,transform] duration-300 motion-safe:hover:-translate-y-0.5 ${slot.sold ? "border-white/10" : promo ? "border-amber-300/60" : "border-violet-300/25"}`}
        style={{
          background: "linear-gradient(180deg,#171028 0%,#0d0a15 100%)",
          boxShadow: slot.sold ? "none" : promo ? "0 0 0 1px rgba(251,191,36,.25), 0 10px 40px -12px rgba(251,191,36,.35)" : `0 10px 36px -16px ${glow}55`,
        }}
      >
        {/* faixa superior */}
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="rounded-md border border-white/10 bg-white/[.04] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Slot {slot.index + 1}</span>
          {promo ? (
            <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-[0_0_14px_rgba(251,191,36,.5)]">
              <Sparkles size={10} /> -{slot.discountPct}% da semana
            </span>
          ) : (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Preço cheio</span>
          )}
        </div>

        {/* disco */}
        <div className={`relative flex flex-col items-center px-4 pb-1 pt-3 ${slot.sold ? "grayscale" : ""}`}>
          <div className="relative grid h-24 w-24 place-items-center">
            <span className="absolute inset-0 rounded-full opacity-60 blur-xl" style={{ background: `radial-gradient(circle, ${glow}66, transparent 70%)` }} />
            <span className="absolute inset-1 rounded-full border border-dashed opacity-50 motion-safe:animate-[spin_24s_linear_infinite]" style={{ borderColor: glow }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.imageUrl ?? "/items/ability-tm.svg"} alt="" className="relative h-[4.5rem] w-[4.5rem] object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,.6)]" />
          </div>
          <h3 className="mt-2 w-full truncate text-center text-sm font-black tracking-wide text-white" title={slot.name}>{slot.name}</h3>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            {category && <span className={`rounded border px-1.5 py-px text-[9px] font-bold ${ABILITY_CATEGORY_STYLE[category]}`}>{category}</span>}
            {slot.ability?.effectName && <span className="text-[9px] text-slate-400">{slot.ability.effectName}</span>}
          </div>
        </div>

        {/* descrição */}
        <div className={`flex-1 space-y-1.5 px-3 pb-2 pt-1 ${slot.sold ? "opacity-40" : ""}`}>
          {slot.ability && (
            <>
              <p className="line-clamp-4 text-[11px] leading-snug text-slate-300" title={slot.ability.description}>{slot.ability.description}</p>
              <p className="text-[9px] leading-snug text-slate-500">
                {slot.ability.trigger}
                {" · "}{slot.ability.activations > 0 ? `${slot.ability.activations} ativações` : "passiva"}
                {slot.ability.scale ? ` · cresce com ${SCALE_LABEL[slot.ability.scale] ?? slot.ability.scale}` : ""}
              </p>
              {slot.ability.dex && <p className="line-clamp-2 text-[9px] italic leading-snug text-slate-600" title={`Na Pokédex: ${slot.ability.dex}`}>Na Pokédex: {slot.ability.dex}</p>}
            </>
          )}
        </div>

        {/* compatibilidade */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => onCompat(slot)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-300/30 bg-cyan-300/[.05] px-2 py-1.5 text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <Users size={12} /> Quem pode usar <span className="rounded bg-cyan-300/15 px-1 text-[9px]">{slot.compatibleIds.length}</span>
          </button>
          {loggedIn && (
            <p className={`mt-1.5 text-center text-[10px] leading-tight ${usable > 0 ? "font-semibold text-emerald-300" : "text-slate-500"}`}>
              {usable > 0 ? `✓ ${usable} ${usable === 1 ? "mascote seu pode" : "mascotes seus podem"} usar` : slot.mine.length > 0 ? "Seus compatíveis já têm a oculta" : "Nenhum mascote seu usa este TM"}
            </p>
          )}
        </div>

        {/* preço e compra */}
        <div className="space-y-1.5 border-t border-white/10 bg-black/30 p-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              {promo && <p className="text-[10px] text-slate-500 line-through">{fmt(slot.originalPrice)} ZC</p>}
              <p className="text-base font-black leading-none" style={{ color: "#FFCB05", textShadow: "0 0 10px rgba(255,203,5,.35)" }}>{fmt(slot.finalPrice)} ZC</p>
            </div>
            {ligaCashEnabled && <p className="text-[10px] font-semibold text-cyan-300/80">≈ {fmt(slot.priceLc)} LC</p>}
          </div>
          <button
            type="button"
            disabled={!canBuyZc}
            onClick={() => onBuy(slot, "ZC")}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black transition disabled:cursor-not-allowed"
            style={{ background: canBuyZc ? GOLD : "#2a1a03", color: canBuyZc ? "#1a1209" : "#7a6420", boxShadow: canBuyZc ? "0 0 0 1px #5a4700, 0 2px 10px rgba(201,168,0,.3)" : "none" }}
          >
            {canBuyZc && <ShoppingCart size={12} />} {zcLabel}
          </button>
          {ligaCashEnabled && !slot.sold && slot.available && loggedIn && (
            <button
              type="button"
              disabled={!canBuyLc}
              onClick={() => onBuy(slot, "LC")}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "#67e8f9", boxShadow: "0 0 0 1px #0e7490, 0 2px 10px rgba(103,232,249,.25)" }}
            >
              <ShoppingCart size={12} /> {ligaCashBalance < slot.priceLc ? "LC insuficiente" : `Pagar ${fmt(slot.priceLc)} LC`}
            </button>
          )}
        </div>

        {/* vendido: o slot fica apagado até o reset */}
        {slot.sold && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#07050d]/70 p-4 text-center backdrop-blur-[1px]">
            <div>
              <p className="inline-block -rotate-6 rounded-md border-2 border-rose-400/70 px-3 py-1 text-xl font-black uppercase tracking-[.2em] text-rose-300/90">Vendido</p>
              {slot.soldToName && <p className="mt-3 text-[11px] text-slate-300">Levado por <b className="text-white">{slot.soldToName}</b></p>}
              <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-500"><CalendarClock size={11} /> Volta na segunda, 00:00</p>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

// ── Painel ────────────────────────────────────────────────────────────────────

export function WeeklyTmPanel({
  view, balance, ligaCashBalance, playerId,
}: { view: WeeklyTmView; balance: number; ligaCashBalance: number; playerId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [compat, setCompat] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ index: number; currency: "ZC" | "LC" } | null>(null);
  const [buyingIndex, setBuyingIndex] = useState<number | null>(null);
  const [soldLocal, setSoldLocal] = useState<Record<number, string>>({});

  const refresh = useCallback(() => router.refresh(), [router]);
  // Outros jogadores podem comprar a única cópia: atualiza a vitrine de tempos em tempos.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 45_000);
    return () => clearInterval(id);
  }, [router]);

  const slots = view.slots.map((s) => (soldLocal[s.index] !== undefined ? { ...s, sold: true, soldToName: soldLocal[s.index] || s.soldToName } : s));
  const left = slots.filter((s) => !s.sold && s.available).length;
  const active = confirm ? slots[confirm.index] : null;
  const activePrice = active && confirm ? (confirm.currency === "LC" ? active.priceLc : active.finalPrice) : 0;
  const compatSlot = compat !== null ? slots[compat] : null;

  const doBuy = () => {
    if (!confirm || !active) return;
    const { index, currency } = confirm;
    setBuyingIndex(index);
    start(async () => {
      const res = await buyWeeklyTmSlot(index, currency);
      if (res.error) toast.error(res.error, { duration: 8000 });
      else {
        toast.success(`${res.name ?? "TM"} adicionado ao seu inventário! 💿`);
        setSoldLocal((cur) => ({ ...cur, [index]: "você" }));
      }
      setBuyingIndex(null);
      setConfirm(null);
      router.refresh();
    });
  };

  return (
    <section
      aria-labelledby="weekly-tm-title"
      className="relative overflow-hidden rounded-3xl border border-violet-300/25 p-4 sm:p-6"
      style={{ background: "linear-gradient(135deg,#150b26 0%,#0d0b12 55%,#1a1305 100%)", boxShadow: "0 0 50px -18px rgba(139,92,246,.45)" }}
    >
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

      <header className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-violet-300">Miauvadão · Vitrine semanal</p>
          <h2 id="weekly-tm-title" className="mt-1 flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
            <span aria-hidden>💿</span> TMs da Semana
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
            Cinco TMs de habilidade oculta, todos diferentes e com <b className="text-slate-200">uma única cópia cada</b>. Eles <b className="text-slate-200">não trocam a cada 6 horas</b> e não podem ser sorteados de novo: só renovam na segunda-feira, às 00:00 (Brasília).
            Um deles está em promoção.
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-violet-300/20 bg-black/30 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-violet-300/80"><CalendarClock size={11} /> Renova em</p>
          <Countdown endsAt={view.weekEndsAt} onEnd={refresh} />
        </div>
      </header>

      {slots.length === 0 ? (
        <div className="relative mt-5 rounded-2xl border border-dashed border-violet-300/25 p-8 text-center">
          <p className="text-sm font-bold text-slate-200">Os TMs desta semana ainda não foram liberados.</p>
          <p className="mt-1 text-xs text-slate-500">Assim que houver TMs disponíveis na loja, os cinco slots aparecem aqui.</p>
        </div>
      ) : (
        <>
          <p className="relative mt-4 text-[11px] text-slate-400" aria-live="polite">
            {left > 0 ? <><b className="text-slate-200">{left}</b> de {slots.length} ainda {left === 1 ? "disponível" : "disponíveis"} nesta semana.</> : "Todos os TMs desta semana já foram vendidos. Voltam na segunda-feira."}
          </p>
          <ul className="relative mt-3 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {slots.map((slot) => (
              <SlotCard
                key={slot.shopItemId}
                slot={slot}
                balance={balance}
                ligaCashBalance={ligaCashBalance}
                ligaCashEnabled={view.ligaCashEnabled}
                loggedIn={Boolean(playerId)}
                busy={pending && buyingIndex === slot.index}
                onBuy={(s, currency) => setConfirm({ index: s.index, currency })}
                onCompat={(s) => setCompat(s.index)}
              />
            ))}
          </ul>
        </>
      )}

      {compatSlot && <CompatModal slot={compatSlot} onClose={() => setCompat(null)} />}
      {active && confirm && (
        <ConfirmModal slot={active} currency={confirm.currency} price={activePrice} busy={pending} onConfirm={doBuy} onClose={() => setConfirm(null)} />
      )}
    </section>
  );
}
