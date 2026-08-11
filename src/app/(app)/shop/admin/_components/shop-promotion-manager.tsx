"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Eye, EyeOff, Percent, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createShopPromotion, deleteShopPromotion, toggleShopPromotion } from "../../actions";

type PromotionItem = { id: string; name: string; type: string; price: number };
type Promotion = {
  id: string;
  name: string;
  scope: "GLOBAL" | "ITEM";
  itemId: string | null;
  discountPct: number;
  startsAt: Date | string;
  endsAt: Date | string;
  active: boolean;
  item: { name: string } | null;
};

function localDateTimeValue(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function initialForm() {
  const startsAt = new Date();
  startsAt.setMinutes(Math.ceil(startsAt.getMinutes() / 5) * 5, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60_000);
  return {
    name: "",
    scope: "GLOBAL" as "GLOBAL" | "ITEM",
    itemId: "",
    discountPct: 10,
    startsAt: localDateTimeValue(startsAt),
    endsAt: localDateTimeValue(endsAt),
  };
}

function promotionStatus(promotion: Promotion) {
  const now = Date.now();
  const startsAt = new Date(promotion.startsAt).getTime();
  const endsAt = new Date(promotion.endsAt).getTime();
  if (!promotion.active) return { label: "Desativada", className: "text-slate-500" };
  if (now < startsAt) return { label: "Agendada", className: "text-cyan-300" };
  if (now >= endsAt) return { label: "Encerrada", className: "text-red-300" };
  return { label: "Ativa agora", className: "text-emerald-300" };
}

export function ShopPromotionManager({ items, promotions }: { items: PromotionItem[]; promotions: Promotion[] }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [itemSearch, setItemSearch] = useState("");
  const filteredItems = items.filter((item) =>
    !itemSearch.trim() || item.name.toLocaleLowerCase("pt-BR").includes(itemSearch.trim().toLocaleLowerCase("pt-BR")),
  );

  const handleCreate = () => startTransition(async () => {
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (!form.name.trim()) { toast.error("Informe um nome para a promoção."); return; }
    if (form.scope === "ITEM" && !form.itemId) { toast.error("Escolha o item da promoção."); return; }
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) { toast.error("Informe datas válidas."); return; }
    const result = await createShopPromotion({
      name: form.name,
      scope: form.scope,
      itemId: form.scope === "ITEM" ? form.itemId : null,
      discountPct: form.discountPct,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success("Promoção programada.");
    setForm(initialForm());
    setShowForm(false);
  });

  const handleToggle = (promotion: Promotion) => startTransition(async () => {
    const result = await toggleShopPromotion(promotion.id, !promotion.active);
    if (result.error) toast.error(result.error);
    else toast.success(promotion.active ? "Promoção desativada." : "Promoção ativada.");
  });

  const handleDelete = (promotion: Promotion) => {
    if (!confirm(`Excluir a promoção "${promotion.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteShopPromotion(promotion.id);
      if (result.error) toast.error(result.error);
      else toast.success("Promoção excluída.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Percent size={17} className="text-emerald-300" />
            <h2 className="font-semibold text-slate-100">Promoções da ZikaShop</h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Programe descontos na loja inteira ou em um item. Promoções simultâneas não acumulam: o jogador sempre recebe o maior desconto aplicável.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setShowForm((value) => !value)} className="gap-1 bg-emerald-400 text-slate-950 hover:bg-emerald-300">
          <Plus size={14} /> Nova promoção
        </Button>
      </div>

      {showForm && (
        <div className="grid gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs text-slate-400">
            <span>Nome da promoção</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex: Semana do Enguiça"
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60" />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Aplicar em</span>
            <select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as "GLOBAL" | "ITEM", itemId: "" })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60">
              <option value="GLOBAL">Toda a ZikaShop</option>
              <option value="ITEM">Um item específico</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Desconto</span>
            <div className="relative">
              <input type="number" min={1} max={99} value={form.discountPct} onChange={(event) => setForm({ ...form, discountPct: Math.min(99, Math.max(1, Number(event.target.value) || 1)) })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 pr-9 text-sm text-white outline-none focus:border-emerald-400/60" />
              <span className="absolute right-3 top-2 text-sm text-emerald-300">%</span>
            </div>
          </label>
          {form.scope === "ITEM" && (
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Filtrar itens pelo nome..."
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/60" />
              <select value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60">
                <option value="">Selecione o item</option>
                {filteredItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.price.toLocaleString("pt-BR")} ZC</option>)}
              </select>
            </div>
          )}
          <label className="space-y-1 text-xs text-slate-400">
            <span>Início</span>
            <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60" />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Fim</span>
            <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60" />
          </label>
          <div className="flex items-end gap-2">
            <Button type="button" disabled={pending} onClick={handleCreate} className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">Programar</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {promotions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-slate-500">Nenhuma promoção programada.</div>
      ) : (
        <div className="space-y-2">
          {promotions.map((promotion) => {
            const status = promotionStatus(promotion);
            return (
              <div key={promotion.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/60 p-3 ${promotion.active ? "" : "opacity-55"}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 font-black text-emerald-300">-{promotion.discountPct}%</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-100">{promotion.name}</p>
                    <p className="text-[10px] text-slate-500">{promotion.scope === "GLOBAL" ? "Toda a loja" : promotion.item?.name ?? "Item removido"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                      <CalendarClock size={10} />
                      {new Date(promotion.startsAt).toLocaleString("pt-BR")} até {new Date(promotion.endsAt).toLocaleString("pt-BR")}
                      <span className={`ml-1 font-bold ${status.className}`}>· {status.label}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={pending} onClick={() => handleToggle(promotion)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" title={promotion.active ? "Desativar" : "Ativar"}>
                    {promotion.active ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button type="button" disabled={pending} onClick={() => handleDelete(promotion)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
