"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { selfRegister, withdrawRegistration } from "../../actions";
import { UserPlus, LogOut, Clock, CheckCircle, XCircle } from "lucide-react";

type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | null;
type TournamentStatus = "DRAFT" | "REGISTRATION_OPEN" | "IN_PROGRESS" | "FINISHED";

interface RegisterButtonProps {
  tournamentId: string;
  tournamentStatus: TournamentStatus;
  myRegistrationStatus: RegistrationStatus;
}

export function RegisterButton({
  tournamentId,
  tournamentStatus,
  myRegistrationStatus
}: RegisterButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<RegistrationStatus>(myRegistrationStatus);

  const canRegister =
    (tournamentStatus === "REGISTRATION_OPEN" || tournamentStatus === "IN_PROGRESS") &&
    (localStatus === null || localStatus === "WITHDRAWN" || localStatus === "REJECTED");

  const canWithdraw = localStatus === "PENDING" || localStatus === "APPROVED";

  function handleRegister() {
    startTransition(async () => {
      const result = await selfRegister(tournamentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setLocalStatus("PENDING");
        toast.success("Inscrição enviada! Aguarde aprovação do admin.");
      }
    });
  }

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawRegistration(tournamentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setLocalStatus("WITHDRAWN");
        toast.success("Inscrição cancelada.");
      }
    });
  }

  if (localStatus === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7AC74C]/40 bg-[#7AC74C]/10 px-3 py-1.5 text-xs font-semibold text-[#7AC74C]">
        <CheckCircle size={13} />
        Inscrito
      </span>
    );
  }

  if (localStatus === "PENDING") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F7D02C]/40 bg-[#F7D02C]/10 px-3 py-1.5 text-xs font-semibold text-[#F7D02C]">
          <Clock size={13} />
          Aguardando aprovação
        </span>
        <Button variant="ghost" size="sm" onClick={handleWithdraw} disabled={isPending}>
          <LogOut size={13} className="mr-1" />
          Cancelar
        </Button>
      </div>
    );
  }

  if (localStatus === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400">
        <XCircle size={13} />
        Inscrição rejeitada
      </span>
    );
  }

  if (!canRegister) return null;

  return (
    <Button onClick={handleRegister} disabled={isPending} size="sm" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
      <UserPlus size={14} className="mr-1.5" />
      {isPending ? "Inscrevendo..." : "Inscrever-se"}
    </Button>
  );
}
