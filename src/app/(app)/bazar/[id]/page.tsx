"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Coins, Heart, MessageSquare, Check, X, ShoppingCart, Gavel, Clock, Search } from "lucide-react";
import Link from "next/link";
import { getSpriteUrl, getStaticSpriteUrl, getPokemonName, PERSONALITY_LABEL } from "@/lib/mascot-data";
import { CONSUMABLE_SHOP_ITEM_TYPES, getShopItemEmoji } from "@/lib/shop-config";
import {
  getListing, buyListing, createProposal, acceptProposal,
  rejectProposal, toggleFavorite, editListing, placeBid, finalizeAuction,
} from "../actions";

// ── Tipos explícitos para evitar inferência unknown do Prisma ─────────────────

interface ProposalOfferedItem {
  type: string;
  quantity: number;
  displayName: string;
  mascotId?: string; // para ofertas de mascote
  pokemonId?: number;
  level?: number;
  shopItemId?: string;
  escrowed_egg_ids?: string[];
  escrowed?: boolean;
}

interface ProposalItem {
  id: string;
  coinsOffer: number;
  message: string | null;
  status: string;
  createdAt: Date;
  proposer: { id: string; displayName: string; avatarUrl: string | null };
  itemsOffer?: ProposalOfferedItem[] | null;
}

interface AuctionBidItem {
  id: string;
  amount: number;
  createdAt: Date;
  player: { id: string; displayName: string };
}

interface ListingDetail {
  id: string;
  playerId: string;
  category: string;
  listingType: string;
  status: string;
  payload: Record<string, unknown>;
  priceCoins: number | null;
  description: string | null;
  wantedDesc: string | null;
  expiresAt: Date;
  player: { id: string; displayName: string; avatarUrl: string | null };
  proposals: ProposalItem[];
  auctionBids?: AuctionBidItem[];
  _count: { favorites: number };
  // Auction fields
  minBidCoins?: number | null;
  currentBidCoins?: number | null;
  currentBidPlayerId?: string | null;
  auctionEndsAt?: Date | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROPOSAL_STATUS_COLOR: Record<string, string> = {
  PENDING:"text-yellow-400",ACCEPTED:"text-green-400",REJECTED:"text-red-400",CANCELLED:"text-slate-500",
};
const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  PENDING:"Pendente",ACCEPTED:"Aceita",REJECTED:"Recusada",CANCELLED:"Cancelada",
};

// ── Componente principal ──────────────────────────────────────────────────────

function ProposalItemsInline({ items }: { items: ProposalOfferedItem[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        if (!item.mascotId) {
          return (
            <span key={`${item.type}-${item.displayName}`} className="rounded-full border border-border bg-slate-950/60 px-2 py-1 text-[10px] text-slate-300">
              {item.quantity}x {item.displayName}
            </span>
          );
        }

        return (
          <span key={item.mascotId} className="inline-flex items-center gap-1.5 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-1 text-[10px] font-semibold text-[#FFCB05]">
            {item.pokemonId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getSpriteUrl(item.pokemonId, true)} alt="" className="h-5 w-5 object-contain" style={{ imageRendering: "pixelated" }} />
            )}
            Mascote: {item.displayName}
          </span>
        );
      })}
    </div>
  );
}

