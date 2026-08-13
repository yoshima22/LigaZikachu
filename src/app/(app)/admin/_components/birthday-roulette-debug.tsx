"use client";

import { useState } from "react";
import { BirthdayRouletteModal } from "@/app/(app)/_components/birthday-roulette-modal";

export function BirthdayRouletteDebug() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-200 hover:bg-pink-500/20"
      >
        🎂 Testar roleta de aniversário (simulação)
      </button>
      {open && <BirthdayRouletteModal mode="debug" onClose={() => setOpen(false)} />}
    </>
  );
}
