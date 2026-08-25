"use client";

import { useMemo, useState, useTransition } from "react";
import type { ManagedForm } from "../actions";
import { setEggPokemonEnabled } from "../actions";

const PAGE = 25;

export function FormsPoolManager({ forms }: { forms: ManagedForm[] }) {
  const [state, setState] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(forms.map((f) => [f.id, f.enabled])),
  );
  const [search, setSearch] = useState("");
  const [gen, setGen] = useState<"" | number>("");
  const [page, setPage] = useState(0);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter((f) =>
      (!q || f.name.toLowerCase().includes(q) || String(f.id).includes(q)) &&
      (gen === "" || f.generation === gen),
    );
  }, [forms, search, gen]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE, (safePage + 1) * PAGE);
  const enabledCount = forms.filter((f) => state[f.id]).length;

  const toggle = (form: ManagedForm) => {
    const next = !state[form.id];
    setState((s) => ({ ...s, [form.id]: next }));
    setBusyId(form.id);
    start(async () => {
      const res = await setEggPokemonEnabled(form.id, next);
      if (res.error) setState((s) => ({ ...s, [form.id]: !next })); // reverte
      setBusyId(null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Buscar por nome ou ID…"
          className="flex-1 min-w-48 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#FFCB05]"
        />
        <select
          value={gen}
          onChange={(e) => { setGen(e.target.value === "" ? "" : Number(e.target.value)); setPage(0); }}
          className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none focus:border-[#FFCB05]"
        >
          <option value="">Todas as gerações</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => <option key={g} value={g}>Geração {g}</option>)}
        </select>
        <span className="text-xs text-slate-500">{enabledCount}/{forms.length} ligados</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-slate-900/60 text-left text-slate-400">
              <th className="p-2 font-semibold">Sprite</th>
              <th className="p-2 font-semibold">ID</th>
              <th className="p-2 font-semibold">Nome</th>
              <th className="p-2 font-semibold">Tipos</th>
              <th className="p-2 font-semibold">Gen</th>
              <th className="p-2 text-center font-semibold">No drop</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.map((f) => (
              <tr key={f.id} className="hover:bg-slate-900/40">
                <td className="p-2"><img src={f.spriteUrl} alt="" className="h-8 w-8 object-contain [image-rendering:pixelated]" /></td>
                <td className="p-2 tabular-nums text-slate-500">{f.id}</td>
                <td className="p-2 font-medium text-slate-200">{f.name}</td>
                <td className="p-2 text-slate-400">{f.types.join(" / ")}</td>
                <td className="p-2 text-slate-500">{f.generation ?? "—"}</td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!state[f.id]}
                    disabled={pending && busyId === f.id}
                    onChange={() => toggle(f)}
                    className="h-4 w-4 cursor-pointer accent-[#FFCB05] disabled:opacity-40"
                    title={state[f.id] ? "Ligado — entra no drop da pool. Clique para desligar." : "Desligado — fora do drop. Clique para ligar."}
                  />
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum resultado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30">← Anterior</button>
          <span>{safePage + 1} / {totalPages} · {filtered.length} formas</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30">Próximo →</button>
        </div>
      )}
    </div>
  );
}
