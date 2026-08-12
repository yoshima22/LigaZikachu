"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronUp, ChevronDown } from "lucide-react";
import { moveFavoriteAction } from "../actions";

export function FavoriteReorderButtons({ mascotId }: { mascotId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const move = (direction: "up" | "down") => {
    startTransition(async () => {
      const res = await moveFavoriteAction(mascotId, direction);
      if (!res.ok) toast.error(res.error ?? "Não foi possível reordenar.");
      else router.refresh();
    });
  };

  return (
    <span className="inline-flex items-center gap-0.5" title="Reordenar na Equipe Favorita">
      <button
        type="button"
        disabled={pending}
        onClick={() => move("up")}
        aria-label="Mover favorito para cima"
        className="rounded border border-border bg-slate-900/70 p-0.5 text-slate-400 hover:text-[#FFCB05] disabled:opacity-40"
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => move("down")}
        aria-label="Mover favorito para baixo"
        className="rounded border border-border bg-slate-900/70 p-0.5 text-slate-400 hover:text-[#FFCB05] disabled:opacity-40"
      >
        <ChevronDown size={12} />
      </button>
    </span>
  );
}
