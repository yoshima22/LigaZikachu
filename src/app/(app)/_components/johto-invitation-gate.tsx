"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JohtoInvitationPlayerState } from "@/lib/johto-invitation";
import { JohtoInvitationLetter } from "./johto-invitation-letter";

export function JohtoInvitationGate({ initialState }: { initialState: JohtoInvitationPlayerState }) {
  const router = useRouter();
  const [visible, setVisible] = useState(initialState.available && !initialState.openedAt);
  if (!visible) return null;
  return (
    <JohtoInvitationLetter
      mode="player"
      candidates={initialState.candidates}
      displayName={initialState.displayName}
      onFinish={() => {
        setVisible(false);
        router.push("/combates/raid-johto");
      }}
    />
  );
}
