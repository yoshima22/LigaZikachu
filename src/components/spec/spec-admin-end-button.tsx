"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminForceEndSpecStreamAction } from "@/app/(app)/spec/admin-actions";

// Botão de admin para encerrar a live de qualquer jogador direto da listagem.
export function SpecAdminEndButton({ streamId }: { streamId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const end = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm("Encerrar esta transmissão? O jogador será desconectado da live.")) return;
    start(async () => {
      const res = await adminForceEndSpecStreamAction(streamId);
      if (res && "error" in res && res.error) { toast.error(res.error); return; }
      toast.success("Transmissão encerrada.");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={end}
      disabled={pending}
      title="Encerrar esta live (admin)"
      className="absolute right-2 top-2 z-10 rounded-md border border-red-500/50 bg-red-950/70 px-2 py-1 text-[10px] font-black text-red-200 backdrop-blur hover:bg-red-900/80 disabled:opacity-50"
    >
      {pending ? "…" : "✕ Encerrar"}
    </button>
  );
}
