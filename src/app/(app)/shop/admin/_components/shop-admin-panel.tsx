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
  metadata?: unknown;
}

type FrameMeta = { frameScale: number; frameOffsetX: number; frameOffsetY: number };
type FormData = {
  type: typeof typeOpts[number]; name: string; description: string;
  imageUrl: string; rarity: typeof rarityOpts[number]; price: number;
  frameMeta: FrameMeta;
};
const DEFAULT_FRAME_META: FrameMeta = { frameScale: 2.0, frameOffsetX: 0, frameOffsetY: 0 };
const EMPTY: FormData = { type: "TITLE", name: "", description: "", imageUrl: "", rarity: "COMMON", price: 100, frameMeta: DEFAULT_FRAME_META };
const itemToForm = (i: Item & { metadata?: unknown }): FormData => {
  const meta = i.metadata && typeof i.metadata === "object" && !Array.isArray(i.metadata)
    ? (i.metadata as Partial<FrameMeta>)
    : {};
  return {
    type: i.type as typeof typeOpts[number], name: i.name, description: i.description ?? "",
    imageUrl: i.imageUrl ?? "", rarity: i.rarity as typeof rarityOpts[number], price: i.price,
    frameMeta: {
      frameScale:   meta.frameScale   ?? 2.0,
      frameOffsetX: meta.frameOffsetX ?? 0,
      frameOffsetY: meta.frameOffsetY ?? 0,
    }
  };
};

// Preview interativo da moldura sobre um avatar placeholder
function FramePreview({ imageUrl, frameMeta }: { imageUrl: string; frameMeta: FrameMeta }) {
  const AVATAR = 96;
  const { frameScale, frameOffsetX, frameOffsetY } = frameMeta;
  const frameSize = AVATAR * frameScale;
  const frameLeft = (AVATAR - frameSize) / 2 + frameOffsetX;
  const frameTop  = (AVATAR - frameSize) / 2 + frameOffsetY;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-slate-500">Preview</p>
      <div
        className="relative bg-slate-800 rounded-2xl overflow-visible border border-slate-700"
        style={{ width: AVATAR, height: AVATAR, flexShrink: 0 }}
      >
        {/* Avatar placeholder */}
        <div className="h-full w-full rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        {/* Moldura sobreposta */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Moldura preview"
            className="pointer-events-none absolute z-10 object-contain"
            style={{ left: frameLeft, top: frameTop, width: frameSize, height: frameSize }}
          />
        )}
        {/* Grade de referência (centro do avatar) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
          <div className="h-px w-full bg-white" />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-px h-full bg-white" />
        </div>
      </div>
      <p className="text-[10px] text-slate-600">
        Escala: {frameScale.toFixed(1)}x · X: {frameOffsetX}px · Y: {frameOffsetY}px
      </p>
    </div>
  );
}

function FrameMetaEditor({ frameMeta, setFrameMeta, imageUrl }: {
  frameMeta: FrameMeta;
  setFrameMeta: (m: FrameMeta) => void;
  imageUrl: string;
}) {
  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-4 md:col-span-2 lg:col-span-3">
      <p className="text-xs font-semibold text-[#FFCB05]">⚙ Posicionamento da Moldura</p>
      <div className="flex gap-6 flex-wrap items-start">
        {/* Preview */}
        <FramePreview imageUrl={imageUrl} frameMeta={frameMeta} />
        {/* Sliders */}
        <div className="flex-1 min-w-[220px] space-y-4">
          <label className="block space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Escala (tamanho relativo ao avatar)</span>
              <span className="text-[#FFCB05] font-semibold">{frameMeta.frameScale.toFixed(2)}×</span>
            </div>
            <input type="range" min="0.5" max="4.0" step="0.05"
              value={frameMeta.frameScale}
              onChange={e => setFrameMeta({ ...frameMeta, frameScale: parseFloat(e.target.value) })}
              className="w-full accent-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">
              1.0 = mesmo tamanho · 2.0 = padrão (moldura 2× o avatar) · 3.0 = muito maior
            </p>
          </label>
          <label className="block space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Deslocamento horizontal (X)</span>
              <span className="text-slate-300 font-semibold">{frameMeta.frameOffsetX}px</span>
            </div>
            <input type="range" min="-80" max="80" step="1"
              value={frameMeta.frameOffsetX}
              onChange={e => setFrameMeta({ ...frameMeta, frameOffsetX: parseInt(e.target.value) })}
              className="w-full accent-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">Negativo = esquerda · Positivo = direita</p>
          </label>
          <label className="block space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Deslocamento vertical (Y)</span>
              <span className="text-slate-300 font-semibold">{frameMeta.frameOffsetY}px</span>
            </div>
            <input type="range" min="-80" max="80" step="1"
              value={frameMeta.frameOffsetY}
              onChange={e => setFrameMeta({ ...frameMeta, frameOffsetY: parseInt(e.target.value) })}
              className="w-full accent-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">Negativo = sobe (ótimo para chapéus) · Positivo = desce</p>
          </label>
          <button
            type="button"
            onClick={() => setFrameMeta(DEFAULT_FRAME_META)}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Resetar para padrão
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemForm({ form, setForm, onSave, onCancel, pending, label }: {
  form: FormData; setForm: (f: FormData) => void;
  onSave: () => void; onCancel: () => void; pending: boolean; label: string;
}) {
  const isFrame = (form.type as string) === "FRAME";
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
            : isFrame
            ? "Moldura: PNG com fundo transparente (recomendado 256×256px). Ajuste a posição abaixo."
            : (form.type as string) === "TITLE"
            ? "Título: sem imagem necessária — o nome do item já é exibido como texto."
            : (form.type as string) === "ZIKALOOT_TICKET"
            ? "Ticket: imagem decorativa, qualquer proporção (sugerido 256×256px)."
            : "Imagem opcional para o item."
        }
      />
      {/* Editor de posicionamento — apenas para molduras */}
      {isFrame && (
        <FrameMetaEditor
          imageUrl={form.imageUrl}
          frameMeta={form.frameMeta}
          setFrameMeta={(m) => setForm({ ...form, frameMeta: m })}
        />
      )}
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

  const buildPayload = (f: FormData) => ({
    ...f,
    imageUrl: f.imageUrl || undefined,
    description: f.description || undefined,
    // Inclui metadata de posicionamento apenas para molduras
    metadata: (f.type === "FRAME") ? f.frameMeta : undefined,
  });

  const handleCreate = () => startTransition(async () => {
    try {
      const result = await createShopItem(buildPayload(createForm));
      if (result.error) { toast.error(result.error); return; }
      toast.success("Item criado!"); setCreateForm(EMPTY); setShowCreate(false);
    } catch { toast.error("Erro ao criar item."); }
  });

  const handleUpdate = (id: string) => startTransition(async () => {
    try {
      const result = await updateShopItem(id, buildPayload(editForm));
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
