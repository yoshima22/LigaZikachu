"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { createShopItem, updateShopItem, deleteShopItem, toggleShopItem } from "../../actions";

const rarityOpts = ["COMMON","UNCOMMON","RARE","EPIC","LEGENDARY"] as const;
const typeOpts = ["TITLE","BANNER","FRAME","ZIKALOOT_TICKET"] as const;
const typeLabel: Record<string, string> = {
  TITLE: "Título", BANNER: "Banner", FRAME: "Moldura", ZIKALOOT_TICKET: "Ticket ZikaLoot"
};
const rarityLabel: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Rara", EPIC: "Épica", LEGENDARY: "Lendária"
};

interface Item {
  id: string; type: string; name: string; description: string | null;
  imageUrl: string | null; rarity: string; price: number; active: boolean; owners: number;
}

type FormData = { type: typeof typeOpts[number]; name: string; description: string; imageUrl: string; rarity: typeof rarityOpts[number]; price: number };
const EMPTY: FormData = { type: "TITLE", name: "", description: "", imageUrl: "", rarity: "COMMON", price: 100 };
const itemToForm = (i: Item): FormData => ({
  type: i.type as typeof typeOpts[number], name: i.name, description: i.description ?? "",
  imageUrl: i.imageUrl ?? "", rarity: i.rarity as typeof rarityOpts[number], price: i.price
});

function ItemForm({ form, setForm, onSave, onCancel, pending, label }: {
  form: FormData; setForm: (f: FormData) => void;
  onSave: () => void; onCancel: () => void; pending: boolean; label: string;
}) {
  const isBanner = (form.type as string) === "BANNER";
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 md:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-xs text-slate-400">
        <span>Tipo</span>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof typeOpts[number] })}
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
        <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value as typeof rarityOpts[number] })}
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
          {rarityOpts.map((r) => <option key={r} value={r}>{rarityLabel[r]}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Descrição</span>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrição opcional"
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <ImageUpload
        value={form.imageUrl}
        onChange={(url) => setForm({ ...form, imageUrl: url })}
        label="Imagem"
        maxMb={(form.type as string) === "BANNER" ? 6 : 2}
        hint={
          (form.type as string) === "BANNER"
            ? "Banner: 1200×300px (proporção 4:1). Imagens fora dessa proporção serão cortadas."
            : (form.type as string) === "FRAME"
            ? "Moldura: PNG 128×128px com fundo transparente. Centro transparente (~72×72px) onde fica o avatar."
            : (form.type as string) === "TITLE"
            ? "Título: sem imagem necessária — o nome do item já é exibido como texto."
            : (form.type as string) === "ZIKALOOT_TICKET"
            ? "Ticket: imagem decorativa, qualquer proporção (sugerido 256×256px)."
            : "Imagem opcional para o item."
        }
      />
      <div className="flex gap-2 md:col-span-2 lg:col-span-3">
        <Button type="button" disabled={!form.name || pending} onClick={onSave}
          className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">{label}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export function ShopAdminPanel({ items }: { items: Item[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormData>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormData>(EMPTY);

  const handleCreate = () => startTransition(async () => {
    try {
      const result = await createShopItem({ ...createForm, imageUrl: createForm.imageUrl || undefined, description: createForm.description || undefined });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Item criado!"); setCreateForm(EMPTY); setShowCreate(false);
    } catch { toast.error("Erro ao criar item."); }
  });

  const handleUpdate = (id: string) => startTransition(async () => {
    try {
      const result = await updateShopItem(id, { ...editForm, imageUrl: editForm.imageUrl || undefined, description: editForm.description || undefined });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Item atualizado!"); setEditingId(null);
    } catch { toast.error("Erro ao atualizar item."); }
  });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Jogadores que já possuem o item manterão no inventário.`)) return;
    startTransition(async () => {
      try {
        const result = await deleteShopItem(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Item excluído.");
      } catch { toast.error("Erro ao excluir."); }
    });
  };

  const handleToggle = (id: string, active: boolean) => startTransition(async () => {
    try {
      const result = await toggleShopItem(id, !active);
      if (result.error) { toast.error(result.error); return; }
      toast.success(active ? "Item desativado." : "Item ativado.");
    } catch { toast.error("Erro."); }
  });

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}
          className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
          <Plus size={14} /> Novo item
        </Button>
        {showCreate && (
          <div className="mt-4">
            <ItemForm form={createForm} setForm={setCreateForm}
              onSave={handleCreate} onCancel={() => setShowCreate(false)}
              pending={pending} label="Criar" />
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              {editingId === item.id ? (
                <div className="mt-2">
                  <ItemForm form={editForm} setForm={setEditForm}
                    onSave={() => handleUpdate(item.id)} onCancel={() => setEditingId(null)}
                    pending={pending} label="Salvar" />
                </div>
              ) : (
                <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/60 px-4 py-3 ${item.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {item.imageUrl && !item.imageUrl.startsWith("data:") && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="h-10 w-16 rounded object-cover bg-slate-800" />
                    )}
                    <div>
                      <p className="font-medium text-slate-200">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {typeLabel[item.type]} · {rarityLabel[item.rarity]} · {item.price.toLocaleString("pt-BR")} ZC · {item.owners} donos
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" disabled={pending}
                      onClick={() => { setEditingId(item.id); setEditForm(itemToForm(item)); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200"><Pencil size={14} /></button>
                    <button type="button" disabled={pending} onClick={() => handleToggle(item.id, item.active)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200">
                      {item.active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button type="button" disabled={pending} onClick={() => handleDelete(item.id, item.name)}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
