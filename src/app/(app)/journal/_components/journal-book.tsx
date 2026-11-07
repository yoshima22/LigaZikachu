"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookMarked, ChevronLeft, ChevronRight, Loader2, Lock, Sparkles } from "lucide-react";
import { loadJournalChunk } from "../actions";
import type { JournalMeta } from "@/journal-data/types";

/** Uma folha aberta (duas páginas) = um Pokémon, 1:1 com as figurinhas do álbum. */
export type BookPage = {
  id: string;
  /** Posição no livro (1 = primeira folha); coincide com o nº da Pokédex. */
  position: number;
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
const OPEN_MS = 1200;
const EASE = "cubic-bezier(.45,.05,.25,1)";
const PAPER = "bg-[#e9d7ab] bg-[radial-gradient(ellipse_at_center,#f1e2bb_0%,#e2cd9b_70%,#c9ae76_100%)]";
const INK = "text-[#3a2a14]";
const LEATHER = "bg-[linear-gradient(135deg,#4a3120,#2a1a0e_55%,#3a2616)]";

/** Desenho a nanquim em CSS puro: contornos escuros + sépia, multiplicado sobre o pergaminho. */
function SketchImage({ src, alt }: { src: string; alt: string }) {
  const layer = "object-contain p-5";
  const img = { fill: true as const, unoptimized: true as const, sizes: "420px", className: layer };
  return (
    <div
      className="absolute inset-0 bg-white"
      style={{ isolation: "isolate", mixBlendMode: "multiply", filter: "sepia(.8) contrast(1.5) brightness(1.03)" }}
    >
      {/* 1) tons em cinza, com contraste para cores claras (amarelo, branco) não sumirem */}
      <Image src={src} alt={alt} {...img} style={{ filter: "grayscale(1) contrast(1.9) brightness(.92)" }} />
      {/* 2) cópia invertida e borrada em color-dodge: só os traços internos ficam escuros */}
      <Image src={src} alt="" aria-hidden {...img} style={{ filter: "grayscale(1) contrast(1.9) brightness(.92) invert(1) blur(1.5px)", mixBlendMode: "color-dodge" }} />
      {/* 3) contorno firme da silhueta (garante que a borda nunca desapareça) */}
      <Image src={src} alt="" aria-hidden {...img} style={{ filter: "url(#journal-ink-outline)" }} />
    </div>
  );
}

/** Filtro SVG + animações usadas pelo livro. */
function BookDefs() {
  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <defs>
          <filter id="journal-ink-outline" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="grown" />
            <feComposite in="grown" in2="SourceAlpha" operator="out" result="edge" />
            <feFlood floodColor="#1a1008" floodOpacity="0.95" />
            <feComposite in2="edge" operator="in" />
          </filter>
        </defs>
      </svg>
      <style>{`
        @keyframes journalRise { from { opacity: 0; transform: translateY(56px) scale(.9) rotateX(10deg); } to { opacity: 1; transform: none; } }
        @keyframes journalGlow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        .journal-rise { animation: journalRise 1000ms cubic-bezier(.2,.8,.2,1) both; }
        .journal-glow { animation: journalGlow 2200ms ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .journal-rise, .journal-glow { animation: none; } }
      `}</style>
    </>
  );
}

