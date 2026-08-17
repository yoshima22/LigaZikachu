"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSpecMatchStateAction, startSpecStreamAction } from "@/app/(app)/spec/actions";

type MatchStreamState = { enabled: boolean; stream: { id: string; status: string; mine: boolean } | null };

// Indicador AO VIVO + botões Transmitir/Assistir dentro do card de resultados.
// Autocontido: consulta o estado da partida e respeita o feature flag/permissão
// no servidor. Não renderiza nada quando o Modo SPEC está desativado.
export function SpecMatchControl({ matchId, canBroadcast }: { matchId: string; canBroadcast: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<MatchStreamState | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    getSpecMatchStateAction(matchId).then((s) => { if (alive) setState(s); }).catch(() => null);
    return () => { alive = false; };
  }, [matchId]);

  if (!state || !state.enabled) return null;

  const stream = state.stream;
  const openBroadcast = () => start(async () => {
    const res = await startSpecStreamAction(matchId);
    if ("error" in res) { toast.error(res.error); return; }
    router.push(`/spec/${res.streamId}/transmitir`);
  });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/15 bg-red-500/5 p-2">
      {stream?.status === "LIVE" ? (
        <>
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-300">🔴 AO VIVO</span>
          <Link href={`/spec/${stream.id}`} className="rounded-lg bg-[#FFCB05] px-3 py-1 text-[11px] font-black text-[#1A1A2E] hover:bg-[#FFD700]">▶ Assistir</Link>
          {stream.mine && <Link href={`/spec/${stream.id}/transmitir`} className="text-[11px] font-semibold text-slate-300 underline">Painel</Link>}
        </>
      ) : stream?.status === "PREPARING" && stream.mine ? (
        <Link href={`/spec/${stream.id}/transmitir`} className="rounded-lg border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-1 text-[11px] font-bold text-[#FFCB05]">Continuar transmissão</Link>
      ) : stream ? (
        <span className="text-[11px] text-slate-500">Transmissão sendo preparada…</span>
      ) : canBroadcast ? (
        <button type="button" onClick={openBroadcast} disabled={pending} className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50">
          📡 Transmitir esta partida
        </button>
      ) : (
        <span className="text-[11px] text-slate-600">Sem transmissão ao vivo.</span>
      )}
    </div>
  );
}
