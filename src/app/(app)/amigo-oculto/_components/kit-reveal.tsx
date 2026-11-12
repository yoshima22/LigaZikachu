"use client";

import { useEffect, useState } from "react";
import type { ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { PackageCard } from "./package-ui";

const CSS = `
@keyframes kr-shake{0%,100%{transform:rotate(0)}15%{transform:rotate(-9deg) translateX(-4px)}30%{transform:rotate(8deg) translateX(4px)}45%{transform:rotate(-7deg)}60%{transform:rotate(6deg)}75%{transform:rotate(-3deg)}}
@keyframes kr-lid{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(-120px) rotate(-28deg) translateX(-30px);opacity:0}}
@keyframes kr-light{0%{opacity:0;transform:scale(.2)}40%{opacity:1}100%{opacity:0;transform:scale(2.6)}}
@keyframes kr-rise{0%{opacity:0;transform:translateY(80px) scale(.4)}70%{opacity:1;transform:translateY(-10px) scale(1.05)}100%{opacity:1;transform:none}}
@keyframes kr-spark{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}
@keyframes kr-flash{0%{opacity:0;transform:translateY(8px)}30%,100%{opacity:1;transform:none}}
`;

// Sorteio do kit com cara de "abrir o presente": a caixa balança enquanto os 3 candidatos piscam,
// a tampa voa, uma luz estoura e o kit sorteado sobe.
export function KitDrawReveal({ candidates, winnerKey, onDone }: { candidates: ResolvedPackage[]; winnerKey: string; onDone?: () => void }) {
  const [phase, setPhase] = useState<"shake" | "open" | "reveal">("shake");
  const [i, setI] = useState(0);
  const winner = candidates.find((c) => c.key === winnerKey) ?? candidates[0];

  useEffect(() => {
    const flash = setInterval(() => setI((x) => x + 1), 140);
    const t1 = setTimeout(() => { clearInterval(flash); setPhase("open"); }, 2600);
    const t2 = setTimeout(() => { setPhase("reveal"); onDone?.(); }, 3500);
    return () => { clearInterval(flash); clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  const shown = phase === "shake" ? candidates[i % candidates.length] : winner;
  return (
    <div className="relative mx-auto flex min-h-[420px] w-full max-w-md flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1b1233] to-[#0b1d3a] p-5">
      <style>{CSS}</style>
      {phase !== "reveal" && (
        <div className="relative flex flex-col items-center">
          <div className="relative h-32 w-32" style={phase === "shake" ? { animation: "kr-shake .7s ease-in-out infinite" } : undefined}>
            <div className="absolute bottom-0 h-24 w-32 rounded-lg bg-gradient-to-br from-rose-600 to-rose-800 shadow-xl" />
            <div className="absolute bottom-0 left-1/2 h-24 w-5 -translate-x-1/2 bg-amber-300" />
            <div className="absolute bottom-[72px] h-9 w-36 -left-2 rounded-md bg-gradient-to-br from-rose-500 to-rose-700" style={phase === "open" ? { animation: "kr-lid .8s ease-in forwards" } : undefined}>
              <div className="absolute left-1/2 top-0 h-full w-5 -translate-x-1/2 bg-amber-300" />
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">🎀</span>
            </div>
            {phase === "open" && <span className="absolute left-1/2 top-4 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200" style={{ animation: "kr-light .9s ease-out forwards", filter: "blur(18px)" }} />}
          </div>
          <p key={i} className="mt-6 h-8 text-center text-lg font-bold text-amber-200" style={{ animation: "kr-flash .14s ease-out" }}>{shown.emoji} {shown.name}</p>
          <p className="text-xs text-slate-300">{phase === "shake" ? "🎲 Sorteando entre os kits escolhidos…" : "🎉 Abrindo!"}</p>
        </div>
      )}
      {phase === "reveal" && (
        <div className="relative w-full space-y-3" style={{ animation: "kr-rise .8s cubic-bezier(.2,.9,.3,1.2) both" }}>
          {Array.from({ length: 14 }, (_, k) => {
            const a = (k / 14) * Math.PI * 2;
            return <span key={k} className="pointer-events-none absolute left-1/2 top-1/3 text-lg" style={{ ["--dx" as string]: `${Math.cos(a) * 170}px`, ["--dy" as string]: `${Math.sin(a) * 140}px`, animation: "kr-spark 1.4s ease-out both" }}>{["✨", "⭐", "🎉"][k % 3]}</span>;
          })}
          <p className="text-center text-xs uppercase tracking-widest text-amber-200">🎁 O sorteio escolheu</p>
          <PackageCard pkg={winner} />
        </div>
      )}
    </div>
  );
}
