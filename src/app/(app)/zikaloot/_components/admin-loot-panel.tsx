"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createZikaLoot, runDraw, cancelZikaLoot, deleteZikaLoot, updateZikaLoot } from "../actions";
import type { PrizeItem } from "@/lib/zikaloot-types";

interface Loot {
  id: string; name: string; prize: string; description?: string | null; status: string;
  drawAt: string; drawnNumber: number | null; winnerName: string | null; picksCount: number;
  prizeConfig?: unknown;
}

const PRIZE_LABELS: Record<string, string> = {
  COINS: "ZikaCoins", STICKER: "Figurinha", TICKET: "Ticket ZikaLoot",
  COSMETIC: "Cosmético/Moldura", CUSTOM: "Mensagem personalizada"
};

function PrizeList({ prizes, onChange }: { prizes: PrizeItem[]; onChange: (p: PrizeItem[]) => void }) {
  const [type, setType] = useState<PrizeItem["type"]>("COINS");
  const [amount, setAmount] = useState(500);
  const [itemId, setItemId] = useState("");
  const [description, setDescription] = useState("");

  const addPrize = () => {
    let prize: PrizeItem;
    if (type === "COINS") prize = { type: "COINS", amount };
    else if (type === "STICKER") prize = { type: "STICKER", cardId: itemId, cardName: itemId };
    else if (type === "TICKET") prize = { type: "TICKET", itemId, itemName: "Ticket" };
    else if (type === "COSMETIC") prize = { type: "COSMETIC", itemId, itemName: itemId };
    else prize = { type: "CUSTOM", description };
    onChange([...prizes, prize]);
    setItemId(""); setDescription(""); setAmount(500);
  };

  const removePrize = (i: number) => onChange(prizes.filter((_, idx) => idx !== i));

  const prizeLabel = (p: PrizeItem) => {
    if (p.type === "COINS") return `${p.amount} ZikaCoins`;
    if (p.type === "STICKER") return `Figurinha: ${p.cardName}`;
    if (p.type === "TICKET") return `Ticket: ${p.itemId}`;
    if (p.type === "COSMETIC") return `Cosmético: ${p.itemName}`;
    return `Mensagem: ${p.description}`;
  };

  return (
    <div className="sm:col-span-2 space-y-3">
      <p className="text-xs text-slate-400 font-semibold">Prêmios (pode adicionar múltiplos)</p>
      {prizes.map((p, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          <span>{prizeLabel(p)}</span>
          <button type="button" onClick={() => removePrize(i)} className="text-red-400 hover:text-red-300">
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={type} onChange={(e) => setType(e.target.value as PrizeItem["type"])}
          className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
          {Object.entries(PRIZE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {type === "COINS" && (
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Quantidade de ZikaCoins"
            className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
        )}
        {(type === "STICKER" || type === "TICKET" || type === "COSMETIC") && (
          <input value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder={type === "STICKER" ? "ID da carta (cuid)" : "ID do item (ShopItem)"}
            className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
        )}
        {type === "CUSTOM" && (
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da mensagem"
            className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
        )}
      </div>
      <button type="button" onClick={addPrize}
        className="flex items-center gap-1 rounded-lg border border-[#FFCB05]/30 px-3 py-1.5 text-xs text-[#FFCB05] hover:bg-[#FFCB05]/10">
        <Plus size={12} /> Adicionar prêmio
      </button>
    </div>
  );
}

export function AdminLootPanel({ loots }: { loots: Loot[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", prize: "", drawAt: "" });
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", prize: "", drawAt: "" });
  const [editPrizes, setEditPrizes] = useState<PrizeItem[]>([]);

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const prizeConfig = prizes.length > 0 ? { prizes } : undefined;
        const result = await createZikaLoot({
          name: form.name,
          description: form.description || undefined,
          prize: form.prize || (prizes.length > 0 ? prizes.map((p) => {
            if (p.type === "COINS") return `${p.amount} ZikaCoins`;
            if (p.type === "STICKER") return `Figurinha: ${p.cardName}`;
            if (p.type === "COSMETIC") return p.itemName;
            if (p.type === "CUSTOM") return p.description;
            return "Prêmio";
          }).join(" + ") : "Prêmio"),
          drawAt: new Date(form.drawAt).toISOString(),
          prizeConfig
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Loteria criada!"); setShowCreate(false);
        setForm({ name: "", description: "", prize: "", drawAt: "" }); setPrizes([]);
      } catch { toast.error("Erro ao criar."); }
    });
  };

  const openEdit = (l: Loot) => {
    setEditingId(l.id);
    const dt = new Date(l.drawAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setEditForm({ name: l.name, description: l.description ?? "", prize: l.prize, drawAt: local });
    const cfg = l.prizeConfig as { prizes?: PrizeItem[] } | null | undefined;
    setEditPrizes(cfg?.prizes ?? []);
  };

  const handleUpdate = () => {
    if (!editingId) return;
    startTransition(async () => {
      try {
        const prizeConfig = editPrizes.length > 0 ? { prizes: editPrizes } : undefined;
        const result = await updateZikaLoot(editingId, {
          name: editForm.name,
          description: editForm.description || undefined,
          prize: editForm.prize || (editPrizes.length > 0 ? editPrizes.map((p) => {
            if (p.type === "COINS") return `${p.amount} ZikaCoins`;
            if (p.type === "STICKER") return `Figurinha: ${p.cardName}`;
            if (p.type === "COSMETIC") return p.itemName;
            if (p.type === "CUSTOM") return p.description;
            return "Prêmio";
          }).join(" + ") : "Prêmio"),
          drawAt: new Date(editForm.drawAt).toISOString(),
          prizeConfig
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Loteria atualizada!"); setEditingId(null);
      } catch { toast.error("Erro ao atualizar."); }
    });
  };

  const handleDraw = (id: string, name: string) => {
    if (!confirm(`Executar sorteio de "${name}" agora?`)) return;
    startTransition(async () => {
      try {
        const result = await runDraw(id);
        if (result.error) { toast.error(result.error); return; }
        if (result.winner) toast.success(`Número ${result.drawnNumber} sorteado! Vencedor: ${result.winner} 🎉`);
        else toast.info(`Número ${result.drawnNumber} sorteado — ninguém tinha este número.`);
      } catch { toast.error("Erro ao sortear."); }
    });
  };

  const handleCancel = (id: string, name: string) => {
    if (!confirm(`Cancelar a loteria "${name}"? Os tickets serão devolvidos.`)) return;
    startTransition(async () => {
      try {
        const result = await cancelZikaLoot(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Loteria cancelada.");
      } catch { toast.error("Erro."); }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir permanentemente a loteria "${name}" do histórico?`)) return;
    startTransition(async () => {
      try {
        const result = await deleteZikaLoot(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Loteria excluída.");
      } catch { toast.error("Erro."); }
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
            { key: "prize", label: "Descrição resumida do prêmio", placeholder: "Ex: 500 ZikaCoins + Pack" },
            { key: "description", label: "Descrição extra (opcional)", placeholder: "" }
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
          <PrizeList prizes={prizes} onChange={setPrizes} />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" disabled={!form.name || !form.drawAt || pending} onClick={handleCreate}
              className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">Criar</Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {loots.filter((l) => l.status === "SCHEDULED").map((l) => (
        <div key={l.id} className="rounded-xl border border-border bg-slate-950/60 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-slate-200">{l.name}</p>
              <p className="text-xs text-slate-500">{l.picksCount} números · Sorteio: {new Date(l.drawAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => openEdit(l)}
                className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-60">
                <Pencil size={13} />
              </button>
              <button type="button" disabled={pending} onClick={() => handleDraw(l.id, l.name)}
                className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60">
                Sortear agora
              </button>
              <button type="button" disabled={pending} onClick={() => handleCancel(l.id, l.name)}
                className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" disabled={pending} onClick={() => handleDelete(l.id, l.name)}
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-60">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {/* Formulário de edição inline */}
          {editingId === l.id && (
            <div className="border-t border-border bg-slate-900/60 grid gap-3 p-4 sm:grid-cols-2">
              {[
                { key: "name", label: "Nome" },
                { key: "prize", label: "Descrição resumida do prêmio" },
                { key: "description", label: "Descrição extra (opcional)" }
              ].map(({ key, label }) => (
                <label key={key} className="space-y-1 text-xs text-slate-400">
                  <span>{label}</span>
                  <input value={(editForm as Record<string, string>)[key]}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
                </label>
              ))}
              <label className="space-y-1 text-xs text-slate-400">
                <span>Data/hora do sorteio</span>
                <input type="datetime-local" value={editForm.drawAt}
                  onChange={(e) => setEditForm({ ...editForm, drawAt: e.target.value })}
                  className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
              </label>
              <PrizeList prizes={editPrizes} onChange={setEditPrizes} />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" disabled={!editForm.name || !editForm.drawAt || pending} onClick={handleUpdate}
                  className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Histórico com botão de deletar */}
      {loots.filter((l) => l.status !== "SCHEDULED").length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Histórico</p>
          {loots.filter((l) => l.status !== "SCHEDULED").map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-300">{l.name}</p>
                <p className="text-xs text-slate-500">
                  {l.status} · {l.drawnNumber ? `#${l.drawnNumber}` : "—"}
                  {l.winnerName ? ` · 🏆 ${l.winnerName}` : ""}
                </p>
              </div>
              <button type="button" disabled={pending} onClick={() => handleDelete(l.id, l.name)}
                className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-60">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
