import {Coins,Crown,ShieldCheck} from "lucide-react";
import {getSessionUser,isAdmin} from "@/lib/auth/permissions";
import {prisma} from "@/lib/prisma";
import {CASH_PRODUCTS} from "@/lib/liga-cash";
import {PurchaseButton} from "./purchase-client";
import {RecentOrders} from "./orders-client";
export const dynamic="force-dynamic";
export default async function LigaCoinsPage(){
 const user=await getSessionUser();const player=user?await prisma.player.findUnique({where:{userId:user.id},select:{id:true}}):null;
 if(player)await prisma.ligaCashOrder.updateMany({where:{playerId:player.id,status:"PENDING",expiresAt:{lte:new Date()}},data:{status:"EXPIRED"}});
 const wallet=player?await prisma.ligaCoinWallet.findUnique({where:{playerId:player.id}}):null;
 const orders=player?await prisma.ligaCashOrder.findMany({where:{playerId:player.id},orderBy:{createdAt:"desc"},take:8}):[];
 const products=CASH_PRODUCTS.filter(p=>p.type==="LIGA_COINS"&&(!("adminOnly" in p&&p.adminOnly)||Boolean(user&&isAdmin(user.role))));
 return <div className="space-y-6">
  <section className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.28),transparent_40%),linear-gradient(135deg,#07101f,#10102b)] p-6 sm:p-9"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Mercado da Liga</p><h1 className="mt-2 font-pixel text-xl text-white sm:text-3xl">LigaCoins</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Moeda premium para itens especiais. Compras por PIX são confirmadas e creditadas automaticamente.</p></div><div className="min-w-44 rounded-2xl border border-cyan-300/20 bg-black/30 px-6 py-5 text-center"><span className="text-xs text-slate-400">Seu saldo</span><strong className="mt-1 flex items-center justify-center gap-2 text-3xl text-cyan-200"><Coins/> {(wallet?.balance??0).toLocaleString("pt-BR")} LC</strong></div></div></section>
  <section className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">{products.map((p,i)=><article key={p.code} className={`flex min-h-60 flex-col rounded-2xl border p-5 ${"adminOnly" in p&&p.adminOnly?"border-red-400/40 bg-red-500/5":i===1?"border-violet-400/60 bg-violet-500/10 ring-1 ring-violet-400/20":"border-slate-800 bg-slate-950/60"}`}><p className="min-h-8 text-xs font-bold uppercase text-slate-400">{p.label}</p><strong className="block text-3xl text-white">{(p.base+p.bonus).toLocaleString("pt-BR")} LC</strong><div className="mt-1 min-h-9">{p.bonus>0?<span className="text-xs font-bold leading-4 text-emerald-300">{p.base.toLocaleString("pt-BR")} LC + {p.bonus.toLocaleString("pt-BR")} LC de bônus gratuito</span>:<span className="text-xs text-slate-500">{"adminOnly" in p&&p.adminOnly?"Teste exclusivo do administrador":"Pacote sem bônus adicional"}</span>}</div><p className="mt-3 text-lg font-black text-cyan-200">R$ {(p.cents/100).toFixed(2).replace(".",",")}</p><div className="mt-auto"><PurchaseButton code={p.code}/></div></article>)}</section>
  <section className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 sm:p-6"><div className="flex items-start gap-3"><Crown className="mt-0.5 shrink-0 text-amber-300"/><div><h2 className="font-bold text-white">Próximo Passe de Apoiador</h2><p className="mt-1 text-sm leading-6 text-slate-400">Ao confirmar o PIX, seu nome entra automaticamente na fila de pagantes do próximo passe.</p><p className="mt-2 text-lg font-black text-amber-200">R$ 20,00</p></div></div><PurchaseButton code="NEXT_PASS"/></section>
  <section className="rounded-2xl border border-slate-800 p-5"><h2 className="flex items-center gap-2 font-bold text-white"><ShieldCheck size={18}/> Seus pedidos recentes</h2><RecentOrders orders={orders.map(o=>({id:o.id,productLabel:o.productLabel,status:o.status}))}/></section>
 </div>
}
