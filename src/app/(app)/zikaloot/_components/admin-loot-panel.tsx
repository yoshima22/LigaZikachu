"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createZikaLoot, runDraw, cancelZikaLoot } from "../actions";

interface Loot {
  id: string; name: string; prize: string; status: string;
  drawAt: string; drawnNumber: number | null; winnerName: string | null; picksCount: number;
}

export function AdminLootPanel({ loots }: { loots: Loot[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", prize: "", drawAt: "" });

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createZikaLoot({
          name: form.name,
          description: form.description || undefined,
          prize: form.prize,
          drawAt: new Date(form.drawAt).toISOString()
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Loteria criada!"); setShowCreate(false);
        setForm({ name: "", description: "", prize: "", drawAt: "" });
      } catch { toast.error("Erro ao criar."); }
    });
  };

  const handleDraw = (id: string, name: string) => {
    if (!confirm(`Executar sorteio de "${name}" agora?`)) return;
    startTransition(async () => {
      try {
        const result = await runDraw(id);
        if (result.error) { toast.error(result.error); return; }
        if (result.winner) {
          toast.success(`Número ${result.drawnNumber} sorteado! Vencedor: ${result.winner} 🎉`);
        } else {
          toast.info(`Número ${result.drawnNumber} sorteado — ninguém escolheu este número.`);
        }
      } catch { toast.error("Erro ao sortear."); }
    });
  };

  const handleCancel = (id: string, name: string) => {
    if (!confirm(`Cancelar a loteria "${name}"? Os tickets serão devolvidos.`)) return;
    startTransition(async () => {
      try {
        const result = await cancelZikaLoot(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Loteria cancelada. Tickets devolvidos.");
      } catch { toast.error("Erro ao cancelar."); }
    });
  };

  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[#FFCB05]">Admin ZikaLoot</p>
        <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}
          className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
          <Plus size={14} /> Nova loteria
        </Button>
      </div>

      {showCreate && (
        <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 sm:grid-cols-2">
          {[
            { key: "name", label: "Nome", placeholder: "Ex: ZikaLoot Semana 4" },
            { key: "prize", label: "Prêmio", placeholder: "Ex: Pack Básico + 500 ZikaCoins" },
            { key: "description", label: "Descrição (opcional)", placeholder: "" }
          ].map(({ key, label, placeholder }) => (
            <label key={key} className="space-y-1 text-xs text-slate-400">
              <span>{label}</span>
              <input value={(form as Record<string, string>)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            </label>
          ))}
          <label className="space-y-1 text-xs text-slate-400">
            <span>Data/hora do sorteio</span>
            <input type="datetime-local" value={form.drawAt} onChange={(e) => setForm({ ...form, drawAt: e.target.value })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" disabled={!form.name || !form.prize || !form.drawAt || pending} onClick={handleCreate}
              className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">Criar</Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {loots.filter((l) => l.status === "SCHEDULED").map((l) => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/60 px-4 py-3">
          <div>
            <p className="font-medium text-slate-200">{l.name}</p>
            <p className="text-xs text-slate-500">{l.picksCount} números escolhidos · Sorteio: {new Date(l.drawAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => handleDraw(l.id, l.name)}
              className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60">
              Sortear agora
            </button>
            <button type="button" disabled={pending} onClick={() => handleCancel(l.id, l.name)}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-60">
              Cancelar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
