import {Coins,Crown,ShieldCheck} from "lucide-react";
import {getSessionUser,isAdmin} from "@/lib/auth/permissions";
import {prisma} from "@/lib/prisma";
import {CASH_PRODUCTS} from "@/lib/liga-cash";
import {PurchaseButton} from "./purchase-client";
import {RecentOrders} from "./orders-client";
import type {DayReward} from "@/app/(app)/passe-apoiador/schedule";
export const dynamic="force-dynamic";
export default async function LigaCoinsPage(){
 const user=await getSessionUser();const player=user?await prisma.player.findUnique({where:{userId:user.id},select:{id:true}}):null;
 if(player)await prisma.ligaCashOrder.updateMany({where:{playerId:player.id,status:"PENDING",OR:[{expiresAt:{lte:new Date()}},{expiresAt:null},{createdAt:{lte:new Date(Date.now()-60*60_000)}}]},data:{status:"EXPIRED"}});
 const wallet=player?await prisma.ligaCoinWallet.findUnique({where:{playerId:player.id}}):null;
 const orders=player?await prisma.ligaCashOrder.findMany({where:{playerId:player.id},orderBy:{createdAt:"desc"},take:10}):[];
 const [currentPass,nextPass]=await Promise.all([prisma.passScheduleConfig.findFirst({where:{isCurrentStorePass:true}}),prisma.passScheduleConfig.findFirst({where:{isNextStorePass:true}})]);
 // Passe que o jogador JÁ possui: atual = passe ativo com o mesmo rótulo;
 // próximo = já tem um pedido pago/pendente desse próximo passe (pré-compra).
 const now=new Date();
 const currentLabel=currentPass?(currentPass.id==="singleton"?"Passe Apoiador":currentPass.id):null;
 const [currentPassOwned,nextPassOwned]=player?await Promise.all([
   currentLabel?prisma.supporterPass.findFirst({where:{playerId:player.id,passLabel:currentLabel,active:true,revokedAt:null,expiresAt:{gt:now}},select:{id:true}}):Promise.resolve(null),
   nextPass?prisma.ligaCashOrder.findFirst({where:{playerId:player.id,productType:"SUPPORTER_PASS",passOfferSlot:"NEXT",passScheduleKey:nextPass.id,status:{in:["PAID","PENDING"]}},select:{id:true}}):Promise.resolve(null),
 ]):[null,null];
 const admin=Boolean(user&&isAdmin(user.role));
 const products=CASH_PRODUCTS.filter(p=>p.type==="LIGA_COINS"&&(!("adminOnly" in p&&p.adminOnly)||admin));
 return <div className="space-y-6">
  <section className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.28),transparent_40%),linear-gradient(135deg,#07101f,#10102b)] p-6 sm:p-9"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Mercado da Liga</p><h1 className="mt-2 font-pixel text-xl text-white sm:text-3xl">LigaCash</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Moeda premium (LC) para itens especiais. Compras por PIX são confirmadas e creditadas automaticamente.</p></div><div className="min-w-44 rounded-2xl border border-cyan-300/20 bg-black/30 px-6 py-5 text-center"><span className="text-xs text-slate-400">Seu saldo</span><strong className="mt-1 flex items-center justify-center gap-2 text-3xl text-cyan-200"><Coins/> {(wallet?.balance??0).toLocaleString("pt-BR")} LC</strong></div></div></section>
  <section className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">{products.map((p,i)=><article key={p.code} className={`flex min-h-60 flex-col rounded-2xl border p-5 ${"adminOnly" in p&&p.adminOnly?"border-red-400/40 bg-red-500/5":i===1?"relative border-violet-400/60 bg-violet-500/10 ring-1 ring-violet-400/20":"border-slate-800 bg-slate-950/60"}`}>{i===1&&!("adminOnly" in p&&p.adminOnly)&&<span className="absolute -top-2.5 left-4 rounded-full bg-violet-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-950 shadow">🔥 Mais popular</span>}<p className="min-h-8 text-xs font-bold uppercase text-slate-400">{p.label}</p><strong className="block text-3xl text-white">{(p.base+p.bonus).toLocaleString("pt-BR")} LC</strong><div className="mt-1 min-h-9">{p.bonus>0?<span className="text-xs font-bold leading-4 text-emerald-300">{p.base.toLocaleString("pt-BR")} LC + {p.bonus.toLocaleString("pt-BR")} LC de bônus gratuito</span>:<span className="text-xs text-slate-500">{"adminOnly" in p&&p.adminOnly?"Teste exclusivo do administrador":"Pacote sem bônus adicional"}</span>}</div><p className="mt-3 text-lg font-black text-cyan-200">R$ {(p.cents/100).toFixed(2).replace(".",",")}</p><div className="mt-auto"><PurchaseButton code={p.code} isAdmin={admin}/></div></article>)}</section>
  <section className="grid gap-5 xl:grid-cols-2">
   <PassOffer isAdmin={admin} owned={Boolean(currentPassOwned)} title="Passe atual" pass={currentPass?{title:currentPass.displayTitle||currentPass.id,schedule:currentPass.schedule as unknown as DayReward[]}:null} code="PASS_CURRENT" current/>
   <PassOffer isAdmin={admin} owned={Boolean(nextPassOwned)} title="Passe do mês seguinte" pass={nextPass?{title:nextPass.displayTitle||nextPass.id,schedule:nextPass.schedule as unknown as DayReward[]}:null} code="PASS_NEXT"/>
  </section>
  <section className="rounded-2xl border border-slate-800 p-5"><h2 className="flex items-center gap-2 font-bold text-white"><ShieldCheck size={18}/> Seus pedidos recentes</h2><RecentOrders orders={orders.map(o=>({id:o.id,productLabel:o.productLabel,status:o.status}))}/></section>
 </div>
}

function PassOffer({title,pass,code,current=false,isAdmin=false,owned=false}:{title:string;pass:{title:string;schedule:DayReward[]}|null;code:string;current?:boolean;isAdmin?:boolean;owned?:boolean}){return <section className={`rounded-2xl border p-5 sm:p-6 ${current?"border-amber-400/25 bg-amber-400/5":"border-violet-400/25 bg-violet-400/5"}`}><div className="flex items-start gap-3"><Crown className={`mt-0.5 shrink-0 ${current?"text-amber-300":"text-violet-300"}`}/><div><p className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</p><h2 className="mt-1 font-bold text-white">{pass?.title??(current?"Nenhum passe atual anunciado":"Próximo Passe de Apoiador")}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{pass?"Confira todas as recompensas desta edição.":current?"A compra será liberada quando o administrador marcar o calendário atual.":"Recompensas ainda não anunciadas, mas você já pode garantir o seu."}</p><p className="mt-2 text-lg font-black text-amber-200">R$ 20,00</p></div></div>{pass&&<div className="mt-4 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{pass.schedule.map(reward=><div key={reward.day} className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/50 p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-lg">{reward.emoji}</span><div className="min-w-0"><span className="text-[10px] font-black uppercase text-slate-500">Dia {reward.day}</span><p className="text-xs leading-5 text-slate-200">{reward.label}</p></div></div>)}</div>}{owned?<div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-bold text-emerald-300">✓ Você já possui este passe</div>:(!current||pass)&&<PurchaseButton code={code} isAdmin={isAdmin}/>}</section>}
