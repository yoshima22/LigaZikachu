"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import Link from "next/link";
import { adminSetMiauvadaoOffers, adminUpdateListingFee, getMiauvadaoConfig, adminAdjustVault, adminRefreshMiauvadaoShopNow, adminCleanupStaleBazarListings } from "../actions";
import type { MiauvadaoOffer } from "../actions";
import { MEGA_STONES, isMegaStoneType } from "@/lib/mega-evolution";

const ITEM_TYPES = [
  { value: "EGG_COMMON",     label: "🥚 Ovo Comum" },
  { value: "EGG_RARE",       label: "💙 Ovo Raro" },
  { value: "EGG_SPECIAL",    label: "💜 Ovo Especial" },
  { value: "EGG_LAB",        label: "Ovo de Laboratorio" },
  { value: "EGG_EVENT",      label: "Ovo de Evento" },
  { value: "MASCOT_FOOD",    label: "🍖 Comida" },
  { value: "MASCOT_SWEET",   label: "🍬 Doce" },
  { value: "MASCOT_BUFF_EXP", label: "⚡ Vitamina Elétrica" },
  { value: "MASCOT_BUFF_STAT", label: "💊 Proteína Zika" },
  { value: "MASCOT_BUFF_HAPPY", label: "🍯 Bala de Mel" },
  { value: "MASCOT_BUFF_LUCK", label: "🍀 Amuleto da Sorte" },
  { value: "MASCOT_BUFF_MOOD", label: "💧 Água Sagrada" },
  ...MEGA_STONES.map((stone) => ({
    value: stone.type,
    label: `Mega: ${stone.stoneName} (${stone.compatiblePokemonName})`,
  })),
];

const emptyOffer = (): Partial<MiauvadaoOffer> => ({
  itemType: "EGG_COMMON",
  name: "",
  originalPrice: 1200,
  discountPct: 20,
  finalPrice: 960,
  stock: 5,
  sold: 0,
});

