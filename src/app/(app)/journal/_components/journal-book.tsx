"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";

/** Uma folha aberta (duas páginas) = um Pokémon, 1:1 com as figurinhas do álbum. */
export type BookPage = {
  id: string;
  generation: number;
  region: string;
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

/** Desenho a nanquim em CSS puro: contornos escuros + sépia, multiplicado sobre o pergaminho. */
function SketchImage({ src, alt }: { src: string; alt: string }) {
  const layer = "object-contain p-5";
  return (
    <div
      className="absolute inset-0 bg-white"
      style={{ isolation: "isolate", mixBlendMode: "multiply", filter: "sepia(.85) contrast(1.8) brightness(1.02)" }}
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

function LeftPage({ p }: { p: BookPage }) {
  return (
    <div className={`relative flex h-full flex-col overflow-hidden p-6 md:p-8 ${PAPER} ${INK}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-60">{p.chapterTitle}</p>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-widest opacity-60">
        N.º {String(p.number).padStart(3, "0")}
        {!p.locked && p.pokemonName ? ` · ${p.pokemonName}` : ""}
      </p>
      {p.locked ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8c2b24] text-[#f3d9c4] shadow-[0_3px_8px_rgba(0,0,0,0.45)] ring-4 ring-[#8c2b24]/30">
            <Lock size={26} />
          </div>
          <h3 className="mt-5 font-serif text-xl font-bold">Página selada</h3>
          <p className="mt-2 text-xs opacity-70">Para romper o selo (qualquer um):</p>
          <ul className="mt-2 space-y-1 text-sm">
            {p.hints.map((h, i) => (
              <li key={i}>• {h}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-2 flex-1 overflow-y-auto pr-1 [scrollbar-color:#a8843f_transparent] [scrollbar-width:thin]">
          <h3 className="font-serif text-xl font-bold leading-tight md:text-2xl">{p.title}</h3>
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-[#8a6a35] to-transparent" />
          {p.story.map((t, i) => (
            <p
              key={i}
              className={`mb-3 font-serif text-[13px] leading-relaxed md:text-sm ${
                i === 0 ? "first-letter:float-left first-letter:mr-1 first-letter:font-bold first-letter:leading-[0.8] first-letter:text-4xl first-letter:text-[#7a3b1c]" : ""
              }`}
            >
              {t}
            </p>
          ))}
          {p.facts.length > 0 && (
            <div className="mt-4 border-t border-[#8a6a35]/40 pt-3">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#7a3b1c]">
                <Sparkles size={11} /> Você sabia?
              </p>
              <ul className="space-y-1 font-serif text-xs italic">
                {p.facts.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-center font-serif text-[11px] opacity-50">— {p.number} —</p>
    </div>
  );
}

function RightPage({ p }: { p: BookPage }) {
  const src = !p.locked && p.art ? p.art : p.imageUrl;
  return (
    <div className={`relative flex h-full flex-col overflow-hidden p-6 md:p-8 ${PAPER} ${INK}`}>
      <div
        className="relative flex-1 overflow-hidden rounded-sm border-[3px] border-double bg-[#d9c28d]/60 shadow-inner"
        style={{ borderColor: `${p.accent}aa` }}
      >
        {src && p.locked && <Image src={src} alt="Página selada" fill unoptimized sizes="420px" className="object-contain p-6 brightness-0 opacity-30" />}
        {src && !p.locked && p.art && <Image src={src} alt={p.title ?? ""} fill unoptimized sizes="420px" className="object-cover" />}
        {src && !p.locked && !p.art && <SketchImage src={src} alt={p.title ?? ""} />}
      </div>
    </div>
  );
}

export function JournalBook({ pages }: { pages: BookPage[] }) {
  const [index, setIndex] = useState(0); // folha aberta = Pokémon index+1
  const [pageText, setPageText] = useState("");
  const [flip, setFlip] = useState<{ dir: 1 | -1; go: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = pages.length;

  // Marcadores: primeira folha de cada geração.
  const bookmarks = useMemo(() => {
    const seen = new Map<number, { gen: number; region: string; accent: string; number: number }>();
    pages.forEach((p, i) => {
      if (!seen.has(p.generation)) seen.set(p.generation, { gen: p.generation, region: p.region, accent: p.accent, number: i + 1 });
    });
    return [...seen.values()];
  }, [pages]);
  const currentGen = pages[index]?.generation;

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

  const jumpTo = (n: number) => {
    if (flip || !Number.isFinite(n)) return;
    setIndex(Math.min(total - 1, Math.max(0, n - 1)));
  };

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

  const cur = pages[index];
  const target = flip ? pages[index + flip.dir] : null;
  // Páginas estáticas por baixo da folha que gira.
  const baseLeft = flip?.dir === -1 && target ? target : cur;
  const baseRight = flip?.dir === 1 && target ? target : cur;

  const leafStyle = (origin: "left" | "right", deg: number) => ({
    transformOrigin: `${origin} center`,
    transformStyle: "preserve-3d" as const,
    transition: `transform ${FLIP_MS}ms cubic-bezier(.45,.05,.25,1)`,
    transform: `rotateY(${flip?.go ? deg : 0}deg)`
  });
  const face = { backfaceVisibility: "hidden" as const };

  return (
    <div className="space-y-4">
      {/* Marcadores por geração */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-end gap-1 px-4">
        {bookmarks.map((b) => {
          const active = b.gen === currentGen;
          return (
            <button
              key={b.gen}
              type="button"
              onClick={() => jumpTo(b.number)}
              title={`${b.region} — a partir do nº ${b.number}`}
              className={`rounded-t-md px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#20140a] shadow-md transition-all hover:-translate-y-1 ${
                active ? "-translate-y-1 py-2" : "py-1 opacity-80"
              }`}
              style={{ background: `linear-gradient(#fff3 0%, transparent 60%), ${b.accent}` }}
            >
              G{b.gen} · {b.region}
            </button>
          );
        })}
      </div>

      {/* Desktop: livro aberto com capa de couro e folha 3D */}
      <div
        className="relative mx-auto -mt-4 hidden aspect-[16/10] w-full max-w-5xl rounded-2xl bg-[linear-gradient(135deg,#4a3120,#2a1a0e_55%,#3a2616)] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.65),inset_0_0_0_2px_#6b4a2b,inset_0_0_0_5px_#1c1208,inset_0_0_0_6px_#a8843f] md:block"
        style={{ perspective: "2400px" }}
      >
        {/* Cantoneiras douradas */}
        {["left-1.5 top-1.5 border-l-4 border-t-4 rounded-tl-xl", "right-1.5 top-1.5 border-r-4 border-t-4 rounded-tr-xl", "left-1.5 bottom-1.5 border-b-4 border-l-4 rounded-bl-xl", "right-1.5 bottom-1.5 border-b-4 border-r-4 rounded-br-xl"].map((c) => (
          <span key={c} className={`pointer-events-none absolute z-20 h-9 w-9 border-[#c9a24a] ${c}`} />
        ))}

        <div className="relative grid h-full grid-cols-2 overflow-hidden rounded-md shadow-[-2px_0_0_#d3bd8a,-4px_0_0_#b79b60,-6px_0_0_#d3bd8a,2px_0_0_#d3bd8a,4px_0_0_#b79b60,6px_0_0_#d3bd8a,0_3px_0_#b79b60,0_6px_0_#d3bd8a,0_9px_0_#a88c52]">
          <div className="h-full shadow-[inset_-18px_0_24px_-14px_rgba(60,35,10,0.55)]">
            <LeftPage p={baseLeft} />
          </div>
          <div className="h-full shadow-[inset_18px_0_24px_-14px_rgba(60,35,10,0.55)]">
            <RightPage p={baseRight} />
          </div>

          {flip?.dir === 1 && target && (
            <div className="absolute inset-y-0 left-1/2 w-1/2" style={leafStyle("left", -180)}>
              <div className="absolute inset-0" style={face}>
                <RightPage p={cur} />
              </div>
              <div className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)" }}>
                <LeftPage p={target} />
              </div>
            </div>
          )}
          {flip?.dir === -1 && target && (
            <div className="absolute inset-y-0 left-0 w-1/2" style={leafStyle("right", 180)}>
              <div className="absolute inset-0" style={face}>
                <LeftPage p={cur} />
              </div>
              <div className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)" }}>
                <RightPage p={target} />
              </div>
            </div>
          )}
          {/* Lombada */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/35 to-transparent" />
        </div>
      </div>

      {/* Mobile: páginas empilhadas, sem 3D */}
      <div className="mx-auto max-w-md space-y-2 overflow-hidden rounded-xl ring-1 ring-[#6b4a2b] md:hidden">
        <LeftPage p={cur} />
        <div className="aspect-[4/3]">
          <RightPage p={cur} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
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
            jumpTo(Number.parseInt(pageText, 10));
            setPageText("");
          }}
        >
          <span>
            Página {index + 1} de {total}
          </span>
          <input
            type="number"
            min={1}
            max={total}
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