/** Capa fechada: couro, moldura dourada e emblema. */
function Cover({ onOpen, className = "" }: { onOpen?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Abrir o livro"
      className={`group relative flex h-full w-full flex-col items-center justify-center overflow-hidden ${LEATHER} shadow-[inset_0_0_0_2px_#6b4a2b,inset_0_0_0_6px_#1c1208,inset_0_0_0_7px_#a8843f,inset_-14px_0_24px_-10px_rgba(0,0,0,0.6)] ${className}`}
    >
      {["left-3 top-3 border-l-4 border-t-4 rounded-tl-lg", "right-3 top-3 border-r-4 border-t-4 rounded-tr-lg", "left-3 bottom-3 border-b-4 border-l-4 rounded-bl-lg", "right-3 bottom-3 border-b-4 border-r-4 rounded-br-lg"].map((c) => (
        <span key={c} className={`absolute h-8 w-8 border-[#c9a24a] ${c}`} />
      ))}
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#c9a24a] bg-[#1c1208]/60 text-[#e5c06a] shadow-[0_0_24px_rgba(201,162,74,0.35)]">
        <BookMarked size={38} />
      </div>
      <p className="mt-5 font-pixel text-lg tracking-widest text-[#e5c06a]">JOURNAL</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-[#c9a24a]/80">Diário de campo da Liga</p>
      <p className="journal-glow mt-8 rounded-full border border-[#c9a24a]/50 px-4 py-1.5 text-[11px] uppercase tracking-widest text-[#e5c06a] transition group-hover:bg-[#c9a24a]/15">
        Clique para abrir
      </p>
    </button>
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

export function JournalBook({
  meta,
  revealAll = false,
  autoOpen = false
}: {
  meta: JournalMeta;
  revealAll?: boolean;
  autoOpen?: boolean;
}) {
  const [index, setIndex] = useState(0); // folha aberta = Pokémon index+1
  // Páginas já carregadas (posição → página). O resto vem sob demanda, antes de virar a página.
  const [loaded, setLoaded] = useState<Map<number, BookPage>>(() => new Map(meta.initial.map((p) => [p.position, p])));
  const loadedRef = useRef(loaded);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pageText, setPageText] = useState("");
  const [flip, setFlip] = useState<{ dir: 1 | -1; go: boolean } | null>(null);
  const [phase, setPhase] = useState<"closed" | "opening" | "open">("closed");
  const [coverGo, setCoverGo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const total = meta.total;
  const isOpen = phase === "open";
  const bookmarks = meta.bookmarks;
  const currentGen = loaded.get(index + 1)?.generation;

  // Garante as páginas de `center-2` a `center+5` (um bloco de 8). Só busca o que falta, de uma vez.
  const ensure = useCallback(
    async (center: number): Promise<boolean> => {
      const from = Math.max(1, center - 2);
      const to = Math.min(total, center + 5);
      const missing: number[] = [];
      for (let p = from; p <= to; p++) if (!loadedRef.current.has(p)) missing.push(p);
      if (missing.length === 0) return true;
      try {
        const rows = await loadJournalChunk(missing[0], missing[missing.length - 1], revealAll);
        if (!rows) return false;
        const next = new Map(loadedRef.current);
        for (const p of rows) next.set(p.position, p);
        loadedRef.current = next;
        setLoaded(next);
        return true;
      } catch {
        return false;
      }
    },
    [total, revealAll]
  );

  const openBook = () => {
    if (phase !== "closed") return;
    setPhase("opening");
    requestAnimationFrame(() => requestAnimationFrame(() => setCoverGo(true)));
    openTimer.current = setTimeout(() => setPhase("open"), OPEN_MS + 50);
  };

  const turn = useCallback(
    async (dir: 1 | -1) => {
      if (flip || busy || phase !== "open") return;
      const next = index + dir;
      if (next < 0 || next >= total) return;
      // Carrega a página de destino ANTES de rodar a animação de virar.
      if (!loadedRef.current.has(next + 1)) {
        setBusy(true);
        const ok = await ensure(next + 1);
        setBusy(false);
        setLoadError(!ok);
        if (!ok) return;
      }
      setFlip({ dir, go: false });
      requestAnimationFrame(() => requestAnimationFrame(() => setFlip({ dir, go: true })));
      timer.current = setTimeout(() => {
        setIndex(next);
        setFlip(null);
      }, FLIP_MS);
    },
    [flip, busy, index, total, phase, ensure]
  );

  const jumpTo = async (n: number) => {
    if (flip || busy || phase !== "open" || !Number.isFinite(n)) return;
    const target = Math.min(total, Math.max(1, n));
    if (!loadedRef.current.has(target)) {
      setBusy(true);
      const ok = await ensure(target);
      setBusy(false);
      setLoadError(!ok);
      if (!ok) return;
    }
    setIndex(target - 1);
  };

  // Pré-carrega as vizinhas em segundo plano para a próxima virada ser instantânea.
  useEffect(() => {
    if (phase === "open") void ensure(index + 1);
  }, [index, phase, ensure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn(1);
      if (e.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    []
  );

  // No celular as páginas ficam empilhadas: ao mudar de registro, volta ao topo do livro.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const el = mobileRef.current;
    if (!el || window.innerWidth >= 768) return;
    if (el.closest('[role="dialog"]')) {
      el.scrollIntoView({ block: "start", behavior: "smooth" }); // sobreposição do álbum: rola dentro dela
      return;
    }
    // Na página: desconta o cabeçalho fixo do site (alto no celular).
    const header = document.querySelector("header.site-header");
    const offset = (header?.getBoundingClientRect().height ?? 0) + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  }, [index]);

  // Aberto por outro lugar (botão do álbum): o livro aparece e se abre sozinho.
  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(openBook, 1100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  if (total === 0) return null;

  const cur = loaded.get(index + 1);
  if (!cur) return null; // nunca acontece: o destino é carregado antes de virar
  const target = flip ? loaded.get(index + 1 + flip.dir) ?? null : null;
  // Páginas estáticas por baixo da folha que gira.
  const baseLeft = flip?.dir === -1 && target ? target : cur;
  const baseRight = flip?.dir === 1 && target ? target : cur;

  const leafStyle = (origin: "left" | "right", deg: number) => ({
    transformOrigin: `${origin} center`,
    transformStyle: "preserve-3d" as const,
    transition: `transform ${FLIP_MS}ms ${EASE}`,
    transform: `rotateY(${flip?.go ? deg : 0}deg)`
  });
  const face = { backfaceVisibility: "hidden" as const };
  const hideUntilOpen = `transition-opacity duration-500 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`;

  return (
    <div className="space-y-4">
      <BookDefs />

      {/* Marcadores por geração */}
      <div className={`mx-auto flex max-w-5xl flex-wrap items-end gap-1 px-4 ${hideUntilOpen}`}>
        {bookmarks.map((b) => {
          const active = b.gen === currentGen;
          return (
            <button
              key={b.gen}
              type="button"
              onClick={() => void jumpTo(b.position)}
              title={`${b.region} — a partir do nº ${b.position}`}
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

      {/* Desktop: aparece fechado, a capa gira e o livro se abre */}
      <div className="journal-rise relative mx-auto -mt-4 hidden aspect-[16/10] w-full max-w-5xl md:block">
        <div
          className="absolute inset-0"
          style={{
            perspective: "2400px",
            transform: phase === "closed" ? "translateX(-25%)" : "translateX(0)",
            transition: `transform ${OPEN_MS}ms ${EASE}`
          }}
        >
          <div
            className={`absolute inset-0 rounded-2xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.65),inset_0_0_0_2px_#6b4a2b,inset_0_0_0_5px_#1c1208,inset_0_0_0_6px_#a8843f] ${LEATHER} ${phase === "closed" ? "pointer-events-none" : ""}`}
            style={{ opacity: phase === "closed" ? 0 : 1, transition: "opacity 700ms ease 350ms" }}
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

          {/* Capa: gira sobre a lombada e termina como o verso (página da esquerda) */}
          {phase !== "open" && (
            <div
              className="absolute inset-y-0 left-1/2 z-30 w-1/2"
              style={{
                transformOrigin: "left center",
                transformStyle: "preserve-3d",
                transition: `transform ${OPEN_MS}ms ${EASE}`,
                transform: `rotateY(${coverGo ? -180 : 0}deg)`
              }}
            >
              <div className="absolute inset-0" style={face}>
                <Cover onOpen={openBook} className="rounded-r-2xl" />
              </div>
              <div className={`absolute inset-0 rounded-l-2xl py-4 pl-4 ${LEATHER}`} style={{ ...face, transform: "rotateY(180deg)" }}>
                <LeftPage p={cur} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: capa que aparece e, ao abrir, as páginas empilhadas (sem 3D) */}
      <div ref={mobileRef} className="scroll-mt-20 md:hidden">
        {phase === "closed" ? (
          <div className="journal-rise mx-auto aspect-[3/4] max-w-xs">
            <Cover onOpen={openBook} className="rounded-2xl" />
          </div>
        ) : (
          <div className="journal-rise mx-auto max-w-md space-y-2 overflow-hidden rounded-xl ring-1 ring-[#6b4a2b]">
            <LeftPage p={cur} />
            <div className="aspect-[4/3]">
              <RightPage p={cur} />
            </div>
          </div>
        )}
      </div>

      <div
        className={`sticky bottom-3 z-40 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-slate-950/90 p-2 text-xs text-slate-400 backdrop-blur md:static md:gap-3 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none ${hideUntilOpen}`}
      >
        <button
          type="button"
          onClick={() => turn(-1)}
          disabled={index === 0 || !!flip || busy}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2.5 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05] disabled:opacity-30 md:flex-none md:py-2"
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <form
          className="order-3 flex w-full items-center justify-center gap-2 md:order-none md:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            jumpTo(Number.parseInt(pageText, 10));
            setPageText("");
          }}
        >
          <span>
            {busy ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Folheando…
              </span>
            ) : loadError ? (
              <span className="text-red-300">Não foi possível carregar. Tente de novo.</span>
            ) : (
              <>Página {index + 1} de {total}</>
            )}
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
          disabled={index === total - 1 || !!flip || busy}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2.5 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05] disabled:opacity-30 md:flex-none md:py-2"
        >
          Próximo <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
