import Link from "next/link";
import { BUY_ORDERS_PAGE_SIZE } from "@/lib/bazar-orders";
import { getBuyOrdersView, getOrderableItems, getOrderableSpecies } from "@/lib/bazar-orders-queries";
import { prisma } from "@/lib/prisma";
import { BuyOrdersPanel } from "./buy-orders-panel";

function href(kind: string, mine: boolean, opage?: number) {
  const p = new URLSearchParams({ tab: "pedidos" });
  if (kind) p.set("kind", kind);
  if (mine) p.set("mine", "1");
  if (opage && opage > 1) p.set("opage", String(opage));
  return `/bazar?${p.toString()}`;
}

/** Aba "Pedidos": lista paginada de pedidos de compra (Loja de Pedidos). */
export async function BuyOrdersTab({ searchParams, playerId }: { searchParams: Record<string, string>; playerId: string | null }) {
  const mine = searchParams.mine === "1" && Boolean(playerId);
  const kind = searchParams.kind === "MASCOT" || searchParams.kind === "ITEM" ? searchParams.kind : undefined;
  const page = Math.max(1, parseInt(searchParams.opage ?? "1", 10) || 1);

  const [view, items, myActiveCount, species] = await Promise.all([
    getBuyOrdersView({ playerId, mine, kind, page }),
    playerId ? getOrderableItems() : [],
    playerId ? prisma.bazarBuyOrder.count({ where: { buyerId: playerId, status: "ACTIVE", expiresAt: { gt: new Date() } } }) : 0,
    getOrderableSpecies(),
  ]);

  const chips = [
    { label: "Todos", href: href("", false), on: !kind && !mine },
    { label: "🐾 Mascotes", href: href("MASCOT", false), on: kind === "MASCOT" && !mine },
    { label: "🎒 Itens", href: href("ITEM", false), on: kind === "ITEM" && !mine },
    ...(playerId ? [{ label: `Meus pedidos${myActiveCount ? ` (${myActiveCount})` : ""}`, href: href("", true), on: mine }] : []),
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/10 via-slate-950/80 to-[#FFCB05]/5 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">📋 Loja de Pedidos</p>
        <h2 className="mt-1 text-base font-bold text-slate-50">Peça o que você quer. Quem tiver, vende na hora.</h2>
        <ol className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
          <li className="rounded-xl bg-black/20 p-3"><strong className="block text-slate-200">1. Faça o pedido</strong>Escolha o mascote ou item e quanto você paga.</li>
          <li className="rounded-xl bg-black/20 p-3"><strong className="block text-slate-200">2. Alguém vende</strong>Quem tem o que você pediu vende com um clique.</li>
          <li className="rounded-xl bg-black/20 p-3"><strong className="block text-slate-200">3. Pago na hora</strong>O ZC sai da sua conta só nesse momento. Sem saldo, a venda espera.</li>
        </ol>
      </section>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link key={c.label} href={c.href}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${c.on ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-400 hover:text-slate-200"}`}>
            {c.label}
          </Link>
        ))}
        <span className="ml-auto self-center text-[10px] text-slate-500">{view.totalOrders} {view.totalOrders === 1 ? "pedido" : "pedidos"} · {view.total} {view.total === 1 ? "jogador" : "jogadores"}</span>
      </div>

      <BuyOrdersPanel orders={view.orders} playerId={playerId} species={species} items={items} myActiveCount={myActiveCount} />

      {view.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-xs text-slate-400">
          {view.page > 1 && <Link className="rounded-lg border border-border px-3 py-1.5 hover:text-slate-200" href={href(kind ?? "", mine, view.page - 1)}>← Anterior</Link>}
          <span>Página {view.page} de {view.totalPages} · {BUY_ORDERS_PAGE_SIZE} jogadores por página</span>
          {view.page < view.totalPages && <Link className="rounded-lg border border-border px-3 py-1.5 hover:text-slate-200" href={href(kind ?? "", mine, view.page + 1)}>Próxima →</Link>}
        </div>
      )}
    </div>
  );
}
