"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { createShopItem, toggleShopItem } from "../../actions";

const rarityOpts = ["COMMON","UNCOMMON","RARE","EPIC","LEGENDARY"] as const;
const typeOpts = ["TITLE","BANNER","FRAME"] as const;
const typeLabel: Record<string, string> = { TITLE: "Título", BANNER: "Banner", FRAME: "Moldura" };
const rarityLabel: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Rara", EPIC: "Épica", LEGENDARY: "Lendária"
};

interface Item {
  id: string;
  type: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: string;
  price: number;
  active: boolean;
  owners: number;
}

const EMPTY = {
  type: "TITLE" as const,
  name: "",
  description: "",
  imageUrl: "",
  rarity: "COMMON" as const,
  price: 100
};

export function ShopAdminPanel({ items }: { items: Item[] }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createShopItem({
          type: form.type,
          name: form.name,
          description: form.description || undefined,
          imageUrl: form.imageUrl || undefined,
          rarity: form.rarity,
          price: form.price
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Item criado!");
        setForm(EMPTY);
        setShowForm(false);
      } catch { toast.error("Erro ao criar item."); }
    });
  };

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      try {
        const result = await toggleShopItem(id, !active);
        if (result.error) { toast.error(result.error); return; }
        toast.success(active ? "Item desativado." : "Item ativado.");
      } catch { toast.error("Erro ao alterar item."); }
    });
  };

  return (
    <div className="space-y-6">
      {/* Criar item */}
      <div>
        <Button type="button" size="sm" onClick={() => setShowForm(!showForm)}
          className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
          <Plus size={14} /> Novo item
        </Button>
        {showForm && (
          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs text-slate-400">
              <span>Tipo</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
                {typeOpts.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Nome</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Mestre do Caos"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Preço (ZC)</span>
              <input type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Raridade</span>
              <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value as typeof form.rarity })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
                {rarityOpts.map((r) => <option key={r} value={r}>{rarityLabel[r]}</option>)}
              </select>
            </label>
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              label="Imagem (upload ou URL)"
              hint={(form.type as string) === "BANNER" ? "Proporção recomendada 3:1 — ex: 1500×500px" : undefined}
            />
            <label className="space-y-1 text-xs text-slate-400">
              <span>Descrição</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            </label>
            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-3">
              <Button type="button" disabled={!form.name || pending} onClick={handleCreate}
                className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                Criar item
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum item cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-900/80 text-left text-xs uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Raridade</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Donos</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-slate-950/60">
              {items.map((item) => (
                <tr key={item.id} className={item.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-slate-200">{item.name}</td>
                  <td className="px-4 py-3 text-slate-400">{typeLabel[item.type]}</td>
                  <td className="px-4 py-3 text-slate-400">{rarityLabel[item.rarity]}</td>
                  <td className="px-4 py-3 font-semibold text-[#FFCB05]">{item.price.toLocaleString("pt-BR")} ZC</td>
                  <td className="px-4 py-3 text-slate-400">{item.owners}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" disabled={pending} onClick={() => handleToggle(item.id, item.active)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ml-auto ${
                        item.active ? "text-slate-400 hover:text-red-400" : "text-[#7AC74C] hover:bg-[#7AC74C]/10"
                      }`}>
                      {item.active ? <><EyeOff size={13} /> Desativar</> : <><Eye size={13} /> Ativar</>}
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
