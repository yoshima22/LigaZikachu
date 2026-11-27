import Link from "next/link";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { BF_ENDS_AT, BF_INVITE_IMAGE, BF_PRIZE_LC, bfActive, bfDrawIfDue, bfSummary } from "@/lib/black-friday";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const dt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function BlackFridayPage() {
  await bfDrawIfDue().catch((e) => console.error("[BlackFriday] sorteio", e));
  const user = await getSessionUser();
  const player = user ? await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  const [summary, mine] = await Promise.all([
    bfSummary(),
    player ? prisma.blackFridayTicket.findMany({ where: { playerId: player.id }, orderBy: { startNumber: "asc" } }) : Promise.resolve([]),
  ]);
  const myTotal = mine.reduce((n, t) => n + t.quantity, 0);
  const on = bfActive();
  const { draw } = summary;
  const iWon = Boolean(draw && mine.some((t) => draw.winningNumber >= t.startNumber && draw.winningNumber < t.startNumber + t.quantity));

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-3 py-6 sm:px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BF_INVITE_IMAGE} alt="Black Friday do Miauvadão" className="w-full rounded-2xl border-2 border-amber-300/60" />
      <section className="rounded-2xl border border-amber-300/30 bg-black/50 p-5 text-sm leading-6 text-slate-200">
        <h1 className="font-pixel text-lg text-amber-300">Black Friday do Miauvadão</h1>
        <p className="mt-1 text-slate-400">{on ? <>Vai até <b className="text-amber-200">{dt(BF_ENDS_AT)}</b> (segunda, 30/11, às 23:59).</> : "O evento terminou."}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li><b className="text-amber-200">20% de desconto</b> em toda a <Link href="/shop" className="text-cyan-300 underline">ZikaShop</Link> (ZC e LC).</li>
          <li><b className="text-amber-200">15% de desconto</b> nos pacotes de <Link href="/mercado/ligacoins" className="text-cyan-300 underline">LC</Link> (Pix) + <b className="text-amber-200">10% a mais de LC</b> de bônus.</li>
          <li><b className="text-amber-200">5% a mais de desconto</b> nos slots do <Link href="/bazar" className="text-cyan-300 underline">Bazar do Miauvadão</Link>, além do desconto padrão.</li>
          <li>Cada LC comprado vale <b className="text-amber-200">1 cupom</b> para o sorteio final de <b className="text-amber-200">{fmt(BF_PRIZE_LC)} LC</b>. LC enviado de presente também conta para quem presenteia. O bônus da promoção não gera cupom.</li>
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center"><p className="text-xs text-slate-500">Seus cupons</p><strong className="text-3xl text-amber-300">{fmt(myTotal)}</strong></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center"><p className="text-xs text-slate-500">Cupons no sorteio</p><strong className="text-3xl text-white">{fmt(summary.totalTickets)}</strong></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center"><p className="text-xs text-slate-500">Participantes</p><strong className="text-3xl text-white">{fmt(summary.players)}</strong></div>
      </section>

      {draw ? (
        <section className={`rounded-2xl border p-5 text-center ${iWon ? "border-emerald-400/60 bg-emerald-500/10" : "border-amber-300/40 bg-amber-300/5"}`}>
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Resultado do sorteio · {dt(draw.drawnAt)}</p>
          <p className="mt-2 text-4xl font-black text-white">Cupom nº {fmt(draw.winningNumber)}</p>
          <p className="mt-1 text-sm text-slate-300">sorteado entre {fmt(draw.totalTickets)} cupons</p>
          <p className="mt-3 text-lg font-bold text-amber-200">🏆 {draw.winnerName} ganhou {fmt(draw.prizeLc)} LC!</p>
          {iWon && <p className="mt-1 text-sm font-bold text-emerald-300">É você! O prêmio já está na sua carteira.</p>}
        </section>
      ) : !on ? (
        <section className="rounded-2xl border border-slate-800 p-5 text-center text-sm text-slate-300">O sorteio acontece assim que os últimos pagamentos do evento forem confirmados. Volte em instantes!</section>
      ) : (
        <section className="rounded-2xl border border-slate-800 p-5 text-center text-sm text-slate-300">O número vencedor será sorteado assim que o evento terminar e o resultado aparecerá aqui, para todos.</section>
      )}

      {player && (
        <section className="rounded-2xl border border-slate-800 p-5">
          <h2 className="font-bold text-white">Seus números</h2>
          {mine.length === 0 ? <p className="mt-2 text-sm text-slate-400">Você ainda não tem cupons. Compre LC no <Link href="/mercado/ligacoins" className="text-cyan-300 underline">Mercado</Link> para participar.</p> : (
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {mine.map((t) => <li key={t.id}>{dt(t.createdAt)} · {fmt(t.quantity)} cupons · nºs <b className="text-amber-200">{fmt(t.startNumber)}</b> a <b className="text-amber-200">{fmt(t.startNumber + t.quantity - 1)}</b></li>)}
            </ul>
          )}
        </section>
      )}
      {user && isAdmin(user.role) && <p className="text-center text-xs"><Link href="/black-friday/admin" className="text-cyan-300 underline">Painel do admin</Link></p>}
    </main>
  );
}
