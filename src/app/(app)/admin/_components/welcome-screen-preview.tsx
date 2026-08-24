"use client";

import { useState } from "react";
import { WelcomeScreen } from "@/components/tutorial/welcome-screen";

export function WelcomeScreenPreview() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
      >
        👋 Ver tela de boas-vindas (primeiro login)
      </button>
      {open && <WelcomeScreen forcePreview onClosePreview={() => setOpen(false)} />}
    </>
  );
}
