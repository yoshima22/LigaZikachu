import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { BF_PROMO_ID, bfSummary } from "@/lib/black-friday";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const dt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const KIND: Record<string, string> = { SHOP: "ZikaShop (20%)", MIAUVADAO: "Miauvadão (+5%)", LC_PACKAGE: "Pacote de LC (15% + 10%)" };
const money = (u: { currency: string; savedAmount: number }) => u.currency === "BRL" ? `R$ ${(u.savedAmount / 100).toFixed(2).replace(".", ",")}` : `${fmt(u.savedAmount)} ${u.currency}`;

// Painel de controle da Black Friday: totais por promoção, log de quem aproveitou e cupons por jogador.
export default async function BlackFridayAdminPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) redirect("/dashboard");
  const [summary, byKind, log, perPlayer, promo] = await Promise.all([
    bfSummary(),
    prisma.blackFridayUsage.groupBy({ by: ["kind", "currency"], _count: { _all: true }, _sum: { savedAmount: true, bonusLc: true } }),
    prisma.blackFridayUsage.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.blackFridayTicket.groupBy({ by: ["playerId"], _sum: { quantity: true }, _count: { _all: true }, orderBy: { _sum: { quantity: "desc" } }, take: 200 }),
    prisma.shopPromotion.findUnique({ where: { id: BF_PROMO_ID }, select: { active: true, discountPct: true } }),
  ]);
  const ids = [...new Set([...log.map((l) => l.playerId), ...perPlayer.map((p) => p.playerId)])];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
  const name = (id: string) => players.find((p) => p.id === id)?.displayName ?? id.slice(0, 8);
  const usersByKind = await prisma.blackFridayUsage.groupBy({ by: ["kind", "playerId"] });

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-4">
      <h1 className="font-pixel text-lg text-amber-300">Black Friday · painel do admin</h1>
      <section className="grid gap-3 sm:grid-cols-4">
        <Card label="Cupons emitidos" value={fmt(summary.totalTickets)} />
        <Card label="Jogadores com cupom" value={fmt(summary.players)} />
        <Card label="20% da ZikaShop" value={promo ? (promo.active ? "Ativo" : "Desligado") : "Ausente"} />
        <Card label="Sorteio" value={summary.draw ? `Nº ${fmt(summary.draw.winningNumber)} · ${summary.draw.winnerName}` : "Pendente"} />
      </section>

      <section className="rounded-2xl border border-slate-800 p-4">
        <h2 className="mb-2 font-bold text-white">Descontos concedidos</h2>
        <table className="w-full text-left text-sm text-slate-300"><thead className="text-xs text-slate-500"><tr><th>Promoção</th><th>Compras</th><th>Jogadores</th><th>Economia total</th><th>LC de bônus</th></tr></thead><tbody>
          {byKind.length === 0 && <tr><td colSpan={5} className="py-2 text-slate-500">Nenhum uso ainda.</td></tr>}
          {byKind.map((k) => <tr key={k.kind + k.currency} className="border-t border-slate-800"><td className="py-1">{KIND[k.kind] ?? k.kind}</td><td>{fmt(k._count._all)}</td><td>{usersByKind.filter((u) => u.kind === k.kind).length}</td><td>{money({ currency: k.currency, savedAmount: k._sum.savedAmount ?? 0 })}</td><td>{fmt(k._sum.bonusLc ?? 0)}</td></tr>)}
        </tbody></table>
      </section>

      <section className="rounded-2xl border border-slate-800 p-4">
        <h2 className="mb-2 font-bold text-white">Cupons por jogador</h2>
        <table className="w-full text-left text-sm text-slate-300"><thead className="text-xs text-slate-500"><tr><th>Jogador</th><th>Pedidos</th><th>Cupons</th></tr></thead><tbody>
          {perPlayer.map((p) => <tr key={p.playerId} className="border-t border-slate-800"><td className="py-1">{name(p.playerId)}</td><td>{p._count._all}</td><td className="font-bold text-amber-200">{fmt(p._sum.quantity ?? 0)}</td></tr>)}
        </tbody></table>
      </section>

      <section className="rounded-2xl border border-slate-800 p-4">
        <h2 className="mb-2 font-bold text-white">Log de usos (últimos 300)</h2>
        <div className="max-h-[32rem] overflow-y-auto"><table className="w-full text-left text-sm text-slate-300"><thead className="sticky top-0 bg-slate-950 text-xs text-slate-500"><tr><th>Quando</th><th>Jogador</th><th>Promoção</th><th>Item</th><th>Economia</th></tr></thead><tbody>
          {log.map((l) => <tr key={l.id} className="border-t border-slate-800"><td className="py-1 whitespace-nowrap">{dt(l.createdAt)}</td><td>{name(l.playerId)}</td><td>{KIND[l.kind] ?? l.kind}</td><td>{l.label}</td><td>{money(l)}{l.bonusLc > 0 ? ` · +${fmt(l.bonusLc)} LC` : ""}</td></tr>)}
        </tbody></table></div>
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center"><p className="text-xs text-slate-500">{label}</p><strong className="text-xl text-white">{value}</strong></div>;
}
