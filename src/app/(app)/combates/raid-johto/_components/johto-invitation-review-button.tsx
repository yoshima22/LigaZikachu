"use client";

import { useState } from "react";
import { MailOpen } from "lucide-react";
import { JohtoInvitationLetter } from "../../../_components/johto-invitation-letter";

export function JohtoInvitationReviewButton({
  displayName,
  voteSubmitted,
  candidates,
}: {
  displayName: string | null;
  voteSubmitted: boolean;
  candidates: { id: string; displayName: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#FFCB05]/45 bg-slate-950/45 px-3 py-2 text-xs font-black text-[#fff0b0] transition hover:border-[#FFCB05] hover:bg-[#FFCB05]/15"
      >
        <MailOpen size={15} /> Ler convite novamente
        {!voteSubmitted && <span className="rounded-full bg-[#FFCB05] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-950">Votação pendente</span>}
      </button>
      {open && (
        <JohtoInvitationLetter
          mode={voteSubmitted ? "review" : "player"}
          candidates={candidates}
          displayName={displayName}
          voteSubmitted={voteSubmitted}
          onClose={() => setOpen(false)}
          onFinish={() => setOpen(false)}
        />
      )}
    </>
  );
}
