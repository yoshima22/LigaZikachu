import type { DeckSendRow } from "@/lib/deck-send-status";

/** Painel público: quem já enviou e salvou o deck (sem revelar o conteúdo). */
export function DeckSendStatusPanel({
  rows, sentCount, expectedPerPlayer,
}: { rows: DeckSendRow[]; sentCount: number; expectedPerPlayer: number | null }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5 rounded-xl border border-border bg-slate-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Envio de decks</h3>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          {sentCount} de {rows.length} já enviaram
        </span>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        Mostra apenas quem já enviou e salvou o deck. As listas só são reveladas após o fechamento.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const done = row.sent > 0;
          const partial = expectedPerPlayer != null && done && row.sent < expectedPerPlayer;
          return (
            <div
              key={row.id}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                done ? "border-emerald-500/25 bg-emerald-500/10 text-slate-200" : "border-border bg-slate-950/40 text-slate-500"
              }`}
            >
              <span className="truncate font-medium">{row.name}</span>
              <span className={`shrink-0 font-semibold ${partial ? "text-amber-400" : done ? "text-emerald-400" : "text-slate-600"}`}>
                {!done
                  ? "Pendente"
                  : partial
                    ? `Parcial (${row.sent}/${expectedPerPlayer})`
                    : `✓ Enviado${expectedPerPlayer == null && row.sent > 1 ? ` (${row.sent})` : ""}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
