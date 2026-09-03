"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { activatePaidPass, adminAddPassReservations, adminActivateNextPassList } from "../liga-cash-actions";

type Order = { id: string; playerName: string; paidAt: string | null; offerSlot: string | null; passLabel: string };
type Reservation = { id: string; playerName: string; paidAt: string | null };

export function LigaCashPanel({ orders, nextPass, nextReservations }: {
  orders: Order[];
  nextPass?: { label: string; retroactive: boolean } | null;
  nextReservations?: Reservation[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [retro, setRetro] = useState<Record<string, boolean>>({});
  const [names, setNames] = useState("");
  const [bulkRetro, setBulkRetro] = useState(nextPass?.retroactive ?? false);

  const reservations = nextReservations ?? [];

  return (
    <section className="space-y-6">
      {/* ── Lista do próximo passe (inclusão em massa) ── */}
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-5">
        <h2 className="font-bold text-violet-200">Lista do próximo passe</h2>
        {!nextPass ? (
          <p className="mt-1 text-xs text-amber-300/80">Marque um calendário como <b>&ldquo;Próximo passe da loja&rdquo;</b> para montar e ativar a lista.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-400">
              Inclua jogadores por nome (um por linha ou separados por vírgula) e envie todos de uma vez. Quem entrar na lista já fica com o botão de compra do próximo passe apagado no LigaCash. Passe: <b className="text-violet-200">{nextPass.label}</b>.
            </p>
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder={"Nome do jogador 1\nNome do jogador 2\n..."}
              rows={4}
              className="mt-3 w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={bulkRetro} onChange={(e) => setBulkRetro(e.target.checked)} className="accent-violet-400" /> Modo retroativo (permite resgatar dias já passados ao ativar)
              </label>
              <button
                disabled={pending || !names.trim()}
                onClick={() => start(async () => {
                  const r = await adminAddPassReservations(names, bulkRetro);
                  if (r.error) { toast.error(r.error); return; }
                  const parts = [`${r.added ?? 0} adicionado(s)`];
                  if (r.already) parts.push(`${r.already} já estavam`);
                  if (r.notFound?.length) parts.push(`${r.notFound.length} não encontrado(s): ${r.notFound.join(", ")}`);
                  toast.success(parts.join(" · "));
                  setNames("");
                  router.refresh();
                })}
                className="rounded-lg bg-violet-400 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
              >
                Adicionar à lista
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-300">Reservados ({reservations.length})</p>
                <button
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Ativar a lista agora? Isto distribui o passe "${nextPass.label}" a ${reservations.length} reservado(s)${bulkRetro ? " (retroativo)" : ""}, promove este passe para ATUAL e esvazia o slot do próximo. Continuar?`)) return;
                    start(async () => {
                      const r = await adminActivateNextPassList();
                      if (r.error) { toast.error(r.error); return; }
                      toast.success(`Lista ativada: ${r.granted ?? 0} passe(s) distribuído(s)${r.failed ? `, ${r.failed} falha(s)` : ""}. Próximo passe promovido a atual.`);
                      router.refresh();
                    });
                  }}
                  className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-black text-slate-950 disabled:opacity-50"
                >
                  ⚡ Ativar lista e promover a atual
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reservations.length === 0
                  ? <span className="text-[11px] text-slate-500">Ninguém na lista ainda.</span>
                  : reservations.map((r) => (
                    <span key={r.id} className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-100">{r.playerName}</span>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Distribuição individual (compras pendentes) ── */}
      <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/60 p-5">
        <h2 className="font-bold text-cyan-200">Passes pagos aguardando distribuição</h2>
        <p className="mt-1 text-xs text-slate-400">Distribuição individual de cada compra. Escolha a retroatividade e entregue o calendário integral ao jogador.</p>
        <div className="mt-4 space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-3">
              <div>
                <b className="text-sm text-white">{o.playerName}</b>
                <p className="text-[10px] text-slate-500">{o.offerSlot === "CURRENT" ? "Passe atual" : "Passe do mês seguinte"} · {o.passLabel} · Pago em {o.paidAt ? new Date(o.paidAt).toLocaleString("pt-BR") : "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={retro[o.id] ?? false} onChange={(e) => setRetro((v) => ({ ...v, [o.id]: e.target.checked }))} className="accent-cyan-400" /> Retroativo</label>
                <button disabled={pending} onClick={() => start(async () => { const r = await activatePaidPass(o.id, retro[o.id] ?? false); if (r.error) toast.error(r.error); else { toast.success("Passe distribuído integralmente."); router.refresh(); } })} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50">Distribuir passe</button>
              </div>
            </div>
          ))}
          {!orders.length && <p className="text-sm text-slate-500">Nenhum pagamento pendente de distribuição.</p>}
        </div>
      </div>
    </section>
  );
}
