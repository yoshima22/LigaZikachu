"use client";
import { useState,useTransition } from "react";
import { toast } from "sonner";
import type { TowerConfig } from "@/lib/tower/config";
import { clearMyTowerCooldownAction,saveTowerConfigAction } from "../actions";

export function TowerAdminSettings({initial,onSaved}:{initial:TowerConfig;onSaved?:()=>void}){
 const [config,setConfig]=useState(initial),[open,setOpen]=useState(false),[pending,start]=useTransition();
 const clear=()=>start(async()=>{const r=await clearMyTowerCooldownAction();if("error" in r)toast.error(r.error);else{toast.success("Seu cooldown atual foi removido.");onSaved?.()}});
 const save=()=>start(async()=>{const r=await saveTowerConfigAction(config);if("error" in r)toast.error(r.error);else{setConfig(r.config);toast.success("Configuração da Torre atualizada.");onSaved?.()}});
 return <section className="rounded-2xl border border-amber-400/25 bg-amber-950/10 p-4">
  <button onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between text-left"><span><b className="text-white">⚙ Administração da Torre</b><small className="mt-1 block text-slate-400">Estas ferramentas continuam disponíveis mesmo durante seu cooldown.</small></span><span className="text-amber-300">{open?"Fechar":"Configurar"}</span></button>
  {open&&<div className="mt-4 grid gap-3 md:grid-cols-2"><label className="rounded-xl border border-slate-700 bg-black/20 p-3 text-xs text-slate-300">Cooldown global em minutos<input type="number" min={0} max={10080} value={config.entryCooldownMinutes} onChange={e=>setConfig(c=>({...c,entryCooldownMinutes:Number(e.target.value)}))} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/><small className="mt-1 block text-slate-500">Use 0 para não aplicar espera a nenhuma nova run.</small></label><label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-black/20 p-3 text-xs text-slate-300"><input type="checkbox" checked={config.requireTicket} onChange={e=>setConfig(c=>({...c,requireTicket:e.target.checked}))}/><span><b className="block text-white">Exigir Ticket da Torre</b>Controle global para novas entradas.</span></label><button disabled={pending} onClick={save} className="rounded-xl bg-amber-400 py-2.5 text-xs font-black text-amber-950 disabled:opacity-50">Salvar configuração global</button><button disabled={pending} onClick={clear} className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 py-2.5 text-xs font-black text-cyan-200 disabled:opacity-50">Liberar minha entrada agora</button></div>}
 </section>
}
