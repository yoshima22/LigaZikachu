"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { createModifierAction, deleteModifierAction, toggleModifierAction } from "../modifier-actions";

interface Modifier {
  id: string;
  key: string;
  name: string;
  description: string;
  active: boolean;
  effectJson: unknown;
}

export function ModifierPanel({ modifiers }: { modifiers: Modifier[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const act = (fn: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{modifiers.length} modificador(es) cadastrado(s). Os ativos entram no sorteio de cada rodada.</p>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="inline-flex items-center gap-1 rounded-lg border border-[#FFCB05]/40 px-3 py-1.5 text-xs font-bold text-[#FFCB05]"
        >
          <Plus size={13} /> Novo modificador
        </button>
      </div>

      {showForm && (
        <form
          action={async (fd) => {
            const r = await createModifierAction(fd);
            if (r.error) toast.error(r.error);
            else { toast.success("Modificador criado."); setShowForm(false); router.refresh(); }
          }}
          className="rounded-xl border border-[#FFCB05]/20 bg-slate-950/60 p-4 space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-400">
              Chave (KEY_FORMATO)
              <input name="key" placeholder="CHUVA_ACIDA" className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" required />
            </label>
            <label className="text-xs text-slate-400">
              Nome exibido
              <input name="name" placeholder="Chuva Ácida" className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" required />
            </label>
          </div>
          <label className="text-xs text-slate-400 block">
            Descrição (mostrada aos jogadores)
            <textarea name="description" rows={2} placeholder="Todos os mascotes recebem +20% em Força nesta rodada." className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" required />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-400">
              Tipo de efeito
              <select name="effectType" className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100">
                <option value="NONE">Nenhum (narrativo)</option>
                <option value="STAT_BOOST">Bônus de stat</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Stat alvo
              <select name="effectStat" className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100">
                <option value="">—</option>
                <option value="statForce">Força</option>
                <option value="statAgility">Agilidade</option>
                <option value="statVitality">Vitalidade</option>
                <option value="statCharisma">Carisma</option>
                <option value="statInstinct">Instinto</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Multiplicador (ex: 0.2 = +20%)
              <input name="effectValue" type="number" step="0.05" min="0" max="2" defaultValue="0.2" className="mt-1 w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-bold text-slate-950">Criar</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-xs text-slate-400">Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {modifiers.map((mod) => (
          <div key={mod.id} className={`rounded-xl border p-3 text-xs flex items-start gap-3 ${mod.active ? "border-purple-500/30 bg-purple-500/5" : "border-border bg-slate-950/40 opacity-60"}`}>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100">{mod.name} <span className="text-slate-500 font-mono text-[10px]">{mod.key}</span></p>
              <p className="mt-0.5 text-slate-400">{mod.description}</p>
              {mod.effectJson != null && (
                <p className="mt-1 text-purple-300 font-mono text-[10px]">{JSON.stringify(mod.effectJson as object)}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                disabled={pending}
                onClick={() => act(() => toggleModifierAction(mod.id, !mod.active))}
                title={mod.active ? "Desativar" : "Ativar"}
                className="text-slate-400 hover:text-[#FFCB05] disabled:opacity-50"
              >
                {mod.active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Deletar "${mod.name}"?`)) return;
                  act(() => deleteModifierAction(mod.id));
                }}
                className="text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {modifiers.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-slate-500">
            Nenhum modificador cadastrado ainda. Crie alguns para sortear nas rodadas.
          </p>
        )}
      </div>
    </div>
  );
}
