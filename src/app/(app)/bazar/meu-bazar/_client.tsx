"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Coins, Clock, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cancelListing, rejectProposal, acceptProposal } from "../actions";
import { getPokemonName } from "@/lib/mascot-data";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo", RESERVED: "Reservado", SOLD: "Vendido",
  EXPIRED: "Expirado", CANCELLED: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-green-400 border-green-500/30 bg-green-500/10",
  RESERVED: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  SOLD: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  EXPIRED: "text-slate-500 border-slate-600/30 bg-slate-800/30",
  CANCELLED: "text-slate-500 border-slate-600/30 bg-slate-800/30",
};

interface MyListing {
  id: string;
  category: string;
  listingType: string;
  status: string;
  payload: Record<string, unknown>;
  priceCoins: number | null;
  loanAmountCoins: number | null;
  loanInterestPct: number | null;
  expiresAt: Date;
  createdAt: Date;
  proposals: Array<{
    id: string; proposerName: string; coinsOffer: number; loanRequested: boolean;
    itemsOffer: Array<{ type: string; quantity: number; displayName: string; mascotId?: string }> | null;
    message: string | null; status: string; createdAt: Date;
  }>;
}

interface SentProposal {
  id: string;
  listingId: string;
  sellerName: string;
  listingPayload: Record<string, unknown>;
  coinsOffer: number;
  loanRequested: boolean;
  itemsOffer: Array<{ type: string; quantity: number; displayName: string; mascotId?: string }> | null;
  message: string | null;
  status: string;
  createdAt: Date;
}

