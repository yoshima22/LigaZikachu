"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getBattleModeDivisionAction, setBattleModeDivisionAction } from "@/app/(app)/battle-division-actions";
import type { BattleModeKey } from "@/lib/battle-division-settings";

export function BattleDivisionControl({mode,isAdmin,initialDivision}:{mode:BattleModeKey;isAdmin:boolean;initialDivision:"LIMITED"|"UNLIMITED"}) {
  const [division,setDivision]=useState(initialDivision); const [pending,start]=useTransition();
  useEffect(()=>{getBattleModeDivisionAction(mode).then(r=>setDivision(r.division));},[mode]);
  const description=division==="LIMITED"?"Divisão Limitada: a equipe pode usar no máximo 2 mascotes mega evoluídos.":"Divisão Ilimitada: a equipe pode usar qualquer quantidade de mascotes mega evoluídos.";
  if(!isAdmin)return <span title={description} className="cursor-help rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[9px] font-black uppercase text-cyan-200">{division==="LIMITED"?"Limitado · máximo 2 Megas":"Ilimitado · Megas livres"}</span>;
  return <label title={description} className="flex cursor-help items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[9px] font-black uppercase text-cyan-200">Modo<select disabled={pending} value={division} onChange={e=>start(async()=>{const next=e.target.value as typeof division;const result=await setBattleModeDivisionAction(mode,next);if(result.error)toast.error(result.error);else{setDivision(next);toast.success("Divisão atualizada.");}})} className="rounded border border-cyan-400/20 bg-slate-950 px-1 py-0.5 text-[10px]"><option value="LIMITED">Limitado · máx. 2 Megas</option><option value="UNLIMITED">Ilimitado · Megas livres</option></select></label>;
}
