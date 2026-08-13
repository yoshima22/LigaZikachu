"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { BIRTHDAY_KITS, getBirthdayKit } from "@/lib/birthday-roulette";
import {
  spinBirthdayRouletteAction,
  chooseBirthdayMegaStoneAction,
  adminSimulateBirthdayRouletteAction,
  getBirthdayMegaOptionsAction,
} from "./birthday-actions";

type MegaOption = { type: string; stoneName: string; pokemonName: string };
type Phase = "idle" | "spinning" | "revealed" | "choosingMega";

const SEG = 360 / BIRTHDAY_KITS.length;

export function BirthdayRouletteModal({
  mode = "real",
  pendingKitId = null,
  onClose,
}: {
  mode?: "real" | "debug";
  pendingKitId?: string | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [rotation, setRotation] = useState(0);
  const [wonKitId, setWonKitId] = useState<string | null>(null);
  const [megaOptions, setMegaOptions] = useState<MegaOption[]>([]);
  const [megaSearch, setMegaSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const wonKit = wonKitId ? getBirthdayKit(wonKitId) : null;

  // Fundo cônico com as cores dos kits.
  const conic = useMemo(() => {
    const stops = BIRTHDAY_KITS.map((kit, i) => `${kit.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(", ");
    return `conic-gradient(from -${SEG / 2}deg, ${stops})`;
  }, []);

  // Retoma escolha de pedra de mega pendente.
  useEffect(() => {
    if (pendingKitId) {
      setWonKitId(pendingKitId);
      openMegaChoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKitId]);

  const landOn = (kitId: string) => {
    const index = BIRTHDAY_KITS.findIndex((k) => k.id === kitId);
    const turns = 6; // voltas completas para efeito
    // Alvo: o centro da fatia `index` alinhado ao ponteiro do topo (0deg).
    const target = turns * 360 - (index * SEG);
    setRotation((prev) => prev + (target - (prev % 360)) + 360);
  };

  const spin = () => {
    if (phase === "spinning") return;
    setPhase("spinning");
    setWonKitId(null);
    startTransition(async () => {
      const res = mode === "debug"
        ? await adminSimulateBirthdayRouletteAction()
        : await spinBirthdayRouletteAction();
      if (!res.ok || !res.kitId) {
        toast.error(("error" in res && res.error) ? res.error : "Não foi possível girar.");
        setPhase("idle");
        return;
      }
      const kitId = res.kitId;
      landOn(kitId);
      // Espera a animação (ver duração no style) antes de revelar.
      window.setTimeout(() => {
        setWonKitId(kitId);
        const needsMega = mode === "real" && "needsMegaChoice" in res && res.needsMegaChoice;
        if (needsMega) openMegaChoice();
        else setPhase("revealed");
      }, 4300);
    });
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-[#FFCB05]/50 bg-gradient-to-b from-[#1a1330] via-[#241a3d] to-[#120c22] p-6 shadow-[0_0_60px_rgba(255,203,5,0.25)]">
        {/* brilho de fundo animado */}
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 0%, rgba(236,72,153,0.35), transparent 60%)" }} />

        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/40 px-2 py-0.5 text-xs text-slate-300 hover:text-white">✕</button>

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
          <div className="relative mx-auto mt-5 h-64 w-64">
            {/* ponteiro */}
            <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2 text-2xl drop-shadow-lg">▼</div>
            {/* roda */}
            <div
              className="absolute inset-0 rounded-full border-4 border-[#FFCB05]/60 shadow-inner"
              style={{
                background: conic,
                transform: `rotate(${rotation}deg)`,
                transition: phase === "spinning" ? "transform 4.2s cubic-bezier(0.15, 0.85, 0.15, 1)" : "none",
                boxShadow: "0 0 40px rgba(236,72,153,0.35), inset 0 0 30px rgba(0,0,0,0.4)",
              }}
            >
              {BIRTHDAY_KITS.map((kit, i) => (
                <div
                  key={kit.id}
                  className="absolute left-1/2 top-1/2 origin-left text-xl"
                  style={{ transform: `rotate(${i * SEG}deg) translateX(70px)` }}
                >
                  <span style={{ display: "inline-block", transform: `rotate(${-i * SEG - rotation}deg)` }}>{kit.emoji}</span>
                </div>
              ))}
            </div>
            {/* hub central */}
            <div className="absolute left-1/2 top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#FFCB05] bg-[#1a1330] text-center text-xl leading-[44px]">🎁</div>
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
              <button onClick={onClose} className="mt-3 rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-6 py-2 text-sm font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20">
                Fechar
              </button>
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
