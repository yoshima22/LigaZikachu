"use client";

import { useState } from "react";
import { BirthdayRouletteModal } from "@/app/(app)/_components/birthday-roulette-modal";
import { BIRTHDAY_KITS } from "@/lib/birthday-roulette";

export function BirthdayRouletteDebug() {
  const [open, setOpen] = useState(false);
  const [kitId, setKitId] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-500/20 bg-pink-500/5 p-3">
      <select
        value={kitId}
        onChange={(event) => setKitId(event.target.value)}
        className="min-w-56 rounded-lg border border-pink-500/25 bg-slate-950 px-3 py-2 text-sm text-slate-200"
      >
        <option value="">Prêmio aleatório</option>
        {BIRTHDAY_KITS.map((kit) => (
          <option key={kit.id} value={kit.id}>{kit.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-200 hover:bg-pink-500/20"
      >
        🎂 Abrir debug da roleta
      </button>
      <span className="text-xs text-slate-500">Simulação visual: não entrega itens.</span>
      {open && (
        <BirthdayRouletteModal
          mode="debug"
          debugKitId={kitId || null}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
