"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { toast } from "sonner";
import { BIRTHDAY_KITS, getBirthdayKit } from "@/lib/birthday-roulette";
import {
  spinBirthdayRouletteAction,
  chooseBirthdayMegaStoneAction,
  adminSimulateBirthdayRouletteAction,
  acknowledgeBirthdayRouletteReplayAction,
  getBirthdayMegaOptionsAction,
} from "./birthday-actions";

type MegaOption = { type: string; stoneName: string; pokemonName: string };
type Phase = "idle" | "spinning" | "revealed" | "choosingMega";

const SEG = 360 / BIRTHDAY_KITS.length;

export function BirthdayRouletteModal({
  mode = "real",
  pendingKitId = null,
  replayKitId = null,
  debugKitId = null,
  onClose,
}: {
  mode?: "real" | "debug";
  pendingKitId?: string | null;
  replayKitId?: string | null;
  debugKitId?: string | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [rotation, setRotation] = useState(0);
  const [wonKitId, setWonKitId] = useState<string | null>(null);
  const [megaOptions, setMegaOptions] = useState<MegaOption[]>([]);
  const [megaSearch, setMegaSearch] = useState("");
  const [mustAcknowledge, setMustAcknowledge] = useState(Boolean(replayKitId));
  const [pending, startTransition] = useTransition();
  const animationKitRef = useRef<string | null>(null);

  const wonKit = wonKitId ? getBirthdayKit(wonKitId) : null;

  // Fundo cônico com as cores dos kits.
  const conic = useMemo(() => {
    const stops = BIRTHDAY_KITS.map((kit, i) => `${kit.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(", ");
    return `conic-gradient(from -${SEG / 2}deg, ${stops})`;
  }, []);

  // Reproduz um resultado ja concedido ate o fim. Isso evita que uma
  // revalidacao de pagina faca a janela desaparecer no meio do giro.
  useEffect(() => {
    if (replayKitId) {
      setMustAcknowledge(true);
      const timer = window.setTimeout(() => animateResult(replayKitId), 250);
      return () => window.clearTimeout(timer);
    }
    if (pendingKitId) {
      setWonKitId(pendingKitId);
      openMegaChoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKitId, replayKitId]);

  const landOn = (kitId: string) => {
    const index = BIRTHDAY_KITS.findIndex((k) => k.id === kitId);
    if (index < 0) return;
    setRotation((previous) => {
      const normalized = ((previous % 360) + 360) % 360;
      const desired = ((-index * SEG) % 360 + 360) % 360;
      const delta = (desired - normalized + 360) % 360;
      return previous + (6 * 360) + delta;
    });
  };

  const animateResult = (kitId: string) => {
    if (animationKitRef.current === kitId) return;
    animationKitRef.current = kitId;
    setWonKitId(null);
    setPhase("spinning");
    landOn(kitId);
    window.setTimeout(() => {
      setWonKitId(kitId);
      setPhase("revealed");
    }, 4300);
  };

  const spin = () => {
    if (phase === "spinning") return;
    setPhase("spinning");
    setWonKitId(null);
    startTransition(async () => {
      const res = mode === "debug"
        ? await adminSimulateBirthdayRouletteAction(debugKitId ?? undefined)
        : await spinBirthdayRouletteAction();
      if (!res.ok || !res.kitId) {
        toast.error(("error" in res && res.error) ? res.error : "Não foi possível girar.");
        setPhase("idle");
        return;
      }
      const kitId = res.kitId;
      if (mode === "real") setMustAcknowledge(true);
      animateResult(kitId);
    });
  };

  const closeSafely = () => {
    if (phase === "spinning") return;
    if (mode === "real" && mustAcknowledge && phase === "revealed") {
      startTransition(async () => {
        await acknowledgeBirthdayRouletteReplayAction();
        onClose();
      });
      return;
    }
    onClose();
  };

  function openMegaChoice() {
    setPhase("choosingMega");
    if (megaOptions.length === 0) {
      getBirthdayMegaOptionsAction().then(setMegaOptions).catch(() => setMegaOptions([]));
    }
  }

  const chooseMega = (type: string) => {
    if (mode === "debug") {
      // No debug nada é concedido.
      setPhase("revealed");
      return;
    }
    startTransition(async () => {
      const res = await chooseBirthdayMegaStoneAction(type);
      if (!res.ok) { toast.error(res.error ?? "Não foi possível escolher."); return; }
      toast.success("Pedra de mega escolhida! 🔮");
      setPhase("revealed");
    });
  };

  const filteredMega = megaOptions.filter((m) =>
    `${m.stoneName} ${m.pokemonName}`.toLowerCase().includes(megaSearch.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-5">
      <div className="relative w-full max-w-[34rem] overflow-hidden rounded-[28px] border-2 border-[#FFCB05]/55 bg-gradient-to-b from-[#201747] via-[#24183f] to-[#100b20] px-4 pb-5 pt-6 shadow-[0_0_70px_rgba(255,203,5,0.24)] sm:px-7 sm:pb-7">
        {/* brilho de fundo animado */}
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 0%, rgba(236,72,153,0.35), transparent 60%)" }} />

        {phase !== "spinning" && (
          <button
            onClick={closeSafely}
            disabled={pending}
            aria-label="Fechar roleta"
            className="absolute right-3 top-3 z-30 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/35 text-sm text-slate-300 hover:bg-black/55 hover:text-white disabled:opacity-50"
          >
            ✕
          </button>
        )}

        <div className="relative text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#FFCB05]/80">
            {mode === "debug" ? "Debug — Roleta de Aniversário" : "🎉 Feliz Aniversário! 🎂"}
          </p>
          <h2 className="mt-1 font-pixel text-base text-[#FFCB05] drop-shadow-[0_0_12px_rgba(255,203,5,0.5)]">
            Roleta de Presentes
          </h2>
          {mode === "debug" && <p className="mt-1 text-[10px] text-amber-300/70">Simulação: nada é entregue.</p>}
        </div>

        {phase !== "choosingMega" && (
          <div className="relative mx-auto mt-5 aspect-square w-[min(76vw,18rem)]">
            {/* ponteiro centralizado sobre a fatia vencedora */}
            <div className="absolute left-1/2 top-[-3px] z-20 h-0 w-0 -translate-x-1/2 border-l-[13px] border-r-[13px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#FFCB05] drop-shadow-[0_3px_4px_rgba(0,0,0,0.7)]" />
            {/* roda */}
            <div
              className="absolute inset-2 overflow-hidden rounded-full border-4 border-[#FFCB05]/70 shadow-inner will-change-transform"
              style={{
                background: conic,
                transform: `rotate(${rotation}deg)`,
                transition: phase === "spinning" ? "transform 4.2s cubic-bezier(0.15, 0.85, 0.15, 1)" : "none",
                boxShadow: "0 0 40px rgba(236,72,153,0.35), inset 0 0 30px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-full opacity-40"
                style={{ background: `repeating-conic-gradient(from -${SEG / 2}deg, rgba(255,255,255,.55) 0 1deg, transparent 1deg ${SEG}deg)` }}
              />
              {BIRTHDAY_KITS.map((kit, index) => {
                const radians = (index * SEG * Math.PI) / 180;
                const left = 50 + (34 * Math.sin(radians));
                const top = 50 - (34 * Math.cos(radians));
                return (
                  <span
                    key={kit.id}
                    className="absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/10 text-[1.45rem] drop-shadow-[0_2px_3px_rgba(0,0,0,.65)]"
                    style={{ left: `${left}%`, top: `${top}%` }}
                  >
                    {kit.emoji}
                  </span>
                );
              })}
            </div>
            {/* hub central */}
            <div className="absolute left-1/2 top-1/2 z-10 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[#FFCB05] bg-[#1a1330] text-xl shadow-[0_0_18px_rgba(255,203,5,.45)]">🎁</div>
          </div>
        )}

        {/* Ações / revelação */}
        <div className="relative mt-6 text-center">
          {phase === "idle" && (
            <button
              onClick={spin}
              disabled={pending}
              className="rounded-2xl bg-gradient-to-r from-[#ec4899] via-[#f59e0b] to-[#FFCB05] px-8 py-3 text-sm font-black text-[#1a1330] shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
            >
              🎡 Girar a roleta!
            </button>
          )}
          {phase === "spinning" && <p className="animate-pulse text-sm font-bold text-[#FFCB05]">Girando... boa sorte! ✨</p>}

          {phase === "revealed" && wonKit && (
            <div className="animate-[fadeIn_0.4s_ease] rounded-2xl border border-[#FFCB05]/40 bg-[#FFCB05]/5 p-4">
              <p className="text-2xl">{wonKit.emoji} 🎉</p>
              <p className="mt-1 text-sm font-black text-[#FFCB05]">{wonKit.label}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-200">
                {wonKit.items.map((line) => <li key={line}>• {line}</li>)}
              </ul>
              <p className="mt-3 text-[11px] text-slate-400">
                {mode === "debug" ? "Simulação concluída." : "Presente entregue! Aproveite. 🥳"}
              </p>
              {mode === "real" && wonKit.isMegaChoice && pendingKitId ? (
                <button
                  onClick={openMegaChoice}
                  className="mt-3 rounded-xl bg-cyan-400 px-6 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300"
                >
                  Escolher minha pedra
                </button>
              ) : (
                <button
                  onClick={closeSafely}
                  disabled={pending}
                  className="mt-3 rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-6 py-2 text-sm font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50"
                >
                  Concluir
                </button>
              )}
            </div>
          )}

          {phase === "choosingMega" && wonKit && (
            <div className="text-left">
              <p className="text-center text-sm font-black text-[#06b6d4]">🔮 Escolha sua Pedra de Mega Evolução!</p>
              <input
                value={megaSearch}
                onChange={(e) => setMegaSearch(e.target.value)}
                placeholder="Buscar (nome da pedra ou Pokémon)…"
                className="mt-2 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-[#06b6d4]"
              />
              <div className="mt-2 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {filteredMega.map((m) => (
                  <button
                    key={m.type}
                    disabled={pending}
                    onClick={() => chooseMega(m.type)}
                    className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/15 disabled:opacity-50"
                  >
                    <span className="font-bold text-cyan-200">{m.stoneName}</span>
                    <span className="block text-[9px] text-slate-500">{m.pokemonName}</span>
                  </button>
                ))}
                {filteredMega.length === 0 && <p className="col-span-full py-4 text-center text-xs text-slate-500">Nenhuma pedra encontrada.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