export default function MiauvadaoAdminPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [offers, setOffers] = useState<Partial<MiauvadaoOffer>[]>([emptyOffer(), emptyOffer(), emptyOffer()]);
  const [fee, setFee] = useState("10");
  const [vaultBalance, setVaultBalance] = useState(0);
  const [vaultAdjust, setVaultAdjust] = useState("");

  useEffect(() => {
    getMiauvadaoConfig().then(c => {
      setFee(String(c.listingFee));
      setVaultBalance(c.vaultBalance);
      const existing = (c.dailyOffers as unknown as MiauvadaoOffer[]) ?? [];
      if (existing.length > 0) {
        setOffers([
          existing[0] ?? emptyOffer(),
          existing[1] ?? emptyOffer(),
          existing[2] ?? emptyOffer(),
        ]);
      }
    });
  }, []);

  const updateOffer = (idx: number, field: keyof MiauvadaoOffer, value: unknown) => {
    setOffers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-calc finalPrice when discount or originalPrice changes
      if (field === "discountPct" || field === "originalPrice" || field === "itemType") {
        const orig = field === "originalPrice" ? Number(value) : (next[idx].originalPrice ?? 0);
        const rawDisc = field === "discountPct" ? Number(value) : (next[idx].discountPct ?? 0);
        const maxDiscount = isMegaStoneType(String(next[idx].itemType ?? "")) ? 20 : 90;
        const disc = Math.min(maxDiscount, Math.max(0, rawDisc));
        next[idx].discountPct = disc;
        next[idx].finalPrice = Math.round(orig * (1 - disc / 100));
      }
      return next;
    });
  };

  const handleSaveOffers = () => {
    const validated = offers.map(o => ({
      itemType: o.itemType ?? "EGG_COMMON",
      name: o.name ?? "",
      originalPrice: o.originalPrice ?? 0,
      discountPct: o.discountPct ?? 0,
      finalPrice: o.finalPrice ?? 0,
      stock: o.stock ?? 1,
      sold: 0,
      validUntil: new Date(Date.now() + 24 * 3600000).toISOString(),
    } as MiauvadaoOffer));

    startTransition(async () => {
      const r = await adminSetMiauvadaoOffers(validated);
      if (r.error) toast.error(r.error);
      else { toast.success("Ofertas do Miauvadão atualizadas!"); router.refresh(); }
    });
  };

  const handleSaveFee = () => {
    startTransition(async () => {
      const r = await adminUpdateListingFee(parseInt(fee) || 10);
      if (r.error) toast.error(r.error);
      else toast.success("Taxa atualizada!");
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/bazar" className="rounded-lg border border-border p-2 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={16}/>
        </Link>
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05]">Admin — Miauvadão</h1>
          <p className="text-xs text-slate-500">Configure as ofertas diárias e a taxa do Bazar.</p>
        </div>
      </div>

      {/* Vault + Fee */}
      <div className="rounded-2xl border border-border bg-slate-950/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">Cofre do Miauvadão</p>
            <p className="text-2xl font-bold text-[#FFCB05]">{vaultBalance.toLocaleString("pt-BR")} ZC</p>
            <p className="text-xs text-slate-500">Acumulado das taxas de anúncio</p>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-400">Taxa por anúncio (ZC)</label>
            <input type="number" min={0} value={fee} onChange={e => setFee(e.target.value)}
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60" />
          </div>
          <button type="button" disabled={pending} onClick={handleSaveFee}
            className="flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
            <Save size={12}/> Salvar taxa
          </button>
        </div>
      </div>

      {/* Vault management */}
      <div className="rounded-2xl border border-border bg-slate-950/60 p-5 space-y-4">
        {/* Limpeza de anúncios com itens inexistentes */}
        <div className="rounded-2xl border border-red-500/20 bg-slate-950/60 p-5 space-y-3 mb-4">
          <h2 className="font-semibold text-slate-200">🧹 Limpar Anúncios Inválidos</h2>
          <p className="text-xs text-slate-500">
            Remove anúncios ACTIVE onde o item em escrow já foi usado/consumido (como o caso do ovo do Cristian).
          </p>
          <button type="button" disabled={pending}
            onClick={() => startTransition(async () => {
              const r = await adminCleanupStaleBazarListings();
              if (r.error) { toast.error(r.error); return; }
              toast.success(`Limpeza concluída: ${r.cancelled} anúncio(s) cancelado(s).`);
              if (r.details.length > 0) console.log("Anúncios cancelados:", r.details);
              router.refresh();
            })}
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50">
            <Trash2 size={14}/> Limpar anúncios com itens inválidos
          </button>
        </div>

        <h2 className="font-semibold text-slate-200">💰 Gerenciar Cofre do Miauvadão</h2>
        <p className="text-xs text-slate-500">Saldo atual: <strong className="text-[#FFCB05]">{vaultBalance.toLocaleString("pt-BR")} ZC</strong></p>
        <div className="flex gap-3 flex-wrap">
          <input type="number" placeholder="Valor a adicionar (+) ou remover (-)"
            value={vaultAdjust} onChange={e => setVaultAdjust(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60" />
          <button type="button" disabled={pending}
            onClick={() => startTransition(async () => {
              const amount = parseInt(vaultAdjust);
              if (!amount) return;
              const r = await adminAdjustVault(amount);
              if (r.error) toast.error(r.error);
              else { toast.success(`Cofre ajustado: ${r.newBalance?.toLocaleString("pt-BR")} ZC`); setVaultAdjust(""); router.refresh(); }
            })}
            className="flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
            <Save size={14}/> Ajustar cofre
          </button>
        </div>
      </div>

      {/* Daily Offers */}
      <div className="rounded-2xl border border-border bg-slate-950/60 p-5 space-y-4">
        <h2 className="font-semibold text-slate-200">3 Ofertas Diárias</h2>
        <div className="space-y-4">
          {offers.map((offer, idx) => (
            <div key={idx} className="rounded-xl border border-border/50 bg-slate-900/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400">Slot {idx + 1}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Item</label>
                  <select value={offer.itemType ?? "EGG_COMMON"}
                    onChange={e => {
                      const t = ITEM_TYPES.find(o => o.value === e.target.value);
                      updateOffer(idx, "itemType", e.target.value);
                      if (t) updateOffer(idx, "name", t.label.replace(/^\S+\s/, ""));
                    }}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none">
                    {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Nome exibido</label>
                  <input value={offer.name ?? ""} onChange={e => updateOffer(idx, "name", e.target.value)}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Preço original (ZC)</label>
                  <input type="number" min={1} value={offer.originalPrice ?? ""}
                    onChange={e => updateOffer(idx, "originalPrice", parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Desconto (%)</label>
                  <input type="number" min={1} max={isMegaStoneType(String(offer.itemType ?? "")) ? 20 : 90} value={offer.discountPct ?? ""}
                    onChange={e => updateOffer(idx, "discountPct", parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Preço final (ZC)</label>
                  <input type="number" min={1} value={offer.finalPrice ?? ""}
                    onChange={e => updateOffer(idx, "finalPrice", parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Estoque</label>
                  <input type="number" min={1} value={offer.stock ?? ""}
                    onChange={e => updateOffer(idx, "stock", parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button type="button" disabled={pending} onClick={handleSaveOffers}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
            <Save size={14}/> Publicar ofertas manuais
          </button>
          <button type="button" disabled={pending}
            onClick={() => startTransition(async () => {
              const r = await adminRefreshMiauvadaoShopNow();
              if (r.error) { toast.error(r.error); return; }
              toast.success("Ofertas geradas automaticamente do Shop!");
              router.refresh();
            })}
            title="Gera ofertas automaticamente a partir dos itens do shop"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-3 text-sm font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50">
            🔄 Gerar do Shop
          </button>
        </div>
      </div>
    </div>
  );
}
