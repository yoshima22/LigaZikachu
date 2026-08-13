"use client";

import { useState } from "react";
import { BirthdayRouletteModal } from "./birthday-roulette-modal";

// Abre a roleta de aniversário automaticamente ao carregar (quando elegível ou
// com uma escolha de pedra de mega pendente).
export function BirthdayRouletteLauncher({
  pendingKitId,
  replayKitId,
}: {
  pendingKitId: string | null;
  replayKitId: string | null;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <BirthdayRouletteModal
      mode="real"
      pendingKitId={pendingKitId}
      replayKitId={replayKitId}
      onClose={() => setOpen(false)}
    />
  );
}
