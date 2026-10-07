"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ensureAbilityTmsAction, setAbilityTmsActiveAction } from "./actions";

type Row = {
  abilityKey: string; name: string; category: string; effectName: string; species: number; sample: string;
  created: boolean; active: boolean; price: number | null; owners: number;
};

export function AbilityTmAdmin({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(), [rows]);
  const visible = rows.filter((r) =>
    (!category || r.category === category) &&
    (!query.trim() || `${r.name} ${r.effectName} ${r.sample}`.toLowerCase().includes(query.trim().toLowerCase())));
  const missing = rows.filter((r) => !r.created).length;

  const run = (job: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await job();
      if (res.error) toast.error(res.error);
      else { toast.success(ok); router.refresh(); }
    });
  const setActive = (active: boolean, keys?: string[]) =>
    run(() => setAbilityTmsActiveAction(active, keys), active ? "TMs ligados." : "TMs desligados.");
  const createdKeys = visible.filter((r) => r.created).map((r) => r.abilityKey);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar habilidade ou mascote…"
          className="min-w-52 flex-1 rounded-lg border border-border bg-slate-900 px-3 py-2 text-slate-200 outline-none" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-slate-900 px-3 py-2 text-slate-300">
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button disabled={pending || !createdKeys.length} onClick={() => setActive(true, createdKeys)}
          className="rounded-lg bg-emerald-500 px-3 py-2 font-bold text-slate-950 disabled:opacity-40">Ligar os {createdKeys.length} da lista</button>
        <button disabled={pending || !createdKeys.length} onClick={() => setActive(false, createdKeys)}
          className="rounded-lg border border-rose-400/40 px-3 py-2 font-bold text-rose-300 disabled:opacity-40">Desligar os da lista</button>
      </div>
      {missing > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
          {missing} TM(s) ainda não foram criados na loja.
          <button disabled={pending} onClick={() => run(ensureAbilityTmsAction, "TMs criados (desligados).")}
            className="rounded-lg bg-amber-300 px-3 py-1.5 font-bold text-slate-950 disabled:opacity-40">Criar os que faltam</button>
        </div>
      )}
      <p className="text-[11px] text-slate-500">{rows.filter((r) => r.active).length} ligados de {rows.length} · mostrando {visible.length}</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-left text-slate-500">
            <tr><th className="px-3 py-2">TM</th><th>Efeito</th><th>Mascotes</th><th className="text-right">Preço</th><th className="text-right">Donos</th><th className="px-3 text-center">Na loja</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.map((r) => (
              <tr key={r.abilityKey} className={r.active ? "" : "opacity-70"}>
                <td className="px-3 py-2 font-semibold text-white">{r.name}<span className="ml-1 text-[10px] text-slate-500">{r.category}</span></td>
                <td className="text-slate-400">{r.effectName}</td>
                <td className="text-slate-400">{r.species} · {r.sample}</td>
                <td className="text-right tabular-nums text-slate-300">{r.price ?? "—"}</td>
                <td className="text-right tabular-nums text-slate-400">{r.owners}</td>
                <td className="px-3 text-center">
                  <button disabled={pending || !r.created} onClick={() => setActive(!r.active, [r.abilityKey])}
                    className={`rounded-full px-3 py-1 font-bold disabled:opacity-40 ${r.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700/50 text-slate-400"}`}>
                    {r.active ? "Ligado" : "Desligado"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
