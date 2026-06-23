"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Send, Trash2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { transferSyncTicketHalfAction, discardSyncTicketHalfAction, swapSyncTicketHalfSideAction } from "../actions";

type HalfData = {
  id: string;
  side: "LEFT" | "RIGHT";
  status: string;
  generatedByPlayerId: string;
  generatedByPlayer: { displayName: string };
  sourceAction: string;
};

type PlayerOption = {
  id: string;
  displayName: string;
  ptcglNick: string | null;
};

const ITEMS_PER_PAGE = 4;

function getSideLabel(side: string) { return side === "LEFT" ? "Metade Esquerda (Fogo)" : "Metade Direita (Água)"; }
function getSideImage(side: string) { return side === "LEFT" ? "/events/desafio-sincronizado/ticket-esquerda-fogo.webp" : "/events/desafio-sincronizado/ticket-direita-agua.webp"; }

export function HalvesSection({
  halves,
  players,
  myPlayerId,
}: {
  halves: HalfData[];
  players: PlayerOption[];
  myPlayerId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(halves.length / ITEMS_PER_PAGE));
  const paginated = halves.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const transfer = (formData: FormData) => {
    startTransition(async () => {
      const res = await transferSyncTicketHalfAction(formData);
      if (res.error) toast.error(res.error);
      else { toast.success(res.success ?? "Enviada!"); router.refresh(); }
    });
  };

  const discard = (halfId: string) => {
    if (!confirm("Descartar esta metade permanentemente?")) return;
    startTransition(async () => {
      const res = await discardSyncTicketHalfAction(halfId);
      if (res.error) toast.error(res.error);
      else { toast.success("Metade descartada."); router.refresh(); }
    });
  };

  const swap = (halfId: string) => {
    startTransition(async () => {
      const res = await swapSyncTicketHalfSideAction(halfId);
      if (res.error) toast.error(res.error);
      else { toast.success("Lado trocado!"); router.refresh(); }
    });
  };

  return (
    <div>
      <p className="mb-4 text-sm text-slate-400">
        Metades não podem ser vendidas. Elas só circulam por presente/envio direto. A origem sempre fica gravada.
      </p>

      {halves.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-slate-500">
          Você ainda não possui metades. Elas podem cair em Arena, expedições, reciclagem e vitórias TCG validadas.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {paginated.map((half) => {
              const isMine = half.generatedByPlayerId === myPlayerId;
              return (
                <div key={half.id} className="rounded-xl border border-border bg-slate-950/60 p-3">
                  <div className="flex gap-3">
                    <Image src={getSideImage(half.side)} alt={getSideLabel(half.side)} width={72} height={96} className="h-24 w-16 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-100">{getSideLabel(half.side)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Gerada por: <span className="text-slate-200">{half.generatedByPlayer.displayName}</span>
                      </p>
                      <p className="text-xs text-slate-500">Origem: {half.sourceAction}</p>
                      {isMine && (
                        <p className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                          Você gerou esta metade. Envie para outro jogador; você não pode usá-la.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {/* Transfer */}
                    <form action={transfer} className="flex gap-1.5 flex-1 min-w-0">
                      <input type="hidden" name="halfId" value={half.id} />
                      <select name="targetPlayerId" className="min-w-0 flex-1 rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-100">
                        {players.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.displayName}{target.ptcglNick ? ` (${target.ptcglNick})` : ""}
                          </option>
                        ))}
                      </select>
                      <button disabled={pending} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 px-2.5 py-1.5 text-xs font-bold text-cyan-100 disabled:opacity-40">
                        <Send size={12} /> Enviar
                      </button>
                    </form>

                    {/* Swap side (only own-generated) */}
                    {isMine && (
                      <button onClick={() => swap(half.id)} disabled={pending} title="Trocar para a outra metade"
                        className="inline-flex items-center gap-1 rounded-lg border border-purple-400/40 px-2.5 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-500/10 disabled:opacity-40">
                        <ArrowLeftRight size={12} /> Trocar lado
                      </button>
                    )}

                    {/* Discard */}
                    <button onClick={() => discard(half.id)} disabled={pending} title="Descartar permanentemente"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-40">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="rounded-lg border border-border bg-slate-800 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30">← Anterior</button>
              <span className="text-xs text-slate-500">{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="rounded-lg border border-border bg-slate-800 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30">Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
