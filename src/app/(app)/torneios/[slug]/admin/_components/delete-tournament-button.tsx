"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTournament } from "../../../actions";

interface DeleteTournamentButtonProps {
  tournamentId: string;
  tournamentName: string;
}

export function DeleteTournamentButton({
  tournamentId,
  tournamentName
}: DeleteTournamentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
      onClick={() => {
        const ok = confirm(
          `Deletar o torneio "${tournamentName}"? Isso remove semanas, partidas, inscricoes e decklists vinculadas.`
        );
        if (!ok) return;

        startTransition(async () => {
          const result = await deleteTournament({ tournamentId });
          if (result.error) {
            toast.error(result.error);
            return;
          }

          toast.success("Torneio deletado.");
          router.push("/torneios");
          router.refresh();
        });
      }}
    >
      <Trash2 size={14} className="mr-1.5" />
      {isPending ? "Deletando..." : "Deletar torneio"}
    </Button>
  );
}
