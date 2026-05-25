"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { approveRegistration, rejectRegistration } from "../../../actions";
import { Check, X } from "lucide-react";

interface RegistrationActionsProps {
  tournamentId: string;
  playerId: string;
}

export function RegistrationActions({ tournamentId, playerId }: RegistrationActionsProps) {
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done === "approved") {
    return <span className="text-xs text-[#7AC74C] font-semibold">Aprovado</span>;
  }
  if (done === "rejected") {
    return <span className="text-xs text-red-400 font-semibold">Rejeitado</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-[#7AC74C]/40 text-[#7AC74C] hover:bg-[#7AC74C]/10"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await approveRegistration(tournamentId, playerId);
            if (res.error) toast.error(res.error);
            else { setDone("approved"); toast.success("Inscrição aprovada!"); }
          })
        }
      >
        <Check size={13} className="mr-1" /> Aprovar
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-red-500/40 text-red-400 hover:bg-red-500/10"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await rejectRegistration(tournamentId, playerId);
            if (res.error) toast.error(res.error);
            else { setDone("rejected"); toast.success("Inscrição rejeitada."); }
          })
        }
      >
        <X size={13} className="mr-1" /> Rejeitar
      </Button>
    </div>
  );
}
