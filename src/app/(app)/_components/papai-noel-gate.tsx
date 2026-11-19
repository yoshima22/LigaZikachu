"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { claimSantaGiftAction, getSantaStatusAction } from "./papai-noel-actions";

const KEY = "santa-next-at"; // cache local do "próximo presente": evita ir ao servidor a cada página
const REPEAT_MS = 45_000; // entre passagens enquanto o presente não for pego
const MAX_TIMER = 2_000_000_000;

function readNext(): number {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}
function writeNext(ms: number) {
  try { localStorage.setItem(KEY, String(ms)); } catch { /* sem storage: só consulta o servidor de novo */ }
}

function Sleigh() {
  return (
    <svg viewBox="0 0 320 130" width="100%" height="100%" aria-hidden>
      <path d="M118 84 L40 72" stroke="#8b5a2b" strokeWidth="2" fill="none" />
      {/* rena */}
      <g transform="translate(6 34)">
        <ellipse cx="34" cy="38" rx="22" ry="12" fill="#a0693a" />
        <rect x="18" y="44" width="4" height="16" rx="2" fill="#7a4d27" />
        <rect x="44" y="44" width="4" height="16" rx="2" fill="#7a4d27" />
        <circle cx="10" cy="26" r="9" fill="#a0693a" />
        <circle cx="5" cy="26" r="4.5" fill="#ef4444" />
        <path d="M8 18 L4 6 M4 6 L-2 8 M4 6 L7 1 M14 17 L16 5 M16 5 L22 6 M16 5 L15 -1" stroke="#d6b27c" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      {/* trenó */}
      <path d="M112 62 H262 Q282 62 286 44 Q276 52 262 50 H132 Q118 50 112 62 Z" fill="#dc2626" />
      <path d="M112 62 Q112 92 138 92 H258 Q278 92 280 62 Z" fill="#b91c1c" />
      <path d="M100 100 Q150 108 250 104 Q286 102 296 84" stroke="#fbbf24" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M140 92 V102 M246 92 V102" stroke="#fbbf24" strokeWidth="3" />
      {/* saco de presentes */}
      <g transform="translate(214 18)">
        <path d="M0 50 Q-6 20 22 10 Q50 20 44 50 Z" fill="#f59e0b" />
        <path d="M14 12 Q22 4 30 12" stroke="#92400e" strokeWidth="3" fill="none" />
        <rect x="14" y="26" width="16" height="14" fill="#22c55e" />
        <path d="M22 26 V40 M14 33 H30" stroke="#fde047" strokeWidth="2" />
      </g>
      {/* Papai Noel */}
      <g transform="translate(150 12)">
        <rect x="0" y="22" width="40" height="34" rx="14" fill="#ef4444" />
        <rect x="0" y="40" width="40" height="5" fill="#111827" />
        <circle cx="20" cy="18" r="13" fill="#fcd9b6" />
        <path d="M6 22 Q20 52 34 22 Q20 30 6 22 Z" fill="#fff" />
        <path d="M5 14 Q20 -10 35 14 Q20 6 5 14 Z" fill="#ef4444" />
        <circle cx="35" cy="6" r="4.5" fill="#fff" />
        <rect x="4" y="11" width="32" height="6" rx="3" fill="#fff" />
        <circle cx="16" cy="19" r="1.6" fill="#111827" />
        <circle cx="24" cy="19" r="1.6" fill="#111827" />
        <path d="M38 34 L52 26" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" />
        <circle cx="54" cy="25" r="4" fill="#fff" />
      </g>
    </svg>
  );
}

/** Papai Noel que cruza a tela quando há presente. O servidor decide tudo; aqui só animação e feedback. */
export function PapaiNoelGate() {
  const [flying, setFlying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [busy, setBusy] = useState(false);
  const available = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback((fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, Math.min(Math.max(ms, 1000), MAX_TIMER));
  }, []);

  const check = useCallback(async () => {
    const st = await getSantaStatusAction().catch(() => null);
    if (!st) return schedule(check, 10 * 60_000);
    if (st.available) {
      available.current = true;
      writeNext(0);
      setFlying(true);
    } else {
      available.current = false;
      if (st.nextAt) {
        const at = new Date(st.nextAt).getTime();
        writeNext(at);
        schedule(check, at - Date.now() + 1500);
      } else schedule(check, 30 * 60_000); // evento desligado/fora da janela: reconfere devagar
    }
  }, [schedule]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const next = readNext();
    if (next > Date.now()) schedule(check, next - Date.now() + 1500);
    else void check();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [check, schedule]);

  const afterPass = () => {
    setFlying(false);
    if (!available.current) return;
    const again = () => (document.visibilityState === "visible" ? setFlying(true) : schedule(again, 5000));
    schedule(again, REPEAT_MS);
  };

  const grab = async () => {
    if (busy) return;
    setBusy(true);
    const res = await claimSantaGiftAction().catch(() => null);
    setBusy(false);
    available.current = false;
    setFlying(false);
    const nextAt = res ? (res.ok ? res.nextAt : res.nextAt) : undefined;
    if (nextAt) {
      const at = new Date(nextAt).getTime();
      writeNext(at);
      schedule(check, at - Date.now() + 1500);
    }
    if (res?.ok) {
      toast.success(`🎅 Ho ho ho! Você ganhou ${res.emoji} ${res.label}!`, {
        duration: 8000,
        description: "O Papai Noel volta em algumas horas com mais um presente.",
      });
    } else {
      toast.error(res && !res.ok ? res.error : "Não foi possível pegar o presente.");
    }
  };

  if (!flying) return null;
  return (
    <>
      <style>{`
        @keyframes santa-x { from { transform: translateX(-340px); } to { transform: translateX(calc(100vw + 40px)); } }
        @keyframes santa-bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-26px) rotate(3deg); } }
        @keyframes santa-twinkle { 0%,100% { opacity: .15; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.1); } }
      `}</style>
      {reduced ? (
        <button
          type="button"
          onClick={grab}
          disabled={busy}
          aria-label="Pegar o presente do Papai Noel"
          className="fixed bottom-20 right-4 z-[60] rounded-full border border-red-300 bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg md:bottom-6"
        >
          🎅 Pegar presente
        </button>
      ) : (
        <div className="pointer-events-none fixed left-0 top-[14vh] z-[60] h-0 w-full overflow-visible">
          <div className="absolute left-0 top-0 w-[220px] sm:w-[300px]" style={{ animation: "santa-x 14s linear forwards" }} onAnimationEnd={afterPass}>
            <div className="relative" style={{ animation: "santa-bob 2.4s ease-in-out infinite" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="absolute text-yellow-200"
                  style={{ left: `${-4 - i * 7}%`, top: `${48 + (i % 3) * 14}%`, animation: `santa-twinkle ${0.9 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`, fontSize: 14 }}
                >
                  ✦
                </span>
              ))}
              <button
                type="button"
                onClick={grab}
                disabled={busy}
                aria-label="Pegar o presente do Papai Noel"
                className="pointer-events-auto relative block w-full cursor-pointer select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                style={{ aspectRatio: "320 / 130" }}
              >
                <Sleigh />
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-red-600 shadow">🎁 Clique!</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
