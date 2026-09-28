"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Send, Trash2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import {
  transferSyncTicketHalfAction,
  discardSyncTicketHalfAction,
  swapSyncTicketHalfSideAction,
  bulkDiscardSyncTicketHalvesAction,
  bulkTransferSyncTicketHalvesAction,
} from "../actions";
import { PlayerSearchInput } from "@/components/player-search-input";

type HalfData = {
  id: string;
  side: "LEFT" | "RIGHT";
  status: string;
  generatedByPlayerId: string;
  generatedByPlayer: { displayName: string };
  sourceAction: string;
};

const ITEMS_PER_PAGE = 4;

function getSideLabel(side: string) { return side === "LEFT" ? "Metade Esquerda (Fogo)" : "Metade Direita (Água)"; }
function getSideImage(side: string) { return side === "LEFT" ? "/events/desafio-sincronizado/ticket-esquerda-fogo.webp" : "/events/desafio-sincronizado/ticket-direita-agua.webp"; }

export function HalvesSection({
  halves,
  myPlayerId,
}: {
  halves: HalfData[];
  myPlayerId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(0);
  const [hideMine, setHideMine] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState("");

  const visible = useMemo(
    () => (hideMine ? halves.filter((h) => h.generatedByPlayerId !== myPlayerId) : halves),
    [halves, hideMine, myPlayerId],
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE));
  const paginated = visible.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkDiscard = () => {
    if (selected.size === 0) return;
    if (!confirm(`Descartar ${selected.size} metade(s) permanentemente?`)) return;
    const formData = new FormData();
    selected.forEach((id) => formData.append("halfIds", id));
    startTransition(async () => {
      const res = await bulkDiscardSyncTicketHalvesAction(formData);
      if (res.error) toast.error(res.error);
      else { toast.success(res.success ?? "Descartadas!"); setSelected(new Set()); router.refresh(); }
    });
  };

  const bulkTransfer = () => {
    if (selected.size === 0 || !bulkTarget) return;
    const formData = new FormData();
    selected.forEach((id) => formData.append("halfIds", id));
    formData.append("targetPlayerId", bulkTarget);
    startTransition(async () => {
      const res = await bulkTransferSyncTicketHalvesAction(formData);
      if (res.error) toast.error(res.error);
      else { toast.success(res.success ?? "Enviadas!"); setSelected(new Set()); setBulkTarget(""); router.refresh(); }
    });
  };

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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={hideMine}
            onChange={(e) => { setHideMine(e.target.checked); setPage(0); setSelected(new Set()); }}
            className="h-4 w-4 accent-[#FFCB05]"
          />
          Ocultar metades geradas por mim
        </label>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-slate-950/60 px-2 py-1.5">
            <span className="text-xs text-slate-400">{selected.size} selecionada(s)</span>
            <button onClick={bulkDiscard} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-200 disabled:opacity-40">
              <Trash2 size={12} /> Excluir
            </button>
            <PlayerSearchInput value={bulkTarget} onChange={(id) => setBulkTarget(id)} excludeIds={[myPlayerId]} className="w-40" />
            <button onClick={bulkTransfer} disabled={pending || !bulkTarget}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-100 disabled:opacity-40">
              <Send size={12} /> Enviar
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-slate-500">
          {halves.length === 0
            ? "Você ainda não possui metades. Elas podem cair em Arena, expedições, reciclagem e vitórias TCG validadas."
            : "Nenhuma metade para mostrar com esse filtro."}
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {paginated.map((half) => {
              const isMine = half.generatedByPlayerId === myPlayerId;
              return (
                <div key={half.id} className="rounded-xl border border-border bg-slate-950/60 p-3">
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(half.id)}
                      onChange={() => toggleSelected(half.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#FFCB05]"
                    />
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
                      <PlayerSearchInput name="targetPlayerId" required excludeIds={[myPlayerId]} className="min-w-48 flex-1" />
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
