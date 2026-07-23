"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, ShieldBan } from "lucide-react";
import Link from "next/link";
import { adminSetMiauvadaoOffers, adminUpdateListingFee, getMiauvadaoConfig, adminAdjustVault, adminRefreshMiauvadaoShopNow, adminCleanupStaleBazarListings, adminGetBazarTradeBanData, adminSetBazarTradeBan } from "../actions";
import type { MiauvadaoOffer, BazarTradeBanAdminData } from "../actions";
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
  const [tradeBanData, setTradeBanData] = useState<BazarTradeBanAdminData>({ players: [], bans: [] });
  const [banPlayerAId, setBanPlayerAId] = useState("");
  const [banPlayerBId, setBanPlayerBId] = useState("");
  const [banReason, setBanReason] = useState("");

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
    adminGetBazarTradeBanData().then(setTradeBanData).catch(() => toast.error("NÃ£o foi possÃ­vel carregar os bloqueios do Bazar."));
  }, []);

  const refreshTradeBans = async () => setTradeBanData(await adminGetBazarTradeBanData());

  const handleTradeBan = (playerAId: string, playerBId: string, active: boolean, reason?: string) => {
    startTransition(async () => {
      const result = await adminSetBazarTradeBan({ playerAId, playerBId, active, reason });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? "NegociaÃ§Ãµes bloqueadas." : "Bloqueio desativado.");
      if (active) {
        setBanPlayerAId("");
        setBanPlayerBId("");
        setBanReason("");
      }
      await refreshTradeBans();
    });
  };

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
      validUntil: new Date(Date.now() + 6 * 3600000).toISOString(),
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

      <div className="rounded-2xl border border-red-500/25 bg-slate-950/60 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldBan size={20} className="mt-0.5 text-red-400" />
          <div>
            <h2 className="font-semibold text-slate-200">Bloqueios de negociaÃ§Ã£o</h2>
            <p className="text-xs text-slate-500">Impede compras, propostas, trocas e disputas de leilÃ£o entre o par selecionado.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={banPlayerAId} onChange={(event) => setBanPlayerAId(event.target.value)}
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none">
            <option value="">Primeiro jogador</option>
            {tradeBanData.players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}
          </select>
          <select value={banPlayerBId} onChange={(event) => setBanPlayerBId(event.target.value)}
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none">
            <option value="">Segundo jogador</option>
            {tradeBanData.players.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input value={banReason} onChange={(event) => setBanReason(event.target.value)} placeholder="Motivo administrativo (opcional)"
            className="flex-1 rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none" />
          <button type="button" disabled={pending || !banPlayerAId || !banPlayerBId}
            onClick={() => handleTradeBan(banPlayerAId, banPlayerBId, true, banReason)}
            className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-400 disabled:opacity-50">
            Bloquear par
          </button>
        </div>
        <div className="space-y-2">
          {tradeBanData.bans.length === 0 && <p className="text-xs text-slate-600">Nenhum bloqueio cadastrado.</p>}
          {tradeBanData.bans.map((ban) => (
            <div key={ban.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">{ban.playerAName} <span className="text-slate-600">x</span> {ban.playerBName}</p>
                <p className="text-[10px] text-slate-500">{ban.reason || "Sem motivo informado"} · {ban.active ? "Ativo" : "Inativo"}</p>
              </div>
              <button type="button" disabled={pending}
                onClick={() => handleTradeBan(ban.playerAId, ban.playerBId, !ban.active, ban.reason ?? undefined)}
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${ban.active ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}>
                {ban.active ? "Desbloquear" : "Reativar"}
              </button>
            </div>
          ))}
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
