"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";

export type BookSpread = {
  id: string;
  chapterTitle: string;
  accent: string;
  locked: boolean;
  number: number;
  /** Só preenchidos quando desbloqueado. */
  pokemonName: string | null;
  title: string | null;
  story: string[];
  facts: string[];
  art: string | null;
  imageUrl: string | null;
  hints: string[];
};

const FLIP_MS = 900;
const PAPER = "bg-[#e9d7ab] bg-[radial-gradient(ellipse_at_center,#f1e2bb_0%,#e2cd9b_70%,#c9ae76_100%)]";
const INK = "text-[#3a2a14]";

function LeftPage({ s, index, total }: { s: BookSpread; index: number; total: number }) {
  return (
    <div className={`relative flex h-full flex-col overflow-hidden p-6 md:p-8 ${PAPER} ${INK}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-60">{s.chapterTitle}</p>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-widest opacity-60">
        N.º {String(s.number).padStart(3, "0")}
        {!s.locked && s.pokemonName ? ` · ${s.pokemonName}` : ""}
      </p>
      {s.locked ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8c2b24] text-[#f3d9c4] shadow-[0_3px_8px_rgba(0,0,0,0.45)] ring-4 ring-[#8c2b24]/30">
            <Lock size={26} />
          </div>
          <h3 className="mt-5 font-serif text-xl font-bold">Página selada</h3>
          <p className="mt-2 text-xs opacity-70">Para romper o selo (qualquer um):</p>
          <ul className="mt-2 space-y-1 text-sm">
            {s.hints.map((h, i) => (
              <li key={i}>• {h}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-2 flex-1 overflow-y-auto pr-1">
          <h3 className="font-serif text-xl font-bold leading-tight md:text-2xl">{s.title}</h3>
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-[#8a6a35] to-transparent" />
          {s.story.map((p, i) => (
            <p
              key={i}
              className={`mb-3 font-serif text-[13px] leading-relaxed md:text-sm ${
                i === 0 ? "first-letter:float-left first-letter:mr-1 first-letter:font-bold first-letter:leading-[0.8] first-letter:text-4xl first-letter:text-[#7a3b1c]" : ""
              }`}
            >
              {p}
            </p>
          ))}
          {s.facts.length > 0 && (
            <div className="mt-4 border-t border-[#8a6a35]/40 pt-3">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#7a3b1c]">
                <Sparkles size={11} /> Você sabia?
              </p>
              <ul className="space-y-1 font-serif text-xs italic">
                {s.facts.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-center font-serif text-[11px] opacity-50">— {index * 2 + 1} —</p>
      <span className="sr-only">{total}</span>
    </div>
  );
}

/**
 * Efeito de desenho a nanquim/gravura em CSS puro (funciona com qualquer URL remota):
 * cinza + cópia invertida e borrada em color-dodge = só os contornos ficam escuros;
 * depois sépia e multiply sobre o pergaminho.
 */
function SketchImage({ src, alt }: { src: string; alt: string }) {
  const layer = "object-contain p-5";
  return (
    <div
      className="absolute inset-0 bg-white"
      style={{ isolation: "isolate", mixBlendMode: "multiply", filter: "sepia(.85) contrast(1.35) brightness(1.02)" }}
    >
      <Image src={src} alt={alt} fill unoptimized sizes="420px" className={layer} style={{ filter: "grayscale(1) contrast(1.15)" }} />
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        unoptimized
        sizes="420px"
        className={layer}
        style={{ filter: "grayscale(1) invert(1) blur(3px)", mixBlendMode: "color-dodge" }}
      />
    </div>
  );
}

function RightPage({ s, index }: { s: BookSpread; index: number }) {
  const src = !s.locked && s.art ? s.art : s.imageUrl;
  return (
    <div className={`relative flex h-full flex-col overflow-hidden p-6 md:p-8 ${PAPER} ${INK}`}>
      <div
        className="relative flex-1 overflow-hidden rounded-sm border-[3px] border-double bg-[#d9c28d]/60 shadow-inner"
        style={{ borderColor: `${s.accent}aa` }}
      >
        {src && s.locked && (
          <Image src={src} alt="Página selada" fill unoptimized sizes="420px" className="object-contain p-6 brightness-0 opacity-30" />
        )}
        {src && !s.locked && s.art && (
          <Image src={src} alt={s.title ?? ""} fill unoptimized sizes="420px" className="object-cover" />
        )}
        {src && !s.locked && !s.art && <SketchImage src={src} alt={s.title ?? ""} />}
      </div>
      <p className="mt-2 text-center font-serif text-[11px] opacity-50">— {index * 2 + 2} —</p>
    </div>
  );
}

export function JournalBook({ spreads }: { spreads: BookSpread[] }) {
  const [index, setIndex] = useState(0);
  const [pageText, setPageText] = useState("");
  const [flip, setFlip] = useState<{ dir: 1 | -1; go: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = spreads.length;

  const turn = useCallback(
    (dir: 1 | -1) => {
      if (flip) return;
      const next = index + dir;
      if (next < 0 || next >= total) return;
      setFlip({ dir, go: false });
      requestAnimationFrame(() => requestAnimationFrame(() => setFlip({ dir, go: true })));
      timer.current = setTimeout(() => {
        setIndex(next);
        setFlip(null);
      }, FLIP_MS);
    },
    [flip, index, total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn(1);
      if (e.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (total === 0) return null;
  const cur = spreads[index];
  const target = flip ? spreads[index + flip.dir] : null;

  // Páginas estáticas por baixo da folha que gira.
  const baseLeft = flip?.dir === -1 && target ? target : cur;
  const baseRight = flip?.dir === 1 && target ? target : cur;
  const baseLeftIdx = flip?.dir === -1 ? index - 1 : index;
  const baseRightIdx = flip?.dir === 1 ? index + 1 : index;

  const leafStyle = (origin: "left" | "right", deg: number) => ({
    transformOrigin: `${origin} center`,
    transformStyle: "preserve-3d" as const,
    transition: `transform ${FLIP_MS}ms cubic-bezier(.45,.05,.25,1)`,
    transform: `rotateY(${flip?.go ? deg : 0}deg)`
  });
  const face = { backfaceVisibility: "hidden" as const };

  return (
    <div className="space-y-4">
      {/* Desktop: livro aberto com folha 3D */}
      <div
        className="relative mx-auto hidden aspect-[16/10] w-full max-w-5xl rounded-2xl bg-[#2a1d12] p-3 shadow-[0_25px_60px_rgba(0,0,0,0.65)] ring-1 ring-[#6b4a2b] md:block"
        style={{ perspective: "2400px" }}
      >
        <div className="relative grid h-full grid-cols-2 overflow-hidden rounded-lg">
          <div className="h-full shadow-[inset_-18px_0_24px_-14px_rgba(60,35,10,0.55)]">
            <LeftPage s={baseLeft} index={baseLeftIdx} total={total} />
          </div>
          <div className="h-full shadow-[inset_18px_0_24px_-14px_rgba(60,35,10,0.55)]">
            <RightPage s={baseRight} index={baseRightIdx} />
          </div>

          {flip?.dir === 1 && target && (
            <div className="absolute inset-y-0 left-1/2 w-1/2" style={leafStyle("left", -180)}>
              <div className="absolute inset-0" style={face}>
                <RightPage s={cur} index={index} />
              </div>
              <div className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)" }}>
                <LeftPage s={target} index={index + 1} total={total} />
              </div>
            </div>
          )}
          {flip?.dir === -1 && target && (
            <div className="absolute inset-y-0 left-0 w-1/2" style={leafStyle("right", 180)}>
              <div className="absolute inset-0" style={face}>
                <LeftPage s={cur} index={index} total={total} />
              </div>
              <div className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)" }}>
                <RightPage s={target} index={index - 1} />
              </div>
            </div>
          )}
          {/* Lombada */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/35 to-transparent" />
        </div>
      </div>

      {/* Mobile: páginas empilhadas, sem 3D */}
      <div className="mx-auto max-w-md space-y-0 overflow-hidden rounded-xl ring-1 ring-[#6b4a2b] md:hidden">
        <LeftPage s={cur} index={index} total={total} />
        <div className="aspect-[4/3]">
          <RightPage s={cur} index={index} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => turn(-1)}
          disabled={index === 0 || !!flip}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05] disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number.parseInt(pageText, 10);
            if (!Number.isFinite(n) || flip) return;
            setIndex(Math.min(total - 1, Math.max(0, Math.floor((n - 1) / 2))));
            setPageText("");
          }}
        >
          <span>
            Páginas {index * 2 + 1}–{index * 2 + 2} de {total * 2}
          </span>
          <input
            type="number"
            min={1}
            max={total * 2}
            value={pageText}
            onChange={(e) => setPageText(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Ir para…"
            aria-label="Número da página"
            className="w-24 rounded-lg border border-border bg-slate-950 px-2 py-2 text-center text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
          />
          <button type="submit" className="rounded-lg border border-border px-3 py-2 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05]">
            Ir
          </button>
        </form>
        <button
          type="button"
          onClick={() => turn(1)}
          disabled={index === total - 1 || !!flip}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05] disabled:opacity-30"
        >
          Próximo <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
