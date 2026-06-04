"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Coins, Heart, MessageSquare, Check, X, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { getSpriteUrl, getPokemonName, PERSONALITY_LABEL } from "@/lib/mascot-data";
import {
  getListing, buyListing, createProposal, acceptProposal,
  rejectProposal, toggleFavorite,
} from "../actions";

const ITEM_EMOJI: Record<string, string> = {
  COMMON:"🥚", RARE:"💙", SPECIAL:"💜", EVENT:"⭐",
  EGG_GEN1:"1️⃣",EGG_GEN2:"2️⃣",EGG_GEN3:"3️⃣",EGG_GEN4:"4️⃣",EGG_GEN5:"5️⃣",
  EGG_GEN6:"6️⃣",EGG_GEN7:"7️⃣",EGG_GEN8:"8️⃣",EGG_GEN9:"9️⃣",
  FOOD:"🍖",SWEET:"🍬",
  MASCOT_BUFF_EXP:"⚡",MASCOT_BUFF_STAT:"💊",MASCOT_BUFF_HAPPY:"🍯",
  MASCOT_BUFF_LUCK:"🍀",MASCOT_BUFF_MOOD:"💧",
};
const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  PENDING:"Pendente",ACCEPTED:"Aceita",REJECTED:"Recusada",CANCELLED:"Cancelada",
};
const PROPOSAL_STATUS_COLOR: Record<string, string> = {
  PENDING:"text-yellow-400",ACCEPTED:"text-green-400",REJECTED:"text-red-400",CANCELLED:"text-slate-500",
};

type ListingDetail = Awaited<ReturnType<typeof getListing>>;