export function MyListingsClient({ listings, sentProposals }: { listings: MyListing[]; sentProposals: SentProposal[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<"listings" | "proposals">("listings");

  const itemTitle = (payload: Record<string, unknown>, category: string) => {
    if (category === "MASCOT") {
      return (payload.nickname as string) ?? getPokemonName(payload.pokemonId as number);
    }
    return payload.displayName as string ?? "Item";
  };

  const proposalItemsText = (items: Array<{ type: string; quantity: number; displayName: string; mascotId?: string }> | null) => {
    if (!items?.length) return null;
    return items.map(i => i.mascotId ? i.displayName : `${i.quantity}x ${i.displayName}`).join(", ");
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        {(["listings", "proposals"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              tab === t ? "bg-[#FFCB05]/10 text-[#FFCB05]" : "text-slate-400 hover:text-slate-200"
            }`}>
            {t === "listings" ? `Meus Anúncios (${listings.length})` : `Propostas Enviadas (${sentProposals.length})`}
          </button>
        ))}
      </div>

      {tab === "listings" && (
        <div className="space-y-2">
          {listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-slate-500">
              Nenhum anúncio ainda.{" "}
              <Link href="/bazar/criar" className="text-[#FFCB05] underline">Criar agora</Link>
            </div>
          ) : (
            listings.map(l => (
              <div key={l.id} className="rounded-xl border border-border bg-slate-950/60 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white truncate">{itemTitle(l.payload, l.category)}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_COLOR[l.status]}`}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                      {l.priceCoins && <span className="flex items-center gap-0.5 text-[#FFCB05]"><Coins size={9}/>{l.priceCoins.toLocaleString("pt-BR")} ZC</span>}
                      <span className="flex items-center gap-0.5"><Clock size={9}/>
                        {Math.max(0, Math.ceil((new Date(l.expiresAt).getTime() - Date.now()) / 86400000))}d restantes
                      </span>
                      <span>{l.proposals.length} proposta(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/bazar/${l.id}`} className="text-[10px] text-slate-400 hover:text-slate-200 underline">Ver</Link>
                    {l.status === "ACTIVE" && (
                      <button type="button" disabled={pending}
                        onClick={() => {
                          if (!confirm("Cancelar este anúncio? O item será devolvido ao seu inventário.")) return;
                          startTransition(async () => {
                            const r = await cancelListing(l.id);
                            if (r.error) toast.error(r.error);
                            else { toast.success("Anúncio cancelado."); router.refresh(); }
                          });
                        }}
                        className="rounded-lg border border-red-500/20 bg-red-500/5 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                        Cancelar
                      </button>
                    )}
                    {l.proposals.filter(p => p.status === "PENDING").length > 0 && (
                      <button onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                        className="text-slate-400 hover:text-slate-200">
                        {expanded === l.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                      </button>
                    )}
                  </div>
                </div>

                {/* Proposals section */}
                {expanded === l.id && (
                  <div className="border-t border-border/40 bg-slate-900/30 p-3 space-y-2">
                    {l.proposals.filter(p => p.status === "PENDING").map(p => (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-slate-900/50 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-200">{p.proposerName}</p>
                          {p.coinsOffer > 0 && (
                            <p className="text-[11px] text-[#FFCB05] flex items-center gap-0.5"><Coins size={9}/>{p.coinsOffer.toLocaleString("pt-BR")} ZC</p>
                          )}
                          {p.loanRequested && <p className="text-[10px] font-bold text-cyan-300">Empréstimo: {(l.loanAmountCoins ?? 0).toLocaleString("pt-BR")} ZC a {l.loanInterestPct ?? 0}%</p>}
                          {proposalItemsText(p.itemsOffer) && (
                            <p className="text-[10px] text-slate-400 truncate">+ {proposalItemsText(p.itemsOffer)}</p>
                          )}
                          {p.message && <p className="text-[10px] text-slate-500 italic truncate">"{p.message}"</p>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button type="button" disabled={pending}
                            onClick={() => {
                              if (p.loanRequested && !confirm("O item será entregue agora sem pagamento. O sistema não cobra a dívida automaticamente. Aceitar mesmo assim?")) return;
                              startTransition(async () => {
                              const r = await acceptProposal(p.id);
                              if (r.error) toast.error(r.error);
                              else { toast.success("Proposta aceita!"); router.refresh(); }
                              });
                            }}
                            className="rounded-lg border border-green-500/30 bg-green-500/10 p-1.5 text-green-400 hover:bg-green-500/20 disabled:opacity-50">
                            <Check size={12}/>
                          </button>
                          <button type="button" disabled={pending}
                            onClick={() => startTransition(async () => {
                              const r = await rejectProposal(p.id);
                              if (r.error) toast.error(r.error);
                              else { toast.success("Proposta recusada."); router.refresh(); }
                            })}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                            <X size={12}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "proposals" && (
        <div className="space-y-2">
          {sentProposals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-slate-500">
              Você não enviou nenhuma proposta ainda.
            </div>
          ) : (
            sentProposals.map(p => {
              const itemTitle2 = p.listingPayload?.nickname ?? p.listingPayload?.pokemonName ?? p.listingPayload?.displayName ?? "Item";
              return (
                <div key={p.id} className="rounded-xl border border-border bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{String(itemTitle2)}</p>
                      <p className="text-[10px] text-slate-500">Para: {p.sellerName}</p>
                      {p.coinsOffer > 0 && (
                        <p className="text-[11px] text-[#FFCB05] flex items-center gap-0.5 mt-0.5"><Coins size={9}/>{p.coinsOffer.toLocaleString("pt-BR")} ZC</p>
                      )}
                      {p.loanRequested && <p className="mt-0.5 text-[11px] font-bold text-cyan-300">Proposta de empréstimo</p>}
                      {proposalItemsText(p.itemsOffer) && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">+ {proposalItemsText(p.itemsOffer)}</p>
                      )}
                      {p.message && <p className="text-[10px] text-slate-500 italic truncate mt-0.5">"{p.message}"</p>}
                    </div>
                    <div className="shrink-0 space-y-1 text-right">
                      <span className={`block text-[10px] font-semibold ${
                        p.status === "PENDING" ? "text-yellow-400" :
                        p.status === "ACCEPTED" ? "text-green-400" :
                        "text-slate-500"
                      }`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      <Link href={`/bazar/${p.listingId}`} className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                        Ver anúncio
                      </Link>
                      {p.status === "PENDING" && (
                        <button type="button" disabled={pending}
                          onClick={() => startTransition(async () => {
                            const r = await rejectProposal(p.id);
                            if (r.error) toast.error(r.error);
                            else { toast.success("Proposta cancelada."); router.refresh(); }
                          })}
                          className="block text-[10px] text-red-400 hover:text-red-300 underline disabled:opacity-50">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
