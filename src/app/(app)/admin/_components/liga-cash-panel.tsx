"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { X, Search } from "lucide-react";
import { activatePaidPass, adminActivateNextPassList, adminAddPassReservation, adminRemovePassReservation, searchPlayersForPass } from "../liga-cash-actions";

type Order = { id: string; playerName: string; paidAt: string | null; offerSlot: string | null; passLabel: string };
type Reservation = { id: string; playerName: string; paidAt: string | null; manual: boolean };
type SearchHit = { id: string; displayName: string; onList: boolean };

export function LigaCashPanel({ orders, nextPass, nextReservations }: {
  orders: Order[];
  nextPass?: { label: string; retroactive: boolean } | null;
  nextReservations?: Reservation[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [retro, setRetro] = useState<Record<string, boolean>>({});
  const [allRetro, setAllRetro] = useState(false);

  // Autocomplete de jogadores
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nextPass || query.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setHits(await searchPlayersForPass(query)); } catch { setHits([]); }
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, nextPass]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setHits([]); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const reservations = nextReservations ?? [];

  const addPlayer = (hit: SearchHit) => {
    if (hit.onList) { toast.info(`${hit.displayName} já está na lista.`); return; }
    start(async () => {
      const r = await adminAddPassReservation(hit.id);
      if (r.error) { toast.error(r.error); return; }
      toast.success(r.already ? `${r.name} já estava na lista.` : `${r.name} adicionado à lista de espera.`);
      setQuery(""); setHits([]);
      router.refresh();
    });
  };

  const removeReservation = (id: string) => start(async () => {
    const r = await adminRemovePassReservation(id);
    if (r.error) { toast.error(r.error); return; }
    toast.success("Removido da lista.");
    router.refresh();
  });

  const distributeAll = () => {
    if (!nextPass) return;
    if (reservations.length === 0) { toast.error("Ninguém na lista de espera."); return; }
    if (!confirm(`Distribuir o passe "${nextPass.label}" a ${reservations.length} jogador(es) da lista${allRetro ? " (retroativo)" : ""}?\n\nIsto promove o próximo passe para ATUAL, remove o passe antigo da vitrine do LigaCash e esvazia a lista do próximo. Continuar?`)) return;
    start(async () => {
      const r = await adminActivateNextPassList(allRetro);
      if (r.error) { toast.error(r.error); return; }
      toast.success(`${r.granted ?? 0} passe(s) distribuído(s)${r.failed ? `, ${r.failed} falha(s)` : ""}. Próximo passe promovido a atual e lista esvaziada.`);
      router.refresh();
    });
  };

  return (
    <section className="space-y-6">
      {/* ── Lista do próximo passe: apenas adiciona à espera ── */}
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-5">
        <h2 className="font-bold text-violet-200">Lista do próximo passe</h2>
        {!nextPass ? (
          <p className="mt-1 text-xs text-amber-300/80">Marque um calendário como <b>&ldquo;Próximo passe da loja&rdquo;</b> para montar a lista de espera.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-400">
              Busque o jogador pelo nome e adicione à <b>lista de espera</b>. Quem entrar já fica com o botão de compra do próximo passe apagado no LigaCash. A distribuição é feita depois, no bloco abaixo. Passe: <b className="text-violet-200">{nextPass.label}</b>.
            </p>
            <div ref={boxRef} className="relative mt-3 max-w-md">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar jogador por nome…"
                className="w-full rounded-xl border border-border bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-violet-400/50"
              />
              {query.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-slate-950 shadow-xl">
                  {searching && <p className="px-3 py-2 text-xs text-slate-500">Buscando…</p>}
                  {!searching && hits.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">Nenhum jogador encontrado.</p>}
                  {hits.map((h) => (
                    <button key={h.id} type="button" disabled={pending || h.onList} onClick={() => addPlayer(h)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-violet-500/10 disabled:opacity-40">
                      <span className="truncate">{h.displayName}</span>
                      <span className="shrink-0 text-[10px] font-bold text-slate-500">{h.onList ? "já na lista" : "+ adicionar"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold text-slate-300">Aguardando distribuição ({reservations.length})</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reservations.length === 0
                  ? <span className="text-[11px] text-slate-500">Ninguém na lista ainda.</span>
                  : reservations.map((r) => (
                    <span key={r.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${r.manual ? "border-violet-400/25 bg-violet-500/10 text-violet-100" : "border-cyan-400/25 bg-cyan-500/10 text-cyan-100"}`} title={r.manual ? "Adicionado manualmente" : "Compra por Pix"}>
                      {r.playerName}{!r.manual && " 💳"}
                      {r.manual && (
                        <button type="button" disabled={pending} onClick={() => removeReservation(r.id)} className="text-violet-300/70 hover:text-red-300" title="Remover da lista"><X size={11} /></button>
                      )}
                    </span>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Passes pagos aguardando distribuição + distribuir a todos ── */}
      <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/60 p-5">
        <h2 className="font-bold text-cyan-200">Passes pagos aguardando distribuição</h2>
        <p className="mt-1 text-xs text-slate-400">Distribua a lista inteira de uma vez ou trate cada compra individualmente.</p>

        {nextPass && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={allRetro} onChange={(e) => setAllRetro(e.target.checked)} className="accent-amber-400" /> Todos retroativos (podem resgatar dias já passados)
            </label>
            <button disabled={pending || reservations.length === 0} onClick={distributeAll} className="rounded-lg bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">
              ⚡ Distribuir a todos da lista ({reservations.length}) e promover a atual
            </button>
          </div>
        )}

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