export default function BazarListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [listing, setListing] = useState<ListingDetail>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [proposalCoins, setProposalCoins] = useState("");
  const [proposalMsg, setProposalMsg] = useState("");
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    getListing(id).then(l => { setListing(l); setLoading(false); });
    fetch("/api/bazar/inventory").then(r => r.ok ? r.json() : null).then(d => {
      // We use this just to get the current player's id
    });
    fetch("/api/auth/session").then(r => r.ok ? r.json() : null).then(s => {
      if (s?.user?.id) {
        fetch(`/api/bazar/player-id?userId=${s.user.id}`).then(r => r.ok ? r.json() : null).then(d => {
          if (d?.playerId) setCurrentPlayerId(d.playerId);
        });
      }
    });
  }, [id]);

  if (loading) return <div className="p-12 text-center text-slate-500 text-sm">Carregando…</div>;
  if (!listing) return (
    <div className="p-12 text-center space-y-3">
      <p className="text-slate-400">Anúncio não encontrado.</p>
      <Link href="/bazar" className="text-[#FFCB05] text-sm underline">Voltar ao Bazar</Link>
    </div>
  );

  const payload = listing.payload as Record<string, unknown>;
  const isOwner = listing.playerId === currentPlayerId;
  const isMascot = listing.category === "MASCOT";
  const isSale = listing.listingType === "SALE" || listing.listingType === "SALE_OR_TRADE";
  const isTrade = listing.listingType === "TRADE" || listing.listingType === "SALE_OR_TRADE";

  const handleBuy = () => {
    if (!confirm(`Comprar por ${listing.priceCoins} ZC?`)) return;
    startTransition(async () => {
      const r = await buyListing(id);
      if (r.error) toast.error(r.error);
      else { toast.success("Compra realizada!"); router.push("/mascotes"); }
    });
  };

  const handlePropose = () => {
    const coins = parseInt(proposalCoins) || 0;
    startTransition(async () => {
      const r = await createProposal(id, coins, proposalMsg || undefined);
      if (r.error) toast.error(r.error);
      else { toast.success("Proposta enviada!"); setProposalCoins(""); setProposalMsg(""); getListing(id).then(setListing); }
    });
  };

  const handleFavorite = () => {
    startTransition(async () => {
      const r = await toggleFavorite(id);
      if (!r.error) setFavorited(r.favorited ?? !favorited);
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Nav */}
      <div className="flex items-center gap-3">
        <Link href="/bazar" className="rounded-lg border border-border p-2 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={16}/>
        </Link>
        <h1 className="font-semibold text-slate-200">Detalhes do Anúncio</h1>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-border bg-slate-950/60 overflow-hidden">
        {/* Preview */}
        <div className="flex items-center justify-center bg-slate-900/80 h-48">
          {isMascot ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getSpriteUrl(payload.pokemonId as number, true)} alt=""
                className="h-32 object-contain" style={{ imageRendering: "pixelated" }}
                onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(payload.pokemonId as number); }} />
              <p className="text-[#FFCB05] font-semibold">Nível {payload.level as number}</p>
            </div>
          ) : (
            <span className="text-7xl">{ITEM_EMOJI[(payload.itemType as string)] ?? "📦"}</span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Title + badges */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isMascot
                  ? (payload.nickname as string) ?? getPokemonName(payload.pokemonId as number)
                  : payload.displayName as string}
              </h2>
              {isMascot && (
                <p className="text-sm text-slate-400">
                  {getPokemonName(payload.pokemonId as number)} · #{payload.pokemonId as number}
                  {" · "}{PERSONALITY_LABEL[(payload.personality as string)] ?? payload.personality as string}
                </p>
              )}
            </div>
            <button onClick={handleFavorite} disabled={pending || isOwner}
              className={`rounded-lg border p-2 transition-colors ${favorited ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border text-slate-500 hover:text-slate-300"}`}>
              <Heart size={14} className={favorited ? "fill-red-400" : ""}/>
            </button>
          </div>

          {/* Mascot stats */}
          {isMascot && payload.stats && (
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-900/50 p-3">
              {Object.entries(payload.stats as Record<string, number>).map(([k, v]) => (
                <div key={k} className="text-center">
                  <p className="text-[9px] text-slate-600 uppercase">{k.slice(0,3)}</p>
                  <p className="text-sm font-bold text-slate-200">{v}</p>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <p className="text-sm text-slate-400 border-l-2 border-slate-700 pl-3">{listing.description}</p>
          )}

          {/* Wanted */}
          {listing.wantedDesc && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2">
              <p className="text-[10px] text-blue-400 uppercase tracking-wide font-semibold mb-0.5">Procuro</p>
              <p className="text-xs text-slate-300">{listing.wantedDesc}</p>
            </div>
          )}

          {/* Seller + meta */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Vendedor: <strong className="text-slate-300">{listing.player.displayName}</strong></span>
            <span>{listing._count.favorites} ♥ · {listing._count.proposals} propostas</span>
          </div>

          {/* Price */}
          {listing.priceCoins && (
            <div className="flex items-center gap-2 rounded-xl bg-[#FFCB05]/10 border border-[#FFCB05]/30 px-4 py-3">
              <Coins size={18} className="text-[#FFCB05]"/>
              <span className="text-xl font-bold text-[#FFCB05]">{listing.priceCoins.toLocaleString("pt-BR")} ZC</span>
            </div>
          )}

          {/* Actions */}
          {listing.status === "ACTIVE" && !isOwner && (
            <div className="space-y-3">
              {isSale && listing.priceCoins && (
                <button type="button" disabled={pending} onClick={handleBuy}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
                  <ShoppingCart size={15}/> Comprar por {listing.priceCoins.toLocaleString("pt-BR")} ZC
                </button>
              )}

              {isTrade && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-400 flex items-center gap-2"><MessageSquare size={13}/> Enviar proposta</p>
                  <div className="flex gap-2 items-center">
                    <Coins size={13} className="text-[#FFCB05] shrink-0"/>
                    <input type="number" min={0} value={proposalCoins}
                      onChange={e => setProposalCoins(e.target.value)}
                      placeholder="ZikaCoins oferecidos (0 = sem moedas)"
                      className="flex-1 rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500/60"
                    />
                  </div>
                  <textarea value={proposalMsg} onChange={e => setProposalMsg(e.target.value)}
                    placeholder="Mensagem para o vendedor (opcional)…"
                    rows={2}
                    className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 resize-none outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                  <button type="button" disabled={pending} onClick={handlePropose}
                    className="w-full rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
                    Enviar Proposta
                  </button>
                </div>
              )}
            </div>
          )}

          {listing.status !== "ACTIVE" && (
            <div className="rounded-xl bg-slate-800/50 py-3 text-center text-sm text-slate-400">
              Este anúncio está {listing.status === "SOLD" ? "vendido" : listing.status === "EXPIRED" ? "expirado" : "cancelado"}.
            </div>
          )}

          {/* Owner: view proposals */}
          {isOwner && listing.proposals.length > 0 && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              <p className="text-sm font-semibold text-slate-200">Propostas recebidas</p>
              {listing.proposals.map(p => (
                <div key={p.id} className="rounded-xl border border-border bg-slate-900/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300">{p.proposer.displayName}</p>
                    <span className={`text-[10px] font-semibold ${PROPOSAL_STATUS_COLOR[p.status]}`}>
                      {PROPOSAL_STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  {p.coinsOffer > 0 && (
                    <p className="text-sm text-[#FFCB05] flex items-center gap-1">
                      <Coins size={12}/> {p.coinsOffer.toLocaleString("pt-BR")} ZC
                    </p>
                  )}
                  {p.message && <p className="text-xs text-slate-400 italic">"{p.message}"</p>}
                  {p.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button type="button" disabled={pending}
                        onClick={() => startTransition(async () => {
                          const r = await acceptProposal(p.id);
                          if (r.error) toast.error(r.error);
                          else { toast.success("Proposta aceita!"); getListing(id).then(setListing); }
                        })}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-500/10 border border-green-500/30 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 disabled:opacity-50">
                        <Check size={11}/> Aceitar
                      </button>
                      <button type="button" disabled={pending}
                        onClick={() => startTransition(async () => {
                          const r = await rejectProposal(p.id);
                          if (r.error) toast.error(r.error);
                          else { toast.success("Proposta recusada."); getListing(id).then(setListing); }
                        })}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-500/10 border border-red-500/30 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                        <X size={11}/> Recusar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Owner: cancel */}
          {isOwner && listing.status === "ACTIVE" && (
            <div className="border-t border-border/40 pt-3">
              <Link href="/bazar/meu-bazar"
                className="block text-center text-xs text-slate-500 hover:text-slate-300 underline">
                Gerenciar no Meus Anúncios
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