export default function BazarListingPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [proposalCoins, setProposalCoins] = useState("");
  const [proposalMsg, setProposalMsg] = useState("");
  const [favorited, setFavorited] = useState(false);
  const [offeredItems, setOfferedItems] = useState<ProposalOfferedItem[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editWanted, setEditWanted] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [auctionTimeLeft, setAuctionTimeLeft] = useState("");
  // Evita chamar finalizeAuction repetidamente a cada tick do countdown
  const finalizeRequestedRef = useRef(false);

  const reloadListing = useCallback(() => {
    getListing(id).then(raw => {
      if (!raw) { setListing(null); return; }
      // Normalise to explicit type — avoids Prisma Json inference cascade
      setListing({
        id: raw.id,
        playerId: raw.playerId,
        category: String(raw.category),
        listingType: String(raw.listingType),
        status: String(raw.status),
        payload: (raw.payload ?? {}) as Record<string, unknown>,
        priceCoins: raw.priceCoins,
        description: raw.description ?? null,
        wantedDesc: raw.wantedDesc ?? null,
        expiresAt: raw.expiresAt,
        player: raw.player,
        proposals: (raw.proposals ?? []).map(p => ({
          id: p.id,
          coinsOffer: p.coinsOffer,
          message: p.message ?? null,
          status: String(p.status),
          createdAt: p.createdAt,
          proposer: p.proposer,
          itemsOffer: Array.isArray(p.itemsOffer)
            ? (p.itemsOffer as unknown as ProposalOfferedItem[])
            : null,
        })),
        auctionBids: (raw.auctionBids ?? []).map(b => ({
          id: b.id, amount: b.amount, createdAt: b.createdAt, player: b.player,
        })),
        _count: { favorites: raw._count.favorites },
        minBidCoins: raw.minBidCoins,
        currentBidCoins: raw.currentBidCoins,
        currentBidPlayerId: raw.currentBidPlayerId,
        auctionEndsAt: raw.auctionEndsAt,
      });
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    reloadListing();
    fetch("/api/bazar/player-id")
      .then(r => r.ok ? r.json() : null)
      .then((d: { playerId?: string } | null) => { if (d?.playerId) setCurrentPlayerId(d.playerId); });
  }, [reloadListing]);

  // Auto-finalizar leilão encerrado e countdown
  useEffect(() => {
    if (!listing || listing.listingType !== "AUCTION") return;
    const endsAt = listing.auctionEndsAt ? new Date(listing.auctionEndsAt) : null;
    if (!endsAt) return;

    const update = () => {
      const ms = endsAt.getTime() - Date.now();
      if (ms <= 0) {
        setAuctionTimeLeft("Encerrado");
        if (listing.status === "ACTIVE" && !finalizeRequestedRef.current) {
          // Trava só enquanto a requisição está em voo. Se o servidor ainda não
          // considerar o leilão encerrado (defasagem de relógio) ou der erro,
          // libera o ref para tentar de novo no próximo tick de 1s.
          finalizeRequestedRef.current = true;
          finalizeAuction(listing.id)
            .then((r) => {
              if (r?.finalized) {
                reloadListing();
              } else {
                finalizeRequestedRef.current = false;
              }
            })
            .catch(() => { finalizeRequestedRef.current = false; });
        }
      } else {
        const h = Math.floor(ms / 3_600_000);
        const m = Math.floor((ms % 3_600_000) / 60_000);
        const s = Math.floor((ms % 60_000) / 1_000);
        setAuctionTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
      }
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [listing, reloadListing]);

  const handleBid = () => {
    const amount = parseInt(bidAmount);
    if (!amount || amount < 1) { toast.error("Lance inválido."); return; }
    startTransition(async () => {
      const r = await placeBid(id, amount);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Lance registrado!");
      setBidAmount("");
      reloadListing();
    });
  };

  const handleBuy = () => {
    if (!listing?.priceCoins) return;
    if (!confirm(`Comprar por ${listing.priceCoins} ZC?`)) return;
    startTransition(async () => {
      const r = await buyListing(id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Compra realizada!");
      router.push("/mascotes");
    });
  };

  const handlePropose = () => {
    const coins = parseInt(proposalCoins) || 0;
    startTransition(async () => {
      const r = await createProposal(id, coins, proposalMsg || undefined, offeredItems.length > 0 ? offeredItems : undefined);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Proposta enviada!");
      setProposalCoins("");
      setProposalMsg("");
      setOfferedItems([]);
      reloadListing();
    });
  };

  const handleFavorite = () => {
    startTransition(async () => {
      const r = await toggleFavorite(id);
      if (!r.error) setFavorited(f => !f);
    });
  };

  const handleAccept = (proposalId: string) => {
    startTransition(async () => {
      const r = await acceptProposal(proposalId);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Proposta aceita!");
      reloadListing();
    });
  };

  const handleOpenEdit = () => {
    if (!listing) return;
    setEditPrice(listing.priceCoins != null ? String(listing.priceCoins) : "");
    setEditDesc(listing.description ?? "");
    setEditWanted(listing.wantedDesc ?? "");
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    startTransition(async () => {
      const priceRaw = editPrice.trim();
      const priceCoins = priceRaw === "" ? null : parseInt(priceRaw);
      const r = await editListing(id, {
        priceCoins,
        description: editDesc,
        wantedDesc: editWanted,
      });
      if (r.error) { toast.error(r.error); return; }
      toast.success("Anúncio atualizado!");
      setEditMode(false);
      reloadListing();
    });
  };

  const handleReject = (proposalId: string) => {
    startTransition(async () => {
      const r = await rejectProposal(proposalId);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Proposta recusada.");
      reloadListing();
    });
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Carregando…</div>;
  }

  if (!listing) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-slate-400">Anúncio não encontrado.</p>
        <Link href="/bazar" className="text-[#FFCB05] text-sm underline">Voltar ao Bazar</Link>
      </div>
    );
  }

  const payload = listing.payload;
  const isOwner = listing.playerId === currentPlayerId;
  const isAuction = listing.listingType === "AUCTION";
  const isMascot = listing.category === "MASCOT";
  const isSale = !isAuction && (listing.listingType === "SALE" || listing.listingType === "SALE_OR_TRADE");
  const isTrade = !isAuction && (listing.listingType === "TRADE" || listing.listingType === "SALE_OR_TRADE");
  const isTopBidder = isAuction && listing.currentBidPlayerId === currentPlayerId;
  const minNextBid = isAuction
    ? (listing.currentBidCoins ? listing.currentBidCoins + 100 : (listing.minBidCoins ?? 1))
    : 0;
  const pokemonId = payload.pokemonId as number | undefined;
  const pokemonName = pokemonId ? getPokemonName(pokemonId) : "";
  const nickname = payload.nickname as string | undefined;
  const personality = payload.personality as string | undefined;
  const level = payload.level as number | undefined;
  const stats = payload.stats as Record<string, number> | undefined;
  const itemType = payload.itemType as string | undefined;
  const displayName = payload.displayName as string | undefined;

  const quantity = payload.quantity as number | undefined;
  const pendingProposals = listing.proposals.filter(p => p.status === "PENDING");
  const myProposals = currentPlayerId
    ? listing.proposals.filter(p => p.proposer.id === currentPlayerId)
    : [];

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
          {isMascot && pokemonId ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getSpriteUrl(pokemonId, true)}
                alt={nickname ?? pokemonName}
                className="h-32 object-contain"
                style={{ imageRendering: "pixelated" }}
                onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(pokemonId); }}
              />
              <p className="text-[#FFCB05] font-semibold">Nível {level}</p>
            </div>
          ) : (
            <span className="text-7xl">{getShopItemEmoji(itemType ?? "")}</span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Title + favorite */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {isMascot ? (nickname ?? pokemonName) : (displayName ?? "Item")}
                {!isMascot && quantity && quantity > 1 && (
                  <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">×{quantity}</span>
                )}
              </h2>
              {isMascot && pokemonId && (
                <p className="text-sm text-slate-400">
                  {pokemonName} · #{pokemonId}
                  {personality ? ` · ${PERSONALITY_LABEL[personality] ?? personality}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={handleFavorite}
              disabled={pending || isOwner}
              className={`rounded-lg border p-2 transition-colors ${favorited ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border text-slate-500 hover:text-slate-300"}`}
            >
              <Heart size={14} className={favorited ? "fill-red-400" : ""}/>
            </button>
          </div>

          {/* Mascot stats */}
          {isMascot && stats && (
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-900/50 p-3">
              {Object.entries(stats).map(([k, v]) => (
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
            <span>{listing._count.favorites} ♥ · {listing.proposals.length} propostas</span>
          </div>

          {/* Price (anúncios normais) */}
          {!isAuction && listing.priceCoins !== null && listing.priceCoins !== undefined && (
            <div className="flex items-center gap-2 rounded-xl bg-[#FFCB05]/10 border border-[#FFCB05]/30 px-4 py-3">
              <Coins size={18} className="text-[#FFCB05]"/>
              <span className="text-xl font-bold text-[#FFCB05]">
                {listing.priceCoins.toLocaleString("pt-BR")} ZC
              </span>
            </div>
          )}

          {/* Bloco de leilão */}
          {isAuction && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Gavel size={13}/> Leilão
                </p>
                <span className={`text-xs font-mono ${auctionTimeLeft === "Encerrado" ? "text-red-400" : "text-amber-300"}`}>
                  <Clock size={10} className="inline mr-0.5"/>
                  {auctionTimeLeft || "…"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-900/60 px-3 py-2">
                  <p className="text-[9px] text-slate-500 uppercase">Lance mínimo</p>
                  <p className="text-sm font-bold text-slate-200">{(listing.minBidCoins ?? 0).toLocaleString("pt-BR")} ZC</p>
                </div>
                <div className="rounded-lg bg-slate-900/60 px-3 py-2">
                  <p className="text-[9px] text-slate-500 uppercase">Lance atual</p>
                  <p className="text-sm font-bold text-amber-400">
                    {listing.currentBidCoins ? `${listing.currentBidCoins.toLocaleString("pt-BR")} ZC` : "Sem lances"}
                  </p>
                </div>
              </div>

              {isTopBidder && listing.status === "ACTIVE" && (
                <p className="text-xs text-green-400 text-center">✓ Você é o maior licitante!</p>
              )}

              {/* Form de lance — visitante, leilão ativo, não é o top bidder */}
              {listing.status === "ACTIVE" && !isOwner && !isTopBidder && (
                <div className="space-y-2 pt-1 border-t border-amber-500/20">
                  <p className="text-[10px] text-slate-500">Mínimo para novo lance: <strong className="text-amber-300">{minNextBid.toLocaleString("pt-BR")} ZC</strong></p>
                  <div className="flex gap-2">
                    <input
                      type="number" min={minNextBid} inputMode="numeric" pattern="[0-9]*"
                      value={bidAmount}
                      onChange={e => setBidAmount(e.target.value.replace(/\D/g, ""))}
                      placeholder={`${minNextBid} ZC ou mais`}
                      className="flex-1 rounded-lg border border-amber-500/30 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400/60"
                    />
                    <button
                      type="button" disabled={pending || !bidAmount || parseInt(bidAmount) < minNextBid}
                      onClick={handleBid}
                      className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-40"
                    >
                      <Gavel size={12} className="inline mr-1"/>Dar Lance
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-600">Os ZC são debitados ao dar lance e devolvidos se você for superado.</p>
                </div>
              )}

              {/* Histórico de lances */}
              {(listing.auctionBids ?? []).length > 0 && (
                <div className="space-y-1 pt-2 border-t border-amber-500/20">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Histórico de lances</p>
                  {(listing.auctionBids ?? []).map((b, i) => (
                    <div key={b.id} className={`flex items-center justify-between text-xs ${i === 0 ? "text-amber-300 font-semibold" : "text-slate-500"}`}>
                      <span>{b.player.displayName}</span>
                      <span>{b.amount.toLocaleString("pt-BR")} ZC</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions — visitor */}
          {listing.status === "ACTIVE" && !isOwner && (
            <div className="space-y-3">
              {isSale && listing.priceCoins && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleBuy}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
                >
                  <ShoppingCart size={15}/>
                  Comprar por {listing.priceCoins.toLocaleString("pt-BR")} ZC
                </button>
              )}

              {isTrade && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                    <MessageSquare size={13}/> Enviar proposta
                  </p>
                  <div className="flex gap-2 items-center">
                    <Coins size={13} className="text-[#FFCB05] shrink-0"/>
                    <input
                      type="number" min={0} inputMode="numeric" pattern="[0-9]*"
                      value={proposalCoins}
                      onChange={e => setProposalCoins(e.target.value.replace(/\D/g, ""))}
                      placeholder="ZikaCoins oferecidos (0 = sem moedas)"
                      className="flex-1 rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500/60"
                    />
                  </div>
                  <textarea
                    value={proposalMsg}
                    onChange={e => setProposalMsg(e.target.value)}
                    placeholder="Mensagem para o vendedor (opcional)…"
                    rows={2}
                    className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 resize-none outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                  {/* Items to offer */}
                  <OfferItemsPicker onItemsChange={setOfferedItems} />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={handlePropose}
                    className="w-full rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                  >
                    Enviar Proposta
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Inactive badge */}
          {listing.status !== "ACTIVE" && (
            <div className="rounded-xl bg-slate-800/50 py-3 text-center text-sm text-slate-400">
              {listing.status === "SOLD"
                ? "Este item foi vendido."
                : listing.status === "EXPIRED"
                ? "Este anúncio expirou."
                : "Este anúncio foi cancelado."}
            </div>
          )}

          {!isOwner && myProposals.length > 0 && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              <p className="text-sm font-semibold text-slate-200">Suas propostas neste anuncio</p>
              {myProposals.map(p => (
                <div key={p.id} className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">
                      {p.coinsOffer > 0 ? `${p.coinsOffer.toLocaleString("pt-BR")} ZC` : "Sem ZikaCoins"}
                    </span>
                    <span className={`text-[10px] font-semibold ${PROPOSAL_STATUS_COLOR[p.status] ?? "text-slate-400"}`}>
                      {PROPOSAL_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  {p.itemsOffer && p.itemsOffer.length > 0 && (
                    <ProposalItemsInline items={p.itemsOffer} />
                  )}
                  {p.message && (
                    <p className="text-xs text-slate-400 italic">&quot;{p.message}&quot;</p>
                  )}
                  {p.status === "PENDING" && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] text-slate-500">
                        Itens e ZC desta proposta ficam reservados ate ela ser aceita, recusada ou cancelada.
                      </p>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleReject(p.id)}
                        className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Cancelar proposta
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Owner: proposals */}
          {isOwner && listing.proposals.length > 0 && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              <p className="text-sm font-semibold text-slate-200">
                Propostas recebidas ({pendingProposals.length} pendentes)
              </p>
              {listing.proposals.map(p => (
                <div key={p.id} className="rounded-xl border border-border bg-slate-900/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300">{p.proposer.displayName}</p>
                    <span className={`text-[10px] font-semibold ${PROPOSAL_STATUS_COLOR[p.status] ?? "text-slate-400"}`}>
                      {PROPOSAL_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  {p.coinsOffer > 0 && (
                    <p className="text-sm text-[#FFCB05] flex items-center gap-1">
                      <Coins size={12}/>{p.coinsOffer.toLocaleString("pt-BR")} ZC
                    </p>
                  )}
                  {p.itemsOffer && p.itemsOffer.length > 0 && (
                    <ProposalItemsInline items={p.itemsOffer} />
                  )}
                  {p.message && (
                    <p className="text-xs text-slate-400 italic">&quot;{p.message}&quot;</p>
                  )}
                  {p.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleAccept(p.id)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-500/10 border border-green-500/30 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                      >
                        <Check size={11}/> Aceitar
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleReject(p.id)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-500/10 border border-red-500/30 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <X size={11}/> Recusar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Owner: edit + manage */}
          {isOwner && listing.status === "ACTIVE" && (
            <div className="border-t border-border/40 pt-3 space-y-3">
              {!editMode ? (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-1.5 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20"
                  >
                    ✏️ Editar anúncio
                  </button>
                  <Link href="/bazar/meu-bazar" className="text-xs text-slate-500 hover:text-slate-300 underline">
                    Meus anúncios →
                  </Link>
                </div>
              ) : (
                <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#FFCB05]">✏️ Editar anúncio</p>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">Preço (ZC) — deixe vazio para troca</label>
                    <input
                      type="number" min={0} inputMode="numeric" pattern="[0-9]*"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value.replace(/\D/g, ""))}
                      placeholder="Sem preço (somente troca)"
                      className="w-full rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">Descrição</label>
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={2}
                      placeholder="Descreva seu anúncio…"
                      className="w-full rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-200 resize-none outline-none focus:border-[#FFCB05]/60 placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">Procuro (troca)</label>
                    <textarea
                      value={editWanted}
                      onChange={e => setEditWanted(e.target.value)}
                      rows={2}
                      placeholder="O que você aceita em troca…"
                      className="w-full rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-200 resize-none outline-none focus:border-[#FFCB05]/60 placeholder:text-slate-600"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={handleSaveEdit}
                      className="flex-1 rounded-lg bg-[#FFCB05] py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
                    >
                      Salvar alterações
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="rounded-lg border border-border px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OfferItemsPicker (itens + mascotes) ──────────────────────────────────────

interface InventoryShopItem {
  inventoryId: string; shopItemId: string; type: string;
  name: string; description: string | null; imageUrl: string | null;
  rarity: string; shopPrice: number; quantity: number; equipped: boolean;
}
interface InventoryData {
  eggs: Array<{type: string; count: number}>;
  foods: Array<{type: string; quantity: number}>;
  mascots: Array<{
    id: string;
    pokemonId: number;
    nickname: string | null;
    level: number;
    bazarListed: boolean;
    isEquipped: boolean;
    arenaState: string;
    personality?: string | null;
    statForce: number;
    statAgility: number;
    statCharisma: number;
    statInstinct: number;
    statVitality: number;
    battleWins: number;
  }>;
  inventoryItems: InventoryShopItem[];
}

function OfferItemsPicker({ onItemsChange }: { onItemsChange: (items: ProposalOfferedItem[]) => void }) {
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [selected, setSelected] = useState<ProposalOfferedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mascotSearch, setMascotSearch] = useState("");

  const TRADEABLE = new Set<string>(CONSUMABLE_SHOP_ITEM_TYPES);

  const loadInventory = async () => {
    if (loaded) return;
    setLoaded(true);
    const res = await fetch("/api/bazar/inventory");
    if (res.ok) {
      const data = await res.json() as { eggs?: Array<{type: string}>; foods?: Array<{type: string; quantity: number}>; mascots?: InventoryData["mascots"]; inventoryItems?: InventoryShopItem[] };
      const eggGroups: Record<string, number> = {};
      for (const egg of (data.eggs ?? [])) {
        eggGroups[egg.type] = (eggGroups[egg.type] ?? 0) + 1;
      }
      setInventory({
        eggs: Object.entries(eggGroups).map(([type, count]) => ({ type, count })),
        foods: data.foods ?? [],
        mascots: (data.mascots ?? []).filter(m => !m.bazarListed && !m.isEquipped && m.arenaState === "FREE"),
        inventoryItems: (data.inventoryItems ?? []).filter(i => TRADEABLE.has(i.type)),
      });
    }
  };

  const toggleItem = (key: string, item: ProposalOfferedItem) => {
    setSelected(prev => {
      const exists = prev.find(i => (i.mascotId ?? i.type) === key);
      const next = exists ? prev.filter(i => (i.mascotId ?? i.type) !== key) : [...prev, item];
      onItemsChange(next);
      return next;
    });
  };

  const updateQty = (type: string, qty: number) => {
    setSelected(prev => {
      const next = prev.map(i => i.type === type && !i.mascotId ? { ...i, quantity: Math.max(1, qty) } : i);
      onItemsChange(next);
      return next;
    });
  };

  const EGG_LABELS: Record<string, string> = {
    COMMON:"Ovo Comum",RARE:"Ovo Raro",SPECIAL:"Ovo Especial",EVENT:"Ovo de Evento",
    EGG_GEN1:"Ovo Gen 1",EGG_GEN2:"Ovo Gen 2",EGG_GEN3:"Ovo Gen 3",EGG_GEN4:"Ovo Gen 4",
    EGG_GEN5:"Ovo Gen 5",EGG_GEN6:"Ovo Gen 6",EGG_GEN7:"Ovo Gen 7",EGG_GEN8:"Ovo Gen 8",EGG_GEN9:"Ovo Gen 9",
  };

  const selectedKeys = new Set(selected.map(i => i.mascotId ?? i.type));
  const mascotQuery = mascotSearch.trim().toLowerCase();
  const visibleMascots = (inventory?.mascots ?? []).filter((m) => {
    if (!mascotQuery) return true;
    const pokeName = getPokemonName(m.pokemonId);
    const name = m.nickname ?? pokeName;
    return (
      name.toLowerCase().includes(mascotQuery) ||
      pokeName.toLowerCase().includes(mascotQuery) ||
      String(m.pokemonId).includes(mascotQuery)
    );
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-400">Também ofereço (opcional):</label>
        {!loaded && (
          <button type="button" onClick={loadInventory} className="text-[10px] underline" style={{ color: "#5a4700" }}>
            Ver meu inventário
          </button>
        )}
      </div>

      {inventory && (
        <div className="rounded-xl border border-border/40 bg-slate-900/50 p-2 space-y-3 max-h-52 overflow-y-auto">

          {/* Mascotes disponíveis */}
          {inventory.mascots.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1">🐾 Mascotes</p>
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Mascotes</p>
                <span className="text-[9px] text-slate-600">{visibleMascots.length}/{inventory.mascots.length}</span>
              </div>
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={mascotSearch}
                  onChange={(e) => setMascotSearch(e.target.value)}
                  placeholder="Buscar por nome, apelido ou numero..."
                  className="w-full rounded-lg border border-border bg-slate-950 py-1.5 pl-7 pr-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
                />
              </div>
              {visibleMascots.map(m => {
                const pokeName = getPokemonName(m.pokemonId);
                const name = m.nickname ?? pokeName;
                const label = `${name} Nv.${m.level}`;
                const sel = selectedKeys.has(m.id);
                return (
                  <button key={m.id} type="button"
                    onClick={() => toggleItem(m.id, {
                      type: "MASCOT_OFFER", quantity: 1,
                      displayName: label,
                      mascotId: m.id,
                      pokemonId: m.pokemonId,
                    })}
                    className={`w-full text-left text-[11px] rounded-lg px-2 py-2 transition-colors flex items-center gap-2 ${sel ? "bg-[#FFCB05]/20 text-[#FFCB05]" : "text-slate-400 hover:bg-slate-800"}`}>
                    {/* Static sprite — no GIF */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-6 w-6 object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{label}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                        For {m.statForce} · Agi {m.statAgility} · Vit {m.statVitality} · Ins {m.statInstinct} · Car {m.statCharisma}
                      </span>
                      <span className="block text-[9px] text-slate-600">
                        Vitorias: {m.battleWins}{m.personality ? ` · ${PERSONALITY_LABEL[m.personality] ?? m.personality}` : ""}
                      </span>
                    </span>
                    {sel && <span className="ml-auto text-[9px]">✓ selecionado</span>}
                  </button>
                );
              })}
              {visibleMascots.length === 0 && (
                <p className="rounded-lg border border-border/40 bg-slate-950/50 px-2 py-2 text-center text-[11px] text-slate-600">
                  Nenhum mascote encontrado nessa busca.
                </p>
              )}
            </div>
          )}

          {/* Ovos */}
          {inventory.eggs.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1">🥚 Ovos</p>
              {inventory.eggs.map(egg => {
                const sel = selected.find(i => i.type === egg.type && !i.mascotId);
                const label = EGG_LABELS[egg.type] ?? egg.type;
                return (
                  <div key={egg.type} className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => toggleItem(egg.type, { type: egg.type, quantity: 1, displayName: label })}
                      className={`flex-1 text-left text-[11px] rounded-lg px-2 py-1 transition-colors ${sel ? "bg-[#FFCB05]/20 text-[#FFCB05]" : "text-slate-400 hover:bg-slate-800"}`}>
                      🥚 {label} ({egg.count})
                    </button>
                    {sel && (
                      <input type="number" min={1} max={egg.count} inputMode="numeric" pattern="[0-9]*"
                        value={sel.quantity}
                        onChange={e => updateQty(egg.type, parseInt(e.target.value.replace(/\D/g, ""))||1)}
                        className="w-14 rounded border border-border bg-slate-950 px-1.5 py-0.5 text-[11px] text-center text-slate-200 outline-none" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Comida/Doces */}
          {inventory.foods.filter(f => f.quantity > 0).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1">🍖 Comida</p>
              {inventory.foods.filter(f => f.quantity > 0).map(food => {
                const label = food.type === "FOOD" ? "Comida de Mascote" : "Doce de Mascote";
                const sel = selected.find(i => i.type === food.type && !i.mascotId);
                return (
                  <div key={food.type} className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => toggleItem(food.type, { type: food.type, quantity: 1, displayName: label })}
                      className={`flex-1 text-left text-[11px] rounded-lg px-2 py-1 transition-colors ${sel ? "bg-[#FFCB05]/20 text-[#FFCB05]" : "text-slate-400 hover:bg-slate-800"}`}>
                      {food.type === "FOOD" ? "🍖" : "🍬"} {label} ({food.quantity})
                    </button>
                    {sel && (
                      <input type="number" min={1} max={food.quantity} inputMode="numeric" pattern="[0-9]*"
                        value={sel.quantity}
                        onChange={e => updateQty(food.type, parseInt(e.target.value.replace(/\D/g, ""))||1)}
                        className="w-14 rounded border border-border bg-slate-950 px-1.5 py-0.5 text-[11px] text-center text-slate-200 outline-none" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Itens do inventário com dados do shop (buffs, tickets) */}
          {inventory.inventoryItems && inventory.inventoryItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1">✨ Itens Especiais</p>
              {inventory.inventoryItems.map(item => {
                const key = item.type;
                const sel = selectedKeys.has(key);
                const emoji = getShopItemEmoji(item.type);
                return (
                  <div key={key} className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => toggleItem(key, { type: item.type, quantity: 1, displayName: item.name })}
                      className={`flex-1 text-left text-[11px] rounded-lg px-2 py-1.5 transition-colors flex items-center gap-2 ${sel ? "bg-[#FFCB05]/20 text-[#FFCB05]" : "text-slate-400 hover:bg-slate-800"}`}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-5 w-5 object-contain shrink-0" />
                      ) : (
                        <span>{emoji}</span>
                      )}
                      <span className="truncate">{item.name}</span>
                      <span className="ml-auto text-[9px] text-slate-500 shrink-0">×{item.quantity}</span>
                    </button>
                    {sel && (
                      <input type="number" min={1} max={item.quantity} inputMode="numeric" pattern="[0-9]*"
                        value={selected.find(i => i.type === item.type)?.quantity ?? 1}
                        onChange={e => updateQty(item.type, parseInt(e.target.value.replace(/\D/g, ""))||1)}
                        className="w-14 rounded border border-border bg-slate-950 px-1.5 py-0.5 text-[11px] text-center text-slate-200 outline-none" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {inventory.mascots.length === 0 && inventory.eggs.length === 0 && inventory.foods.filter(f => f.quantity > 0).length === 0 && (!inventory.inventoryItems || inventory.inventoryItems.length === 0) && (
            <p className="text-center text-[11px] text-slate-600 py-2">Nenhum item disponível para oferecer.</p>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <p className="text-[10px] text-slate-500">
          Oferecendo: {selected.map(i => i.displayName).join(", ")}
        </p>
      )}
    </div>
  );
}
