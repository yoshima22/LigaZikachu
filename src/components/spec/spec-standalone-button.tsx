"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startStandaloneSpecStreamAction } from "@/app/(app)/spec/actions";

// Botão de staff para abrir uma transmissão avulsa (fora de partida/torneio).
export function SpecStandaloneButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  const create = () => start(async () => {
    const res = await startStandaloneSpecStreamAction(title);
    if ("error" in res) { toast.error(res.error); return; }
    router.push(`/spec/${res.streamId}/transmitir`);
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-4 py-2 text-xs font-black text-[#FFCB05] hover:bg-[#FFCB05]/20">
        📡 Abrir transmissão avulsa
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-slate-950/60 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título da transmissão (ex.: Bate-papo Zika)"
        maxLength={80}
        className="min-w-0 flex-1 rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        onKeyDown={(e) => { if (e.key === "Enter") create(); }}
      />
      <button onClick={create} disabled={pending || title.trim().length < 3} className="rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-black text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40">
        {pending ? "Abrindo…" : "Iniciar"}
      </button>
      <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200">Cancelar</button>
    </div>
  );
}
