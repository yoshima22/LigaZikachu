"use client";
import { useEffect, useState } from "react";

const pages = [
  ["A Torre despertou", "Pikachu e sete regentes comandam mascotes que receberam uma consciência rebelde. Eles prometem libertá-los dos treinadores — mesmo que precisem transformar todos os demais em soldados da Torre."],
  ["Runs e caminhos", "Cada tentativa cria sete andares com rotas, combates, enigmas, relíquias, portas e resgates. Decisões consomem tempo e aumentam a Pressão; cada ponto fortalece os inimigos."],
  ["Cooperação", "No ritmo Online, as janelas duram 120 segundos. No ritmo Lento, quatro horas. Diante de um inimigo, você pode lutar ou esperar aliados, pagando Pressão adicional pelo risco."],
  ["Classes e posturas", "Investigador revela pistas; Navegador lê rotas; Protetor reduz riscos; Artífice domina mecanismos; Ritualista enfrenta efeitos sobrenaturais; Batedor reconhece emboscadas. Cada classe restringe as posturas disponíveis."],
  ["Derrota, resgate e legado", "Mascotes derrotados podem ficar presos e até lutar sob Psicose. Outras runs encontram Salas Anti-Psicose e os devolvem aos donos. Chefes concedem pontos para uma árvore de talentos permanente."],
  ["Objetivo", "Derrote os sete chefes, reúna informações no Arquivo comunitário e interrompa o plano de Pikachu. A primeira tentativa foi feita para ser brutal; cada descoberta torna as seguintes mais inteligentes."],
] as const;

export function TowerIntro({ forceKey = 0 }: { forceKey?: number }) {
  const [open,setOpen]=useState(false); const [page,setPage]=useState(0);
  useEffect(()=>{ if(forceKey>0){setPage(0);setOpen(true);return;} if(!localStorage.getItem("tower-intro-seen-v1"))setOpen(true); },[forceKey]);
  if(!open)return null;
  const close=()=>{localStorage.setItem("tower-intro-seen-v1","1");setOpen(false)};
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3"><div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-purple-400/40 bg-slate-950 shadow-[0_0_70px_rgba(126,34,206,.4)]"><div className="relative h-52 sm:h-72">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/events/torre-dos-rebeldes/cover.png" alt="Torre dos Rebeldes" className="h-full w-full object-cover object-[center_22%]"/><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/10"/><button onClick={close} className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-2 text-white">✕</button></div><div className="p-5 sm:p-7"><p className="text-[10px] font-black uppercase tracking-[.25em] text-purple-300">Guia da expedição · {page+1}/{pages.length}</p><h2 className="mt-2 text-2xl font-black text-white">{pages[page][0]}</h2><p className="mt-3 min-h-20 text-sm leading-relaxed text-slate-300">{pages[page][1]}</p><div className="mt-5 flex items-center justify-between"><button disabled={page===0} onClick={()=>setPage(p=>p-1)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-30">Anterior</button><div className="flex gap-1">{pages.map((_,i)=><span key={i} className={`h-2 rounded-full ${i===page?"w-6 bg-[#FFCB05]":"w-2 bg-slate-700"}`}/>)}</div>{page<pages.length-1?<button onClick={()=>setPage(p=>p+1)} className="rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-black text-slate-950">Próxima</button>:<button onClick={close} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-emerald-950">Entrar na Torre</button>}</div></div></div></div>;
}
