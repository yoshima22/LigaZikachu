"use client";

import { useState } from "react";
import { TIERS } from "@/lib/amigo-oculto/catalog";
import type { ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { resetKitAction, saveKitAction } from "../actions";
import { PackageCard, TIER_COLOR } from "./package-ui";

type Run = (f: () => Promise<unknown>) => void;
type Row = { name: string; qty: number };
const btn = "rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40";
const btnPrimary = "rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40";

// Editor de kits (admin): troca itens e quantidades de cada kit nesta edição. "Restaurar" volta ao padrão do catálogo.
export function KitEditor({ editionId, packages, edited, choices, run, pending, locked }: { editionId: string; packages: ResolvedPackage[]; edited: string[]; choices: string[]; run: Run; pending: boolean; locked: boolean }) {
  const [tier, setTier] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const start = (p: ResolvedPackage) => { setOpen(p.key); setRows(p.items.map((i) => ({ name: i.name, qty: i.qty }))); };
  const upd = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const known = new Set(choices.map((c) => c.toLowerCase()));
  const invalid = rows.some((r) => !known.has(r.name.trim().toLowerCase()) || !(r.qty >= 1));
  const num = "w-20 rounded-lg bg-black/30 p-2 text-sm";

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
      <h2 className="font-semibold">🧰 Editar kits</h2>
      <p className="text-xs text-slate-300">Troque os itens e as quantidades de qualquer kit desta edição. Vale para quem ainda não recebeu: kits já escolhidos pelos jogadores passam a entregar o conteúdo novo. {locked && <b className="text-red-300">Edição já entregue: edição bloqueada.</b>}</p>
      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => <button key={t.tier} className={`rounded-lg px-3 py-1.5 text-sm ${tier === t.tier ? "bg-amber-400 font-semibold text-slate-900" : "bg-white/10 hover:bg-white/20"}`} onClick={() => { setTier(t.tier); setOpen(null); }}>{t.emoji} {t.name}</button>)}
      </div>
      <datalist id="kit-items">{choices.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        {packages.filter((p) => p.tier === tier).map((p) => (
          <div key={p.key} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-2">
            <PackageCard pkg={p} />
            <div className="flex flex-wrap items-center gap-2 px-1">
              {edited.includes(p.key) && <span className={`rounded-full bg-white/10 px-2 py-0.5 text-[11px] ${TIER_COLOR[tier]}`}>✎ editado</span>}
              <button className={btn} disabled={pending || locked} onClick={() => (open === p.key ? setOpen(null) : start(p))}>{open === p.key ? "Fechar" : "Editar itens"}</button>
              {edited.includes(p.key) && <button className={btn} disabled={pending || locked} onClick={() => confirm("Voltar este kit ao conteúdo padrão?") && run(() => resetKitAction(editionId, p.key))}>Restaurar padrão</button>}
            </div>
            {open === p.key && (
              <div className="space-y-2 rounded-lg border border-amber-300/30 bg-black/30 p-2">
                {rows.map((r, i) => {
                  const bad = !known.has(r.name.trim().toLowerCase());
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input list="kit-items" value={r.name} onChange={(ev) => upd(i, { name: ev.target.value })} placeholder="Item…" className={`min-w-0 flex-1 rounded-lg bg-black/40 p-2 text-sm ${bad ? "ring-1 ring-red-400" : ""}`} />
                      <input type="number" min={1} max={999} value={r.qty} onChange={(ev) => upd(i, { qty: Number(ev.target.value) })} className={num} aria-label="Quantidade" />
                      <button className={btn} disabled={rows.length <= 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remover item">✕</button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2">
                  <button className={btn} disabled={rows.length >= 8} onClick={() => setRows([...rows, { name: "", qty: 1 }])}>+ item</button>
                  <button className={btnPrimary} disabled={pending || invalid} onClick={() => run(async () => { const r = await saveKitAction(editionId, p.key, rows.map((x) => ({ name: x.name.trim(), qty: x.qty }))); if (!(r && "error" in r)) setOpen(null); return r; })}>Salvar kit</button>
                </div>
                <p className="text-[11px] text-slate-400">Digite para buscar na lista (itens da loja, ovos, Comida, Doce, Doce Raro, Pedra de Mega aleatória). Nome precisa ser um da lista.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
