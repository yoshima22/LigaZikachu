"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createZikaLoot, runDraw, cancelZikaLoot, deleteZikaLoot, updateZikaLoot } from "../actions";
import type { PrizeItem, PrizeConfig } from "@/lib/zikaloot-types";

interface Loot {
  id: string; name: string; prize: string; description?: string | null; status: string;
  drawAt: string; drawnNumber: number | null; winnerName: string | null; picksCount: number;
  prizeConfig?: unknown;
}

const PRIZE_LABELS: Record<string, string> = {
  COINS: "ZikaCoins", STICKER: "Figurinha", TICKET: "Ticket ZikaLoot",
  COSMETIC: "Cosmético/Moldura", CUSTOM: "Mensagem personalizada",
  EGG: "Ovo de Mascote", FOOD: "Comida de Mascote", SWEET: "Doce de Mascote",
  SHOP_ITEM: "Item da ZikaShop (por nome)", STICKER_PACK: "Pacote de Figurinhas"
};

const EGG_TYPES = ["COMMON", "RARE", "SPECIAL", "EVENT", "EGG_GEN1", "EGG_GEN2"];
const EGG_LABELS: Record<string, string> = {
  COMMON: "Comum", RARE: "Raro", SPECIAL: "Especial", EVENT: "Evento", EGG_GEN1: "Geração 1", EGG_GEN2: "Geração 2"
};

