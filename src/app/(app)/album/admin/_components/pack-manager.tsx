"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createStickerPack, updateStickerPack, deleteStickerPack, toggleStickerPack } from "../actions";

interface Pack {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  cardCount: number;
  generation: number | null;
  rarityBoost: boolean;
  active: boolean;
}

type FormData = {
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  cardCount: number;
  generation: string;
  rarityBoost: boolean;
};

const EMPTY: FormData = { name: "", description: "", imageUrl: "", price: 50, cardCount: 3, generation: "", rarityBoost: false };

function packToForm(p: Pack): FormData {
  return {
    name: p.name,
    description: p.description ?? "",
    imageUrl: p.imageUrl ?? "",
    price: p.price,
    cardCount: p.cardCount,
    generation: p.generation?.toString() ?? "",
    rarityBoost: p.rarityBoost
  };
}

function PackForm({ form, setForm, onSave, onCancel, pending, label }: {
  form: FormData;
  setForm: (f: FormData) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {([
        { key: "name", label: "Nome", type: "text" },
        { key: "description", label: "Descrição", type: "text" },
        { key: "imageUrl", label: "URL da imagem (opcional)", type: "text" },
        { key: "price", label: "Preço (ZC)", type: "number" },
        { key: "cardCount", label: "Cartas por pacote", type: "number" },
        { key: "generation", label: "Geração (vazio = todas)", type: "number" }
      ] as const).map(({ key, label: l, type }) => (
        <label key={key} className="space-y-1 text-xs text-slate-400">
          <span>{l}</span>
          <input type={type} value={(form[key as keyof FormData] as string | number)}
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
        <Button type="button" disabled={!form.name || pending} onClick={onSave}
          className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">{label}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export function PackManager({ packs }: { packs: Pack[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormData>(EMPTY);

  const rawToData = (form: FormData) => ({
    name: form.name,
    description: form.description || undefined,
    imageUrl: form.imageUrl || undefined,
    price: Number(form.price),
    cardCount: Number(form.cardCount),
    generation: form.generation ? parseInt(form.generation) : null,
    rarityBoost: form.rarityBoost
  });

  const handleCreate = () => startTransition(async () => {
    try {
      const result = await createStickerPack(rawToData(createForm));
      if (result.error) { toast.error(result.error); return; }
      toast.success("Pacote criado!"); setCreateForm(EMPTY); setShowCreate(false);
    } catch { toast.error("Erro ao criar."); }
  });

  const handleUpdate = (id: string) => startTransition(async () => {
    try {
      const result = await updateStickerPack(id, rawToData(editForm));
      if (result.error) { toast.error(result.error); return; }
      toast.success("Pacote atualizado!"); setEditingId(null);
    } catch { toast.error("Erro ao atualizar."); }
  });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Deletar o pacote "${name}"? Isso não afeta pacotes já comprados.`)) return;
    startTransition(async () => {
      try {
        const result = await deleteStickerPack(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Pacote deletado.");
      } catch { toast.error("Erro ao deletar."); }
    });
  };

  const handleToggle = (id: string, active: boolean) => startTransition(async () => {
    try {
      await toggleStickerPack(id, !active);
      toast.success(active ? "Desativado." : "Ativado.");
    } catch { toast.error("Erro."); }
  });

  return (
    <div className="space-y-4">
      <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}
        className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
        <Plus size={14} /> Novo pacote
      </Button>

      {showCreate && (
        <PackForm form={createForm} setForm={setCreateForm}
          onSave={handleCreate} onCancel={() => setShowCreate(false)}
          pending={pending} label="Criar" />
      )}

      {packs.length > 0 && (
        <div className="space-y-2">
          {packs.map((p) => (
            <div key={p.id}>
              {editingId === p.id ? (
                <PackForm form={editForm} setForm={setEditForm}
                  onSave={() => handleUpdate(p.id)} onCancel={() => setEditingId(null)}
                  pending={pending} label="Salvar" />
              ) : (
                <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/60 px-4 py-3 ${p.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded object-contain bg-slate-800" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.cardCount} cartas · {p.price} ZC
                        {p.generation ? ` · Gen ${p.generation}` : " · Todas gens"}
                        {p.rarityBoost ? " · Boost" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" disabled={pending}
                      onClick={() => { setEditingId(p.id); setEditForm(packToForm(p)); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200"><Pencil size={14} /></button>
                    <button type="button" disabled={pending} onClick={() => handleToggle(p.id, p.active)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200">
                      {p.active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button type="button" disabled={pending} onClick={() => handleDelete(p.id, p.name)}
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
