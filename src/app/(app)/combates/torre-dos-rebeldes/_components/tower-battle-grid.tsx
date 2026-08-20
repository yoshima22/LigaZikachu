"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Unit = { id:string; ownerId?:string|null; team:string; name:string; pokemonId:number; x:number; y:number; hp:number; maxHp:number; role:string; level?:number; agility?:number };
type Obj = { id:string; name:string; x:number; y:number; resolved:boolean; suppression:boolean; progress:number; required:number; spriteUrl?:string; effect?:string };
type Battle = { room:{width:number;height:number;blocked:string[];wallTiles?:string[];doorTiles?:string[];trapTiles?:string[]}; discovered:string[]; visible:string[]; units:Unit[]; objects:Obj[]; over:boolean; outcome:"WIN"|"LOSS"|null };
type Mode = "MOVE"|"DEFEND"|null;
const TILE=56;
const dist=(a:Unit,x:number,y:number)=>Math.abs(a.x-x)+Math.abs(a.y-y);
const gif=(id:number)=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;

export function TowerBattleGrid({battle,mineId,disabled,destinations,targets,onDestination,onTarget,onDefend}:{battle:Battle;mineId:string;disabled?:boolean;destinations:Record<string,{x:number;y:number}>;targets:Record<string,string>;onDestination:(id:string,p:{x:number;y:number})=>void;onTarget:(id:string,target:string)=>void;onDefend:(id:string)=>void}){
 const [selected,setSelected]=useState<string|null>(null),[mode,setMode]=useState<Mode>(null);
 const selectedUnit=battle.units.find(u=>u.id===selected&&u.hp>0);
 const blocked=useMemo(()=>new Set(battle.room.blocked),[battle.room.blocked]);
 const occupied=useMemo(()=>new Map(battle.units.filter(u=>u.hp>0).map(u=>[`${u.x}:${u.y}`,u])),[battle.units]);
 const visible=new Set(battle.visible),discovered=new Set(battle.discovered);
 const moveRange=selectedUnit?Math.max(2,Math.min(6,2+Math.floor((selectedUnit.agility??40)/45))):0;
 const choose=(x:number,y:number)=>{if(disabled||!selectedUnit)return;const u=occupied.get(`${x}:${y}`);if(mode==="MOVE"&&!blocked.has(`${x}:${y}`)&&!u&&dist(selectedUnit,x,y)<=moveRange){onDestination(selectedUnit.id,{x,y});setMode(null)}};
 return <div className="rounded-2xl border border-purple-400/25 bg-[#07040d] p-3 shadow-[0_0_45px_rgba(124,58,237,.15)]">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[.18em] text-purple-200">Sala da Torre</p><p className="text-[11px] text-slate-400">Selecione seu mascote, escolha uma ação e marque o destino.</p></div>{selectedUnit&&<div className="rounded-lg border border-purple-400/30 bg-purple-950/60 px-3 py-1 text-xs text-purple-100">{selectedUnit.name} · {mode?`Escolhendo ${mode.toLowerCase()}`:"Escolha uma ação"}</div>}</div>
  <div className="overflow-auto rounded-xl border border-purple-950/80 bg-black/70 p-3"><div className="relative mx-auto bg-cover bg-center" style={{width:battle.room.width*TILE,height:battle.room.height*TILE,display:"grid",gridTemplateColumns:`repeat(${battle.room.width},${TILE}px)`,gridTemplateRows:`repeat(${battle.room.height},${TILE}px)`,backgroundImage:"linear-gradient(rgba(7,4,13,.58),rgba(7,4,13,.72)),url('/events/torre-dos-rebeldes/background.png')"}}>
   {Array.from({length:battle.room.width*battle.room.height}).map((_,i)=>{const x=i%battle.room.width,y=Math.floor(i/battle.room.width),key=`${x}:${y}`,u=occupied.get(key),o=battle.objects.find(v=>v.x===x&&v.y===y),known=discovered.has(key),canMove=!!selectedUnit&&mode==="MOVE"&&dist(selectedUnit,x,y)<=moveRange&&!blocked.has(key)&&!u,planned=!!selectedUnit&&destinations[selectedUnit.id]?.x===x&&destinations[selectedUnit.id]?.y===y;return <button type="button" key={key} disabled={!known||disabled} onClick={()=>u?.ownerId===mineId?(setSelected(u.id),setMode(null)):choose(x,y)} className={`relative border border-purple-200/10 bg-cover bg-center transition ${!known?"bg-black":blocked.has(key)?"bg-slate-950/90":"bg-purple-950/15"} ${canMove?"cursor-pointer bg-emerald-400/25 ring-2 ring-inset ring-emerald-300":""} ${planned?"ring-2 ring-inset ring-yellow-300":""}`} style={blocked.has(key)&&!o?{backgroundImage:"linear-gradient(#08040ccc,#08040ccc),url('/events/torre-dos-rebeldes/objects/10_corrente.png')"}:undefined}>
    {o&&known&&<Image
      src={o.spriteUrl||"/events/torre-dos-rebeldes/objects/04_bau_rebelde.png"} alt={o.name} width={42} height={42}
      className={`absolute inset-0 m-auto object-contain ${o.resolved?"grayscale opacity-40":"drop-shadow-[0_0_8px_#a855f7]"}`}
      title={`${o.name}: ${o.effect??"mecanismo da sala"}`}
    />}
    {u&&<div className={`absolute inset-1 z-10 rounded-xl border-2 ${u.ownerId===mineId?"border-cyan-300 bg-cyan-950/55":u.team==="ALLY"?"border-blue-400 bg-blue-950/50":"border-red-400 bg-red-950/50"} ${selected===u.id?"ring-2 ring-yellow-300":""}`}><Image unoptimized src={gif(u.pokemonId)} onError={e=>{(e.currentTarget as HTMLImageElement).src=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${u.pokemonId}.png`}} alt={u.name} width={42} height={42} className={`mx-auto h-10 w-10 object-contain ${u.pokemonId>=210001&&u.pokemonId<=210008?"":"[image-rendering:pixelated]"}`}/><span className="absolute bottom-0 left-1 right-1 h-1 overflow-hidden rounded bg-black"><i className="block h-full bg-emerald-400" style={{width:`${Math.max(0,u.hp/u.maxHp*100)}%`}}/></span></div>}
    {!visible.has(key)&&known&&<span className="pointer-events-none absolute inset-0 z-20 bg-black/55"/>}
   </button>})}
  </div></div>
  {selectedUnit&&selectedUnit.ownerId===mineId&&!disabled&&<div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setMode("MOVE")} className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 py-2 text-xs font-black text-emerald-200">Mover</button><button onClick={()=>{onDefend(selectedUnit.id);setMode("DEFEND")}} className="rounded-xl border border-blue-400/40 bg-blue-400/10 py-2 text-xs font-black text-blue-200">Defender posição</button><p className="col-span-2 text-center text-[10px] text-slate-400">Ao ficar ao alcance, o mascote age automaticamente de acordo com sua postura.</p></div>}
  <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-slate-400"><span>🔵 Seus mascotes</span><span>🔷 Aliados</span><span>🔴 Inimigos</span><span>🟩 Movimento</span><span>🟥 Ataque</span></div>
 </div>
}