function PrizeList({ prizes, onChange }: { prizes: PrizeItem[]; onChange: (p: PrizeItem[]) => void }) {
  const [type, setType] = useState<PrizeItem["type"]>("COINS");
  const [amount, setAmount] = useState(500);
  const [itemId, setItemId] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState(1);
  const [eggType, setEggType] = useState("COMMON");
  const [shopItemName, setShopItemName] = useState("");
  const [packName, setPackName] = useState("Pacote Comum");

  const addPrize = () => {
    let prize: PrizeItem;
    if (type === "COINS") prize = { type: "COINS", amount };
    else if (type === "STICKER") prize = { type: "STICKER", cardId: itemId, cardName: itemId };
    else if (type === "TICKET") prize = { type: "TICKET", itemId, itemName: "Ticket" };
    else if (type === "COSMETIC") prize = { type: "COSMETIC", itemId, itemName: itemId };
    else if (type === "EGG") prize = { type: "EGG", eggType, qty };
    else if (type === "FOOD") prize = { type: "FOOD", qty };
    else if (type === "SWEET") prize = { type: "SWEET", qty };
    else if (type === "SHOP_ITEM") prize = { type: "SHOP_ITEM", shopItemName, qty };
    else if (type === "STICKER_PACK") prize = { type: "STICKER_PACK", packName };
    else prize = { type: "CUSTOM", description };
    onChange([...prizes, prize]);
    setItemId(""); setDescription(""); setAmount(500); setQty(1); setShopItemName("");
  };

  const removePrize = (i: number) => onChange(prizes.filter((_, idx) => idx !== i));

  const prizeLabel = (p: PrizeItem) => {
    if (p.type === "COINS") return `🪙 ${p.amount} ZikaCoins`;
    if (p.type === "STICKER") return `🃏 Figurinha: ${p.cardName}`;
    if (p.type === "TICKET") return `🎟️ Ticket: ${p.itemId}`;
    if (p.type === "COSMETIC") return `🎨 Cosmético: ${p.itemName}`;
    if (p.type === "EGG") return `🥚 Ovo ${EGG_LABELS[p.eggType] ?? p.eggType}${p.qty && p.qty > 1 ? ` x${p.qty}` : ""}`;
    if (p.type === "FOOD") return `🍖 Comida x${p.qty}`;
    if (p.type === "SWEET") return `🍬 Doce x${p.qty}`;
    if (p.type === "SHOP_ITEM") return `🛒 ${p.shopItemName}${p.qty && p.qty > 1 ? ` x${p.qty}` : ""}`;
    if (p.type === "STICKER_PACK") return `📦 ${p.packName}`;
    return `💬 ${(p as { type: "CUSTOM"; description: string }).description}`;
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
        {type === "EGG" && (
          <div className="flex gap-2">
            <select value={eggType} onChange={(e) => setEggType(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
              {EGG_TYPES.map(t => <option key={t} value={t}>{EGG_LABELS[t]}</option>)}
            </select>
            <input type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Qtd"
              className="w-16 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          </div>
        )}
        {(type === "FOOD" || type === "SWEET") && (
          <input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Quantidade"
            className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
        )}
        {type === "SHOP_ITEM" && (
          <div className="flex gap-2">
            <input value={shopItemName} onChange={(e) => setShopItemName(e.target.value)} placeholder="Nome do item no shop"
              className="flex-1 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            <input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Qtd"
              className="w-16 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          </div>
        )}
        {type === "STICKER_PACK" && (
          <input value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="Nome do pacote"
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

// Converte datetime-local (sem timezone) para ISO UTC tratando como horário de Brasília (UTC-3)
function localBRToUTC(localStr: string): string {
  if (!localStr) return "";
  // Adiciona o offset -03:00 explicitamente para que o Date saiba que é horário de Brasília
  return new Date(`${localStr}:00-03:00`).toISOString();
}

// Converte um Date UTC para o formato datetime-local no horário de Brasília
function utcToLocalBR(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  const h = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${h}:${p.minute}`;
}

export function AdminLootPanel({ loots }: { loots: Loot[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", prize: "", drawAt: "", maxPicks: 200 });
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", prize: "", drawAt: "", maxPicks: 200 });
  const [editPrizes, setEditPrizes] = useState<PrizeItem[]>([]);

  const prizeSummary = (prizes: PrizeItem[]) => prizes.map((p) => {
    if (p.type === "COINS") return `${p.amount} ZikaCoins`;
    if (p.type === "STICKER") return `Figurinha: ${p.cardName}`;
    if (p.type === "COSMETIC") return p.itemName;
    if (p.type === "EGG") return `Ovo ${p.eggType}`;
    if (p.type === "FOOD") return `${p.qty}x Comida`;
    if (p.type === "SWEET") return `${p.qty}x Doce`;
    if (p.type === "SHOP_ITEM") return p.shopItemName;
    if (p.type === "STICKER_PACK") return p.packName;
    if (p.type === "CUSTOM") return p.description;
    return "Prêmio";
  }).join(" + ");

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const prizeConfig: PrizeConfig = { prizes, maxPicks: form.maxPicks };
        const result = await createZikaLoot({
          name: form.name,
          description: form.description || undefined,
          prize: form.prize || (prizes.length > 0 ? prizeSummary(prizes) : "Prêmio"),
          drawAt: localBRToUTC(form.drawAt),
          prizeConfig
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Loteria criada!"); setShowCreate(false);
        setForm({ name: "", description: "", prize: "", drawAt: "", maxPicks: 200 }); setPrizes([]);
      } catch { toast.error("Erro ao criar."); }
    });
  };

  const openEdit = (l: Loot) => {
    setEditingId(l.id);
    const local = utcToLocalBR(new Date(l.drawAt));
    const cfg = l.prizeConfig as PrizeConfig | null | undefined;
    setEditForm({ name: l.name, description: l.description ?? "", prize: l.prize, drawAt: local, maxPicks: cfg?.maxPicks ?? 200 });
    setEditPrizes(cfg?.prizes ?? []);
  };

  const handleUpdate = () => {
    if (!editingId) return;
    startTransition(async () => {
      try {
        const prizeConfig: PrizeConfig = { prizes: editPrizes, maxPicks: editForm.maxPicks };
        const result = await updateZikaLoot(editingId, {
          name: editForm.name,
          description: editForm.description || undefined,
          prize: editForm.prize || (editPrizes.length > 0 ? prizeSummary(editPrizes) : "Prêmio"),
          drawAt: localBRToUTC(editForm.drawAt),
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
              <input value={(form as Record<string, string | number>)[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            </label>
          ))}
          <label className="space-y-1 text-xs text-slate-400">
            <span>Data/hora do sorteio</span>
            <input type="datetime-local" value={form.drawAt} onChange={(e) => setForm({ ...form, drawAt: e.target.value })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Máximo de tickets (números)</span>
            <input type="number" min={10} max={1000} value={form.maxPicks} onChange={(e) => setForm({ ...form, maxPicks: Number(e.target.value) })}
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

      {loots.filter((l) => l.status === "SCHEDULED").map((l) => {
        const cfg = l.prizeConfig as PrizeConfig | null | undefined;
        const maxPicks = cfg?.maxPicks ?? 200;
        return (
          <div key={l.id} className="rounded-xl border border-border bg-slate-950/60 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-200">{l.name}</p>
                <p className="text-xs text-slate-500">{l.picksCount}/{maxPicks} números · Sorteio: {new Date(l.drawAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
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
            {editingId === l.id && (
              <div className="border-t border-border bg-slate-900/60 grid gap-3 p-4 sm:grid-cols-2">
                {[
                  { key: "name", label: "Nome" },
                  { key: "prize", label: "Descrição resumida do prêmio" },
                  { key: "description", label: "Descrição extra (opcional)" }
                ].map(({ key, label }) => (
                  <label key={key} className="space-y-1 text-xs text-slate-400">
                    <span>{label}</span>
                    <input value={(editForm as Record<string, string | number>)[key] as string}
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
                <label className="space-y-1 text-xs text-slate-400">
                  <span>Máximo de tickets (números)</span>
                  <input type="number" min={10} max={1000} value={editForm.maxPicks}
                    onChange={(e) => setEditForm({ ...editForm, maxPicks: Number(e.target.value) })}
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
        );
      })}

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
