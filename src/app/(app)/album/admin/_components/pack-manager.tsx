"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createStickerPack, toggleStickerPack } from "../actions";

interface Pack {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cardCount: number;
  generation: number | null;
  rarityBoost: boolean;
  active: boolean;
}

const EMPTY = { name: "", description: "", price: 50, cardCount: 3, generation: "", rarityBoost: false };

export function PackManager({ packs }: { packs: Pack[] }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createStickerPack({
          name: form.name,
          description: form.description || undefined,
          price: form.price,
          cardCount: form.cardCount,
          generation: form.generation ? parseInt(form.generation) : null,
          rarityBoost: form.rarityBoost
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Pacote criado!");
        setForm(EMPTY);
        setShowForm(false);
      } catch { toast.error("Erro ao criar pacote."); }
    });
  };

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      try {
        await toggleStickerPack(id, !active);
        toast.success(active ? "Pacote desativado." : "Pacote ativado.");
      } catch { toast.error("Erro."); }
    });
  };

  return (
    <div className="space-y-4">
      <Button type="button" size="sm" onClick={() => setShowForm(!showForm)}
        className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
        <Plus size={14} /> Novo pacote
      </Button>

      {showForm && (
        <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: "name", label: "Nome", type: "text" },
            { key: "description", label: "Descrição", type: "text" },
            { key: "price", label: "Preço (ZC)", type: "number" },
            { key: "cardCount", label: "Cartas por pacote", type: "number" },
            { key: "generation", label: "Geração (vazio = todas)", type: "number" }
          ].map(({ key, label, type }) => (
            <label key={key} className="space-y-1 text-xs text-slate-400">
              <span>{label}</span>
              <input type={type} value={(form as Record<string, unknown>)[key] as string}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            </label>
          ))}
          <label className="flex items-center gap-2 text-xs text-slate-400 self-end pb-2">
            <input type="checkbox" checked={form.rarityBoost} onChange={(e) => setForm({ ...form, rarityBoost: e.target.checked })}
              className="accent-[#FFCB05]" />
            Boost de raridade
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="button" disabled={!form.name || pending} onClick={handleCreate}
              className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">Criar</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {packs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-900/80 text-left text-xs uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cartas</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Geração</th>
                <th className="px-4 py-3">Boost</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-slate-950/60">
              {packs.map((p) => (
                <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-slate-200">{p.name}</td>
                  <td className="px-4 py-3 text-slate-400">{p.cardCount}</td>
                  <td className="px-4 py-3 font-semibold text-[#FFCB05]">{p.price} ZC</td>
                  <td className="px-4 py-3 text-slate-400">{p.generation ?? "Todas"}</td>
                  <td className="px-4 py-3 text-slate-400">{p.rarityBoost ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" disabled={pending} onClick={() => handleToggle(p.id, p.active)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ml-auto text-slate-400 hover:text-slate-200">
                      {p.active ? <><EyeOff size={13} /> Desativar</> : <><Eye size={13} /> Ativar</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
