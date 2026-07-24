"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Coins, Info, Search } from "lucide-react";
import Link from "next/link";
import { createListing, createAuctionListing } from "../actions";
import { getSpriteUrl, getPokemonName } from "@/lib/mascot-data";
import { CONSUMABLE_SHOP_ITEM_TYPES, getShopItemEmoji } from "@/lib/shop-config";
import { Gavel } from "lucide-react";
import type { BazarItemCategory, BazarListingType } from "@prisma/client";

interface InventoryItem {
  inventoryId: string;
  shopItemId: string;
  type: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: string;
  shopPrice: number;
  quantity: number;
  equipped: boolean;
}

interface InventoryData {
  mascots: Array<{
    id: string; pokemonId: number; nickname: string | null; level: number;
    personality: string; isEquipped: boolean; bazarListed: boolean;
    arenaState: string;
    statForce: number; statAgility: number; statCharisma: number;
    statInstinct: number; statVitality: number; battleWins: number;
  }>;
  eggs: Array<{ id: string; type: string }>;
  foods: Array<{ type: string; quantity: number }>;
  inventoryItems: InventoryItem[];
  listingFee: number;
  balance: number;
}

// Tipos que podem ser listados no Bazar (excluindo cosméticos únicos de perfil que não são trocáveis)
const TRADEABLE_TYPES = new Set<string>(CONSUMABLE_SHOP_ITEM_TYPES);

const EGG_LABELS: Record<string, string> = {
  COMMON:"Ovo Comum",RARE:"Ovo Raro",SPECIAL:"Ovo Especial",EVENT:"Ovo de Evento",
  EGG_GEN1:"Ovo Gen 1",EGG_GEN2:"Ovo Gen 2",EGG_GEN3:"Ovo Gen 3",EGG_GEN4:"Ovo Gen 4",
  EGG_GEN5:"Ovo Gen 5",EGG_GEN6:"Ovo Gen 6",EGG_GEN7:"Ovo Gen 7",EGG_GEN8:"Ovo Gen 8",EGG_GEN9:"Ovo Gen 9",EGG_GEN6PLUS:"Ovo Gen 6+",
};
export default function CriarAnuncioPage() { return <CreateListingForm />; }

function CreateListingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<BazarItemCategory | "">("");
  const [listingType, setListingType] = useState<BazarListingType>("SALE");
  const [priceCoins, setPriceCoins] = useState("");
  const [loanEnabled, setLoanEnabled] = useState(false);
  const [loanAmountCoins, setLoanAmountCoins] = useState("");
  const [loanInterestPct, setLoanInterestPct] = useState("0");
  const [wantedDesc, setWantedDesc] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<7 | 14 | 30>(7);
  const [auctionDuration, setAuctionDuration] = useState<"12h" | "1d">("1d");
  const [minBid, setMinBid] = useState("");
  const [selectedMascotId, setSelectedMascotId] = useState("");
  const [selectedItem, setSelectedItem] = useState<{ type: string; shopItemId?: string; displayName: string; imageUrl?: string; maxQty: number } | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [mascotSearch, setMascotSearch] = useState("");
  const [mascotPage, setMascotPage] = useState(0);
  const [itemSearch, setItemSearch] = useState("");

  const loadInventory = async () => {
    if (inventory) return;
    setLoadingInventory(true);
    try {
      const res = await fetch("/api/bazar/inventory");
      if (res.ok) setInventory(await res.json());
    } catch { /* ignore */ }
    setLoadingInventory(false);
  };

  const isAuction = listingType === ("AUCTION" as BazarListingType);

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        if (isAuction) {
          const r = await createAuctionListing({
            category: category as BazarItemCategory,
            minBidCoins: parseInt(minBid) || 0,
            auctionDuration,
            description: description || undefined,
            mascotId: category === "MASCOT" ? selectedMascotId : undefined,
            itemType: category === "ITEM" ? selectedItem?.type : undefined,
            shopItemId: category === "ITEM" ? selectedItem?.shopItemId : undefined,
            imageUrl: category === "ITEM" ? selectedItem?.imageUrl : undefined,
            quantity: category === "ITEM" ? itemQuantity : undefined,
            displayName: category === "ITEM" ? selectedItem?.displayName : undefined,
          });
          if (r.error) { toast.error(r.error); return; }
        } else {
          const r = await createListing({
            category: category as BazarItemCategory,
            listingType,
            priceCoins: listingType !== "TRADE" && priceCoins ? parseInt(priceCoins) : undefined,
            loanEnabled,
            loanAmountCoins: loanEnabled ? parseInt(loanAmountCoins || priceCoins) : undefined,
            loanInterestPct: loanEnabled ? parseInt(loanInterestPct || "0") : undefined,
            wantedDesc: wantedDesc || undefined,
            description: description || undefined,
            durationDays: duration,
            mascotId: category === "MASCOT" ? selectedMascotId : undefined,
            itemType: category === "ITEM" ? selectedItem?.type : undefined,
            shopItemId: category === "ITEM" ? selectedItem?.shopItemId : undefined,
            imageUrl: category === "ITEM" ? selectedItem?.imageUrl : undefined,
            quantity: category === "ITEM" ? itemQuantity : undefined,
            displayName: category === "ITEM" ? selectedItem?.displayName : undefined,
          });
          if (r.error) { toast.error(r.error); return; }
        }
        toast.success("Anúncio criado com sucesso!");
        router.push("/bazar/meu-bazar");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro inesperado ao criar anúncio.");
      }
    });
  };

  const canProceed = () => {
    if (!category) return false;
    if (category === "MASCOT" && !selectedMascotId) return false;
    if (category === "ITEM" && (!selectedItem || itemQuantity < 1)) return false;
    if (isAuction) return !!minBid && parseInt(minBid) >= 1;
    if (listingType !== "TRADE" && (!priceCoins || parseInt(priceCoins) < 1)) return false;
    if (loanEnabled && parseInt(loanAmountCoins || priceCoins) < 1) return false;
    return true;
  };

  // Agrupa ovos por tipo
  const eggGroups = inventory ? Object.entries(
    inventory.eggs.reduce<Record<string, number>>((acc, e) => { acc[e.type] = (acc[e.type] ?? 0) + 1; return acc; }, {})
  ) : [];

  // Itens do inventário que são negociáveis
  const tradeableInventory = (inventory?.inventoryItems ?? []).filter(i => TRADEABLE_TYPES.has(i.type));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/bazar" className="rounded-lg border border-border p-2 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={16}/>
        </Link>
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05]">Novo Anúncio</h1>
          <p className="text-xs text-slate-500">Anuncie mascotes ou itens para vender ou trocar.</p>
        </div>
      </div>

      {/* Limite de anúncios */}
      <div className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2 text-[11px] text-slate-400">
        <Info size={12} className="shrink-0 text-[#FFCB05]"/>
        <span>Limite: <strong className="text-[#FFCB05]">8 anúncios ativos</strong> simultâneos por jogador.</span>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/60 p-5 space-y-6">

        {/* Categoria */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200">O que você quer anunciar?</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "MASCOT", emoji: "🐾", label: "Mascote", desc: "Um Pokémon do seu plantel" },
              { value: "ITEM",   emoji: "📦", label: "Item",    desc: "Ovos, buffs, tickets, comida..." },
            ] as const).map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { setCategory(opt.value); setSelectedItem(null); loadInventory(); }}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  category === opt.value ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-white" : "border-border text-slate-400 hover:border-slate-600"
                }`}>
                <span className="text-2xl">{opt.emoji}</span>
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tipo de anúncio */}
        {category && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Tipo de anúncio</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "SALE",         label: "Venda",       color: "green" },
                { value: "TRADE",        label: "Troca",       color: "blue" },
                { value: "SALE_OR_TRADE",label: "Venda/Troca", color: "purple" },
                { value: "AUCTION",      label: "🔨 Leilão",   color: "amber" },
              ] as const).map(t => (
                <button key={t.value} type="button" onClick={() => setListingType(t.value as BazarListingType)}
                  className={`rounded-xl border py-2 text-xs font-semibold transition-colors ${
                    listingType === t.value
                      ? t.color === "green"  ? "border-green-500/50 bg-green-500/10 text-green-400"
                      : t.color === "blue"   ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                      : t.color === "purple" ? "border-purple-500/50 bg-purple-500/10 text-purple-400"
                      : "border-amber-500/50 bg-amber-500/10 text-amber-400"
                      : "border-border text-slate-500"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            {isAuction && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300/80 space-y-0.5">
                <p className="flex items-center gap-1"><Gavel size={11}/> <strong>Leilão:</strong> o item vai para quem der o maior lance ao encerrar.</p>
                <p>• Leilões com lances não podem ser cancelados.</p>
                <p>• Lance nos últimos 5 min estende o prazo em 30 min.</p>
                <p>• Lance superado? Os ZC são devolvidos automaticamente.</p>
              </div>
            )}
          </div>
        )}

        {/* Seleção de mascote — busca, paginação e stats base */}
        {category === "MASCOT" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Escolha o mascote</label>
            {loadingInventory ? <p className="text-xs text-slate-500">Carregando…</p>
             : !inventory ? <button onClick={loadInventory} className="text-xs text-[#FFCB05] underline">Carregar meus mascotes</button>
             : (() => {
                 const available = inventory.mascots.filter(m => !m.bazarListed && !m.isEquipped && m.arenaState === "FREE");
                 if (available.length === 0) {
                   return <p className="text-xs text-slate-500">Nenhum mascote disponível (desequipe, remova da Arena e de expedições primeiro).</p>;
                 }
                 const q = mascotSearch.trim().toLowerCase();
                 const filtered = q
                   ? available.filter(m =>
                       (m.nickname ?? "").toLowerCase().includes(q) ||
                       getPokemonName(m.pokemonId).toLowerCase().includes(q) ||
                       String(m.pokemonId).includes(q))
                   : available;
                 const PER_PAGE = 8;
                 const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
                 const page = Math.min(mascotPage, totalPages - 1);
                 const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
                 return (
                   <div className="space-y-2">
                     {/* Busca */}
                     <div className="relative">
                       <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                       <input
                         value={mascotSearch}
                         onChange={e => { setMascotSearch(e.target.value); setMascotPage(0); }}
                         placeholder="Buscar por nome, apelido ou #dex…"
                         className="w-full rounded-lg border border-border bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/50"
                       />
                     </div>

                     {filtered.length === 0 ? (
                       <p className="text-xs text-slate-500 py-2">Nenhum mascote encontrado para “{mascotSearch}”.</p>
                     ) : (
                       <div className="grid gap-2 sm:grid-cols-2">
                         {paged.map(m => (
                           <button key={m.id} type="button" onClick={() => setSelectedMascotId(m.id)}
                             className={`flex flex-col rounded-xl border p-2.5 text-left transition-colors ${
                               selectedMascotId === m.id ? "border-[#FFCB05]/50 bg-[#FFCB05]/10" : "border-border hover:border-slate-600"
                             }`}>
                             <div className="flex items-center gap-3">
                               {/* eslint-disable-next-line @next/next/no-img-element */}
                               <img src={getSpriteUrl(m.pokemonId)} alt="" width={40} height={40} className="object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
                               <div className="min-w-0">
                                 <p className="text-sm font-semibold text-white truncate">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                                 <p className="text-[10px] text-slate-500">Nv.{m.level} · #{m.pokemonId} · {m.battleWins}V</p>
                               </div>
                             </div>
                             {/* Stats base — mesmo estilo da Arena */}
                             <div className="mt-2 grid grid-cols-5 gap-0.5 text-center text-[9px]">
                               {[
                                 { k: "For", v: m.statForce,    c: "text-red-400" },
                                 { k: "Vel", v: m.statAgility,  c: "text-yellow-400" },
                                 { k: "Ins", v: m.statInstinct, c: "text-blue-400" },
                                 { k: "Vit", v: m.statVitality, c: "text-green-400" },
                                 { k: "Car", v: m.statCharisma, c: "text-pink-400" },
                               ].map(s => (
                                 <div key={s.k} className="rounded bg-slate-800/60 py-0.5">
                                   <div className="text-slate-600">{s.k}</div>
                                   <div className={`font-bold ${s.c}`}>{s.v}</div>
                                 </div>
                               ))}
                             </div>
                           </button>
                         ))}
                       </div>
                     )}

                     {/* Paginação */}
                     {totalPages > 1 && (
                       <div className="flex items-center justify-center gap-2 text-xs">
                         <button type="button" onClick={() => setMascotPage(p => Math.max(0, p - 1))} disabled={page === 0}
                           className="rounded-lg border border-border px-3 py-1 text-slate-400 disabled:opacity-40 hover:text-slate-200">Anterior</button>
                         <span className="text-slate-500">{page + 1}/{totalPages} · {filtered.length} mascote{filtered.length !== 1 ? "s" : ""}</span>
                         <button type="button" onClick={() => setMascotPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                           className="rounded-lg border border-border px-3 py-1 text-slate-400 disabled:opacity-40 hover:text-slate-200">Próxima</button>
                       </div>
                     )}
                   </div>
                 );
               })()}
          </div>
        )}

        {/* Seleção de item — tudo do inventário com dados do shop */}
        {category === "ITEM" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-200">Escolha o item</label>
            {!inventory ? (
              <button onClick={loadInventory} className="text-xs text-[#FFCB05] underline">Carregar meus itens</button>
            ) : (() => {
              const q = itemSearch.trim().toLowerCase();
              const match = (s: string) => !q || s.toLowerCase().includes(q);
              const fItems = tradeableInventory.filter(i => match(i.name) || match(i.description ?? ""));
              const fEggs = eggGroups.filter(([type]) => match(EGG_LABELS[type] ?? type));
              const fFoods = inventory.foods.filter(f => f.quantity > 0 && match(f.type === "FOOD" ? "Comida de Mascote" : "Doce de Mascote"));
              return (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                    placeholder="Buscar item, ovo ou comida…"
                    className="w-full rounded-lg border border-border bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/50" />
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">

                {/* Itens do inventário (buffs, tickets, etc.) — dados diretos do shop */}
                {fItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide sticky top-0 bg-slate-950/80 py-0.5">Itens do Inventário</p>
                    {fItems.map(item => {
                      const isSel = selectedItem?.shopItemId === item.shopItemId;
                      return (
                        <button key={item.shopItemId} type="button"
                          onClick={() => { setSelectedItem({ type: item.type, shopItemId: item.shopItemId, displayName: item.name, imageUrl: item.imageUrl ?? undefined, maxQty: item.quantity }); setItemQuantity(1); }}
                          className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                            isSel ? "border-[#FFCB05]/50 bg-[#FFCB05]/10" : "border-border hover:border-slate-600"
                          }`}>
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className="h-9 w-9 object-contain shrink-0" />
                          ) : (
                            <span className="text-xl shrink-0">{getShopItemEmoji(item.type)}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-[10px] text-slate-500 line-clamp-1">{item.description}</p>
                            )}
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.quantity} disponíveis · Preço shop: {item.shopPrice} ZC</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Ovos */}
                {fEggs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide sticky top-0 bg-slate-950/80 py-0.5">Ovos</p>
                    {fEggs.map(([type, count]) => {
                      const label = EGG_LABELS[type] ?? type;
                      const isSel = selectedItem?.type === type && !selectedItem?.shopItemId;
                      return (
                        <button key={type} type="button"
                          onClick={() => { setSelectedItem({ type, displayName: label, maxQty: count }); setItemQuantity(1); }}
                          className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                            isSel ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-white" : "border-border text-slate-400 hover:border-slate-600"
                          }`}>
                          <span className="text-lg">🥚</span>
                          <span className="text-sm">{label}</span>
                          <span className="ml-auto text-[10px] text-slate-500">{count} disponíveis</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Comida / Doces */}
                {fFoods.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide sticky top-0 bg-slate-950/80 py-0.5">Comida</p>
                    {fFoods.map(food => {
                      const label = food.type === "FOOD" ? "Comida de Mascote" : "Doce de Mascote";
                      const isSel = selectedItem?.type === food.type && !selectedItem?.shopItemId;
                      return (
                        <button key={food.type} type="button"
                          onClick={() => { setSelectedItem({ type: food.type, displayName: label, maxQty: food.quantity }); setItemQuantity(1); }}
                          className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                            isSel ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-white" : "border-border text-slate-400 hover:border-slate-600"
                          }`}>
                          <span className="text-lg">{food.type === "FOOD" ? "🍖" : "🍬"}</span>
                          <span className="text-sm">{label}</span>
                          <span className="ml-auto text-[10px] text-slate-500">{food.quantity} disponíveis</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {fItems.length === 0 && fEggs.length === 0 && fFoods.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-4">
                    {q ? `Nenhum item encontrado para “${itemSearch}”.` : "Nenhum item disponível para anunciar."}
                  </p>
                )}
                </div>
              </div>
              );
            })()}

            {selectedItem && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 shrink-0">
                  Quantidade{selectedItem.maxQty > 1 ? ` (máx. ${selectedItem.maxQty})` : ""}:
                </label>
                <input type="number" min={1} max={selectedItem.maxQty ?? 99} inputMode="numeric" pattern="[0-9]*"
                  value={itemQuantity}
                  onChange={e => {
                    const v = parseInt(e.target.value.replace(/\D/g, "")) || 1;
                    setItemQuantity(Math.min(v, selectedItem.maxQty ?? 99));
                  }}
                  className="w-20 rounded-lg border border-border bg-slate-900 px-2 py-1 text-xs text-slate-200 text-center outline-none" />
              </div>
            )}
          </div>
        )}

        {/* Campos específicos de leilão */}
        {category && isAuction && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Gavel size={14}/> Lance mínimo (ZikaCoins)
              </label>
              <input type="number" min={1} inputMode="numeric" pattern="[0-9]*"
                value={minBid} onChange={e => setMinBid(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 500"
                className="w-full rounded-xl border border-amber-500/30 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-200">Duração do leilão</label>
              <div className="flex gap-2">
                {(["12h", "1d"] as const).map(d => (
                  <button key={d} type="button" onClick={() => setAuctionDuration(d)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                      auctionDuration === d ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-border text-slate-500"
                    }`}>
                    {d === "12h" ? "12 horas" : "1 dia"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Preço (apenas anúncios normais) */}
        {category && !isAuction && listingType !== "TRADE" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Coins size={14}/> Preço (ZikaCoins)
            </label>
            <input type="number" min={1} inputMode="numeric" pattern="[0-9]*"
              value={priceCoins} onChange={e => setPriceCoins(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 2500"
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60" />
          </div>
        )}

        {category && !isAuction && (
          <div className="space-y-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={loanEnabled} onChange={(event) => setLoanEnabled(event.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-400" />
              <span>
                <strong className="block text-sm text-cyan-100">Aceitar proposta de empréstimo</strong>
                <span className="text-[10px] leading-relaxed text-slate-400">O comprador recebe o anúncio agora e fica devendo o valor financiado. O sistema registra parcelas, mas não cobra automaticamente.</span>
              </span>
            </label>
            {loanEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] text-slate-300">
                  Valor financiado
                  <input type="number" min={1} value={loanAmountCoins} onChange={(event) => setLoanAmountCoins(event.target.value.replace(/\D/g, ""))} placeholder={priceCoins || "Ex: 2500"} className="mt-1 w-full rounded-lg border border-cyan-500/25 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                </label>
                <label className="text-[11px] text-slate-300">
                  Juros totais (%)
                  <input type="number" min={0} max={100} value={loanInterestPct} onChange={(event) => setLoanInterestPct(event.target.value.replace(/\D/g, "").slice(0, 3))} className="mt-1 w-full rounded-lg border border-cyan-500/25 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                </label>
                <p className="sm:col-span-2 text-[10px] text-cyan-200/70">
                  Total prometido: {Math.ceil((parseInt(loanAmountCoins || priceCoins) || 0) * (100 + (parseInt(loanInterestPct) || 0)) / 100).toLocaleString("pt-BR")} ZC. Contrato de boa-fé, sem cobrança ou punição automática.
                </p>
              </div>
            )}
          </div>
        )}

        {/* O que quer em troca */}
        {category && !isAuction && listingType !== "SALE" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">O que você quer em troca?</label>
            <textarea value={wantedDesc} onChange={e => setWantedDesc(e.target.value)}
              placeholder="Ex: Procuro Charizard, Squirtle ou Ovo Especial…" rows={2}
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60 resize-none placeholder:text-slate-600" />
          </div>
        )}

        {/* Descrição */}
        {category && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Descrição (opcional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Adicione detalhes sobre o item…" rows={2}
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60 resize-none placeholder:text-slate-600" />
          </div>
        )}

        {/* Duração (apenas anúncios normais) */}
        {category && !isAuction && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Duração do anúncio</label>
            <div className="flex gap-2">
              {([7, 14, 30] as const).map(d => (
                <button key={d} type="button" onClick={() => setDuration(d)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                    duration === d ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-500"
                  }`}>
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fee info */}
        {inventory && (
          <div className="flex items-start gap-2 rounded-xl border border-border/40 bg-slate-900/50 px-3 py-2.5 text-[11px] text-slate-400">
            <Info size={12} className="shrink-0 mt-0.5 text-slate-500"/>
            <span>
              Taxa do Bazar: <strong className="text-[#FFCB05]">{inventory.listingFee} ZC</strong>
              {" "}(vai para o cofre do Miauvadão). Seu saldo: <strong className="text-slate-200">{inventory.balance.toLocaleString("pt-BR")} ZC</strong>
            </span>
          </div>
        )}

        {/* Submit */}
        <button type="button" disabled={pending || !canProceed()} onClick={handleSubmit}
          className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {pending ? "Criando anúncio…" : "Publicar anúncio"}
        </button>
      </div>
    </div>
  );
}
