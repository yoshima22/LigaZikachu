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
      (!q || f.name.toLowerCase().includes(q) || f.baseName.toLowerCase().includes(q) || String(f.id).includes(q)) &&
      (gen === "" || f.generation === gen),
    );
  }, [forms, search, gen]);

  // Agrupa por espécie base (Pokédex): cada grupo é uma espécie com suas formas.
  const groups = useMemo(() => {
    const byBase = new Map<number, { baseId: number; baseName: string; baseSpriteUrl: string; forms: ManagedForm[] }>();
    for (const f of filtered) {
      let g = byBase.get(f.baseId);
      if (!g) { g = { baseId: f.baseId, baseName: f.baseName, baseSpriteUrl: f.baseSpriteUrl, forms: [] }; byBase.set(f.baseId, g); }
      g.forms.push(f);
    }
    return [...byBase.values()].sort((a, b) => a.baseName.localeCompare(b.baseName, "pt-BR"));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedGroups = groups.slice(safePage * PAGE, (safePage + 1) * PAGE);
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

  // Liga/desliga TODAS as formas de uma espécie de uma vez.
  const toggleGroup = (formsInGroup: ManagedForm[], next: boolean) => {
    setState((s) => { const copy = { ...s }; for (const f of formsInGroup) copy[f.id] = next; return copy; });
    start(async () => {
      for (const f of formsInGroup) {
        const res = await setEggPokemonEnabled(f.id, next);
        if (res.error) setState((s) => ({ ...s, [f.id]: !next }));
      }
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

      <p className="text-[11px] text-slate-500">As formas ficam agrupadas pela espécie base (Pokédex). No drop, ligar uma forma faz ela entrar na 2ª rolagem interna daquela espécie — a base sempre existe.</p>
      <div className="space-y-3">
        {pagedGroups.map((g) => {
          const enabledInGroup = g.forms.filter((f) => state[f.id]).length;
          const allOn = enabledInGroup === g.forms.length;
          return (
            <div key={g.baseId} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-3 border-b border-border bg-slate-900/60 p-2">
                <img src={g.baseSpriteUrl} alt="" className="h-9 w-9 object-contain [image-rendering:pixelated]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{g.baseName} <span className="text-[10px] font-mono text-slate-500">#{g.baseId}</span></p>
                  <p className="text-[10px] text-slate-500">{g.forms.length} forma(s) · {enabledInGroup} ligada(s)</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.forms, !allOn)}
                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${allOn ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"}`}
                >
                  {allOn ? "Desligar todas" : "Ligar todas"}
                </button>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {g.forms.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-900/40">
                      <td className="p-2 w-12"><img src={f.spriteUrl} alt="" className="h-8 w-8 object-contain [image-rendering:pixelated]" /></td>
                      <td className="p-2 tabular-nums text-slate-500 w-16">{f.id}</td>
                      <td className="p-2 font-medium text-slate-200">{f.name}</td>
                      <td className="hidden p-2 text-slate-400 sm:table-cell">{f.types.join(" / ")}</td>
                      <td className="p-2 text-slate-500 w-12">G{f.generation ?? "—"}</td>
                      <td className="p-2 text-center w-14">
                        <input
                          type="checkbox"
                          checked={!!state[f.id]}
                          disabled={pending && busyId === f.id}
                          onChange={() => toggle(f)}
                          className="h-4 w-4 cursor-pointer accent-[#FFCB05] disabled:opacity-40"
                          title={state[f.id] ? "Ligado — entra na 2ª rolagem da espécie. Clique para desligar." : "Desligado — fora do drop. Clique para ligar."}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {pagedGroups.length === 0 && (
          <div className="rounded-xl border border-border p-6 text-center text-slate-500">Nenhum resultado.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30">← Anterior</button>
          <span>{safePage + 1} / {totalPages} · {groups.length} espécies</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30">Próximo →</button>
        </div>
      )}
    </div>
  );
}
