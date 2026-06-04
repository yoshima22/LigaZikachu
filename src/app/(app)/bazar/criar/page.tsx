"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Coins, Info } from "lucide-react";
import Link from "next/link";
import { createListing } from "../actions";
import { getSpriteUrl, getPokemonName } from "@/lib/mascot-data";
import type { BazarItemCategory, BazarListingType } from "@prisma/client";

// This page is server-rendered to get inventory, then hydrated
// For simplicity, using a client component that fetches via API
// In production, split into server + client components

interface InventoryData {
  mascots: Array<{
    id: string; pokemonId: number; nickname: string | null; level: number;
    personality: string; isEquipped: boolean; bazarListed: boolean;
    statForce: number; statAgility: number; statCharisma: number;
    statInstinct: number; statVitality: number; battleWins: number;
  }>;
  eggs: Array<{ id: string; type: string }>;
  foods: Array<{ type: string; quantity: number }>;
  listingFee: number;
  balance: number;
}

export default function CriarAnuncioPage() {
  return <CreateListingForm />;
}

function CreateListingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<"category" | "item" | "pricing" | "confirm">("category");
  const [category, setCategory] = useState<BazarItemCategory | "">("");
  const [listingType, setListingType] = useState<BazarListingType>("SALE");
  const [priceCoins, setPriceCoins] = useState("");
  const [wantedDesc, setWantedDesc] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<7 | 14 | 30>(7);

  // Item selections
  const [selectedMascotId, setSelectedMascotId] = useState("");
  const [itemType, setItemType] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [displayName, setDisplayName] = useState("");

  // Inventory (loaded from server action via form)
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const loadInventory = async () => {
    if (inventory) return;
    setLoadingInventory(true);
    try {
      const res = await fetch("/api/bazar/inventory");
      if (res.ok) setInventory(await res.json());
    } catch { /* ignore */ }
    setLoadingInventory(false);
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const r = await createListing({
        category: category as BazarItemCategory,
        listingType,
        priceCoins: listingType !== "TRADE" && priceCoins ? parseInt(priceCoins) : undefined,
        wantedDesc: wantedDesc || undefined,
        description: description || undefined,
        durationDays: duration,
        mascotId: category === "MASCOT" ? selectedMascotId : undefined,
        itemType: category === "ITEM" ? itemType : undefined,
        quantity: category === "ITEM" ? quantity : undefined,
        displayName: category === "ITEM" ? displayName : undefined,
      });

      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success("Anúncio criado com sucesso!");
        router.push("/bazar/meu-bazar");
      }
    });
  };

  const canProceed = () => {
    if (!category) return false;
    if (category === "MASCOT" && !selectedMascotId) return false;
    if (category === "ITEM" && (!itemType || quantity < 1)) return false;
    if (listingType !== "TRADE" && (!priceCoins || parseInt(priceCoins) < 1)) return false;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bazar" className="rounded-lg border border-border p-2 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={16}/>
        </Link>
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05]">Novo Anúncio</h1>
          <p className="text-xs text-slate-500">Anuncie mascotes ou itens para vender ou trocar.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/60 p-5 space-y-6">

        {/* Categoria */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200">O que você quer anunciar?</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "MASCOT", emoji: "🐾", label: "Mascote", desc: "Um Pokémon do seu plantel" },
              { value: "ITEM",   emoji: "📦", label: "Item",     desc: "Ovos, comida, buffs..." },
            ] as const).map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { setCategory(opt.value); loadInventory(); }}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  category === opt.value
                    ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-white"
                    : "border-border text-slate-400 hover:border-slate-600"
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
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "SALE", label: "Venda", color: "green" },
                { value: "TRADE", label: "Troca", color: "blue" },
                { value: "SALE_OR_TRADE", label: "Venda/Troca", color: "purple" },
              ] as const).map(t => (
                <button key={t.value} type="button"
                  onClick={() => setListingType(t.value)}
                  className={`rounded-xl border py-2 text-xs font-semibold transition-colors ${
                    listingType === t.value
                      ? t.color === "green" ? "border-green-500/50 bg-green-500/10 text-green-400"
                      : t.color === "blue"  ? "border-blue-500/50  bg-blue-500/10  text-blue-400"
                      : "border-purple-500/50 bg-purple-500/10 text-purple-400"
                      : "border-border text-slate-500"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Seleção de mascote */}
        {category === "MASCOT" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Escolha o mascote</label>
            {loadingInventory ? (
              <p className="text-xs text-slate-500">Carregando inventário…</p>
            ) : !inventory ? (
              <button onClick={loadInventory} className="text-xs text-[#FFCB05] underline">Carregar meus mascotes</button>
            ) : inventory.mascots.filter(m => !m.bazarListed && !m.isEquipped).length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum mascote disponível para anunciar. (Desequipe e remova de expedições primeiro.)</p>
            ) : (
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {inventory.mascots
                  .filter(m => !m.bazarListed && !m.isEquipped)
                  .map(m => (
                    <button key={m.id} type="button"
                      onClick={() => setSelectedMascotId(m.id)}
                      className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                        selectedMascotId === m.id
                          ? "border-[#FFCB05]/50 bg-[#FFCB05]/10"
                          : "border-border hover:border-slate-600"
                      }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getSpriteUrl(m.pokemonId)} alt="" width={40} height={40}
                        className="object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {m.nickname ?? getPokemonName(m.pokemonId)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Nv.{m.level} · #{m.pokemonId} · {m.battleWins}V
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Seleção de item */}
        {category === "ITEM" && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-200">Escolha o item</label>
            {!inventory ? (
              <button onClick={loadInventory} className="text-xs text-[#FFCB05] underline">Carregar meus itens</button>
            ) : (
              <>
                <div className="space-y-2">
                  {/* Ovos */}
                  {inventory.eggs.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ovos</p>
                      {Object.entries(
                        inventory.eggs.reduce<Record<string, number>>((acc, e) => {
                          acc[e.type] = (acc[e.type] ?? 0) + 1;
                          return acc;
                        }, {})
                      ).map(([type, count]) => (
                        <button key={type} type="button"
                          onClick={() => { setItemType(type); setQuantity(1); setDisplayName(`Ovo ${type.replace("EGG_","").replace("COMMON","Comum").replace("RARE","Raro").replace("SPECIAL","Especial")}`); }}
                          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${itemType === type ? "border-[#FFCB05]/40 bg-[#FFCB05]/10 text-white" : "border-border text-slate-400"}`}>
                          🥚 Ovo {type} <span className="ml-auto text-slate-500">{count} disponíveis</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Comida/Doces */}
                  {inventory.foods.filter(f => f.quantity > 0).map(f => (
                    <button key={f.type} type="button"
                      onClick={() => { setItemType(f.type); setQuantity(1); setDisplayName(f.type === "FOOD" ? "Comida de Mascote" : "Doce de Mascote"); }}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${itemType === f.type ? "border-[#FFCB05]/40 bg-[#FFCB05]/10 text-white" : "border-border text-slate-400"}`}>
                      {f.type === "FOOD" ? "🍖" : "🍬"} {f.type === "FOOD" ? "Comida" : "Doce"} de Mascote
                      <span className="ml-auto text-slate-500">{f.quantity} disponíveis</span>
                    </button>
                  ))}
                </div>

                {itemType && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 shrink-0">Quantidade:</label>
                    <input type="number" min={1} value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-20 rounded-lg border border-border bg-slate-900 px-2 py-1 text-xs text-slate-200 text-center outline-none" />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Preço */}
        {category && listingType !== "TRADE" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Coins size={14}/> Preço (ZikaCoins)
            </label>
            <input
              type="number" min={1} value={priceCoins}
              onChange={e => setPriceCoins(e.target.value)}
              placeholder="Ex: 2500"
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60"
            />
          </div>
        )}

        {/* O que quer em troca */}
        {category && listingType !== "SALE" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">O que você quer em troca?</label>
            <textarea
              value={wantedDesc} onChange={e => setWantedDesc(e.target.value)}
              placeholder="Ex: Procuro Charizard, Squirtle ou Ovo Especial…"
              rows={2}
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60 resize-none placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Descrição */}
        {category && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Descrição (opcional)</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Adicione detalhes sobre o item…"
              rows={2}
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60 resize-none placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Duração */}
        {category && (
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
        <button
          type="button"
          disabled={pending || !canProceed()}
          onClick={handleSubmit}
          className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Criando anúncio…" : "Publicar anúncio"}
        </button>
      </div>
    </div>
  );
}
