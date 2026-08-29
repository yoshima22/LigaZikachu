"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TowerNarrativeScene } from "@/lib/tower/narrative";
import { saveTowerNarrativeScenesAction } from "../actions";

export function TowerNarrative({scene}:{scene?:TowerNarrativeScene|null}) {
 if(!scene)return null;
 return <section className="relative min-h-64 overflow-hidden rounded-2xl border border-purple-400/30 bg-black">
  <Image src={scene.backgroundUrl} alt="Cenário" fill priority className="object-cover opacity-55"/><div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent"/>
  <div className={`relative flex min-h-64 items-end gap-3 p-5 ${scene.characterSide==="RIGHT"?"flex-row-reverse":""}`}><Image src={scene.characterUrl} alt={scene.speaker} width={220} height={260} className="max-h-56 w-auto max-w-[35%] object-contain drop-shadow-[0_0_18px_rgba(168,85,247,.65)]"/><div className="mb-3 flex-1 rounded-2xl border border-purple-300/40 bg-slate-950/90 p-4 shadow-xl"><p className="text-[10px] font-black uppercase tracking-[.2em] text-purple-300">{scene.speaker}</p><h3 className="mt-1 font-black text-white">{scene.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-200">{scene.text}</p></div></div>
 </section>
}

export function TowerKnowledge({entries,failures}:{entries:{id:string;title:string;text:string;floor:number}[];failures:number}) {
 const [open,setOpen]=useState(false);
 return <section className="rounded-2xl border border-violet-400/20 bg-violet-950/15 p-4"><button onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between text-left"><span><b className="text-white">📖 Arquivo da Torre</b><small className="mt-1 block text-slate-400">{entries.length} descoberta(s) · {failures} tentativa(s) malsucedida(s)</small></span><span className="text-violet-300">{open?"Recolher":"Consultar"}</span></button>{open&&<div className="mt-4 grid gap-3 md:grid-cols-2">{entries.length?entries.map(e=><article key={e.id} className="rounded-xl border border-violet-400/20 bg-black/25 p-3"><small className="font-black uppercase text-violet-300">Andar {e.floor}</small><h3 className="mt-1 font-bold text-white">{e.title}</h3><p className="mt-2 text-xs leading-relaxed text-slate-300">{e.text}</p></article>):<p className="text-xs text-slate-400">A Torre ainda não revelou nenhum segredo. Algumas informações surgem depois de falhar e tentar novamente.</p>}</div>}</section>
}

export function TowerNarrativeArchive({groups}:{groups:Array<{id:string;title:string;scenes:Array<TowerNarrativeScene & {unlocked:boolean}>}>}) {
 const [openGroup,setOpenGroup]=useState<string|null>(groups.find(group=>group.scenes.some(scene=>scene.unlocked))?.id??null);
 const [scene,setScene]=useState<TowerNarrativeScene|null>(null);
 return <section className="rounded-2xl border border-purple-400/25 bg-slate-950/80 p-4">
  <p className="text-[10px] font-black uppercase tracking-[.22em] text-purple-300">Arquivo comunitário de Xandinho</p>
  <h2 className="mt-1 text-xl font-black text-white">Diálogos encontrados por todos os grupos</h2>
  <p className="mt-2 text-xs leading-5 text-slate-400">Quando qualquer expedição encontra uma cena, ela entra na sequência compartilhada. Registros bloqueados preservam o mistério; os encontrados podem ser reassistidos por todos.</p>
  <div className="mt-4 grid gap-2 lg:grid-cols-2">{groups.map(group=>{const found=group.scenes.filter(item=>item.unlocked).length;const open=openGroup===group.id;return <article key={group.id} className="rounded-xl border border-slate-800 bg-black/25">
   <button type="button" onClick={()=>setOpenGroup(open?null:group.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left"><span><small className="font-black text-purple-300">GRUPO {group.id}</small><b className="block text-sm text-white">{group.title}</b></span><span className="rounded-full bg-purple-400/10 px-2 py-1 text-[10px] font-black text-purple-200">{found}/{group.scenes.length}</span></button>
   {open&&<div className="border-t border-slate-800 p-2">{group.scenes.map(item=><button key={item.id} disabled={!item.unlocked} onClick={()=>item.unlocked&&setScene(item)} className="mb-1 flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-purple-400/10 disabled:opacity-35"><img src={item.unlocked?item.characterUrl:"/events/torre-dos-rebeldes/chandelure.png"} alt="" className="h-9 w-9 rounded-lg object-contain"/><span className="min-w-0 flex-1"><b className="block truncate text-white">{item.unlocked?item.title:"???"}</b><small className="text-slate-500">{item.unlocked?item.speaker:"Conteúdo ainda não alcançado"}</small></span></button>)}</div>}
  </article>})}</div>
  {scene&&<div className="fixed inset-0 z-[110] overflow-y-auto bg-black/85 p-4" onMouseDown={()=>setScene(null)}><div className="mx-auto max-w-3xl pt-[8vh]" onMouseDown={event=>event.stopPropagation()}><TowerNarrative scene={scene}/><button onClick={()=>setScene(null)} className="mt-3 w-full rounded-xl bg-purple-400 py-2.5 text-xs font-black text-slate-950">Fechar registro</button></div></div>}
 </section>
}

const readFile=(file:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)});
export function TowerNarrativeAdmin({initial}:{initial:TowerNarrativeScene[]}) {
 const [open,setOpen]=useState(false),[scenes,setScenes]=useState(initial),[pending,start]=useTransition();
 const update=(i:number,p:Partial<TowerNarrativeScene>)=>setScenes(cur=>cur.map((s,n)=>n===i?{...s,...p}:s));
 const add=()=>setScenes(cur=>[...cur,{id:crypto.randomUUID(),groupId:"PERSONALIZADO",groupTitle:"Cenas personalizadas",title:"Nova cena",text:"",trigger:"ENCOUNTER",floor:1,backgroundUrl:"/events/torre-dos-rebeldes/background.png",characterUrl:"/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png",speaker:"Rebelde",characterSide:"LEFT",enabled:true,order:cur.length,minFailures:0}]);
 return <section className="rounded-2xl border border-purple-400/25 bg-slate-950/80 p-4"><button onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between text-left"><span><b className="text-white">🎭 Direção narrativa e descobertas</b><small className="mt-1 block text-slate-500">Cenas podem exigir falhas anteriores e liberar informações no Arquivo da Torre.</small></span><span className="text-purple-300">{open?"Fechar":"Editar"}</span></button>{open&&<div className="mt-4 space-y-4">{scenes.map((s,i)=><div key={s.id} className="grid gap-2 rounded-xl border border-slate-800 bg-black/30 p-3 md:grid-cols-2">
  <input value={s.speaker} onChange={e=>update(i,{speaker:e.target.value})} placeholder="Personagem" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs"/><input value={s.trigger} onChange={e=>update(i,{trigger:e.target.value as TowerNarrativeScene["trigger"]})} placeholder="Gatilho narrativo" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs"/>
  <input value={s.title} onChange={e=>update(i,{title:e.target.value})} placeholder="Título" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs"/><label className="flex items-center gap-2 rounded-lg border border-slate-700 p-2 text-xs text-slate-300">Liberar após <input type="number" min={0} value={s.minFailures??0} onChange={e=>update(i,{minFailures:Number(e.target.value)})} className="w-16 bg-transparent text-center font-bold text-purple-200"/> falha(s)</label>
  <textarea value={s.text} onChange={e=>update(i,{text:e.target.value})} placeholder="Fala" className="min-h-20 rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs md:col-span-2"/><input value={s.knowledgeTitle??""} onChange={e=>update(i,{knowledgeTitle:e.target.value})} placeholder="Título no Arquivo (opcional)" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs md:col-span-2"/><textarea value={s.knowledgeText??""} onChange={e=>update(i,{knowledgeText:e.target.value})} placeholder="Informação revelada no menu" className="min-h-16 rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs md:col-span-2"/>
  <label className="text-[10px] text-slate-400">Background<input type="file" accept="image/*" className="mt-1 block w-full" onChange={async e=>{const f=e.target.files?.[0];if(f)update(i,{backgroundUrl:await readFile(f)})}}/></label><label className="text-[10px] text-slate-400">Personagem PNG<input type="file" accept="image/*" className="mt-1 block w-full" onChange={async e=>{const f=e.target.files?.[0];if(f)update(i,{characterUrl:await readFile(f)})}}/></label>
 </div>)}<div className="flex gap-2"><button onClick={add} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">+ Cena</button><button disabled={pending} onClick={()=>start(async()=>{const r=await saveTowerNarrativeScenesAction(scenes);if("error" in r)toast.error(r.error);else toast.success("Narrativa e descobertas salvas.")})} className="rounded-lg bg-purple-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Salvar</button></div></div>}</section>
}
