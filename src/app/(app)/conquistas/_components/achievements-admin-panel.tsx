"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Trophy, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAchievement, awardAchievement, toggleAchievement } from "../actions";

interface Achievement {
  id: string; key: string; name: string; description: string | null;
  type: string; rarity: string; category: string; scope: string;
  isSecret: boolean; isRepeatable: boolean; active: boolean;
  suggestedPoints: number | null; iconUrl: string | null; playersCount: number;
}

interface Props {
  achievements: Achievement[];
  players: { id: string; displayName: string }[];
  seasons: { id: string; name: string }[];
}

const RARITIES = ["COMMON","UNCOMMON","RARE","EPIC","LEGENDARY","SECRET"];
const CATEGORIES = ["TOURNAMENT","COLLECTION","SOCIAL","ENGAGEMENT","COSMETIC","SPECIAL"];
const SCOPES = ["GLOBAL","SEASON","TOURNAMENT"];
const TYPES = ["MANUAL","AUTOMATIC"];

const catLabel: Record<string, string> = {
  TOURNAMENT:"Torneio",COLLECTION:"Coleção",SOCIAL:"Social",
  ENGAGEMENT:"Engajamento",COSMETIC:"Cosméticos",SPECIAL:"Especial"
};

export function AchievementsAdminPanel({ achievements, players, seasons }: Props) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showAward, setShowAward] = useState(false);
  const [createForm, setCreateForm] = useState<{
    key: string; name: string; description: string;
    type: string; rarity: string; category: string; scope: string;
    isSecret: boolean; isRepeatable: boolean;
    suggestedPoints: string; iconUrl: string; seasonId: string;
  }>({
    key:"", name:"", description:"", type:"MANUAL",
    rarity:"COMMON", category:"TOURNAMENT", scope:"GLOBAL",
    isSecret:false, isRepeatable:false, suggestedPoints:"", iconUrl:"", seasonId:""
  });
  const [awardForm, setAwardForm] = useState({
    achievementId:"", playerId:"", seasonId:"",
    notes:"", pointsAwarded:"", weekId:""
  });

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createAchievement({
          key: createForm.key,
          name: createForm.name,
          description: createForm.description || undefined,
          type: createForm.type as "MANUAL" | "AUTOMATIC",
          rarity: createForm.rarity as "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "SECRET",
          category: createForm.category as "TOURNAMENT" | "COLLECTION" | "SOCIAL" | "ENGAGEMENT" | "COSMETIC" | "SPECIAL",
          scope: createForm.scope as "GLOBAL" | "SEASON" | "TOURNAMENT",
          isSecret: createForm.isSecret,
          isRepeatable: createForm.isRepeatable,
          suggestedPoints: createForm.suggestedPoints ? parseInt(createForm.suggestedPoints) : undefined,
          iconUrl: createForm.iconUrl || undefined,
          seasonId: createForm.seasonId || undefined,
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Conquista criada!"); setShowCreate(false);
      } catch { toast.error("Erro ao criar."); }
    });
  };

  const handleAward = () => {
    startTransition(async () => {
      try {
        const result = await awardAchievement({
          achievementId: awardForm.achievementId,
          playerId: awardForm.playerId,
          seasonId: awardForm.seasonId || undefined,
          notes: awardForm.notes || undefined,
          pointsAwarded: awardForm.pointsAwarded ? parseInt(awardForm.pointsAwarded) : undefined,
          weekId: awardForm.weekId || undefined
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Conquista atribuída! Recompensas enviadas para a Caixa de Presentes."); setShowAward(false);
      } catch { toast.error("Erro ao atribuir."); }
    });
  };

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      const result = await toggleAchievement(id, !active);
      if (result.error) { toast.error(result.error); return; }
      toast.success(active ? "Conquista desativada." : "Conquista ativada.");
    });
  };

  const inputCls = "w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]";
  const selectCls = inputCls;

  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-[#FFCB05] flex items-center gap-2">
          <Trophy size={16} /> Admin de Conquistas
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}
            className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
            <Plus size={14} /> Nova conquista
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAward(!showAward)}
            className="gap-1">
            <Award size={14} /> Atribuir manualmente
          </Button>
        </div>
      </div>

      {/* Criar conquista */}
      {showCreate && (
        <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs text-slate-400">
            <span>Chave (ex: virada_impossivel)</span>
            <input value={createForm.key} onChange={e => setCreateForm({...createForm, key: e.target.value})}
              placeholder="virada_impossivel" className={inputCls} />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Nome</span>
            <input value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})}
              placeholder="Virada Impossível" className={inputCls} />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Tipo</span>
            <select value={createForm.type} onChange={e => setCreateForm({...createForm, type: e.target.value as "MANUAL"|"AUTOMATIC"})}
              className={selectCls}>
              {TYPES.map(t => <option key={t} value={t}>{t === "MANUAL" ? "Manual (admin atribui)" : "Automático (sistema detecta)"}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Categoria</span>
            <select value={createForm.category} onChange={e => setCreateForm({...createForm, category: e.target.value as typeof createForm.category})}
              className={selectCls}>
              {CATEGORIES.map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Raridade</span>
            <select value={createForm.rarity} onChange={e => setCreateForm({...createForm, rarity: e.target.value as typeof createForm.rarity})}
              className={selectCls}>
              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Escopo</span>
            <select value={createForm.scope} onChange={e => setCreateForm({...createForm, scope: e.target.value as typeof createForm.scope})}
              className={selectCls}>
              {SCOPES.map(s => <option key={s} value={s}>{s === "GLOBAL" ? "Global (conta)" : s === "SEASON" ? "Por temporada" : "Por torneio"}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Descrição</span>
            <input value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})}
              placeholder="Vença uma partida impossível..." className={inputCls} />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Pontos sugeridos (opcional)</span>
            <input type="number" min={0} max={100} value={createForm.suggestedPoints}
              onChange={e => setCreateForm({...createForm, suggestedPoints: e.target.value})} className={inputCls} />
          </label>
          {seasons.length > 0 && (
            <label className="space-y-1 text-xs text-slate-400">
              <span>Temporada (opcional)</span>
              <select value={createForm.seasonId} onChange={e => setCreateForm({...createForm, seasonId: e.target.value})}
                className={selectCls}>
                <option value="">Global</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <div className="flex gap-4 text-sm text-slate-300 items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={createForm.isSecret} onChange={e => setCreateForm({...createForm, isSecret: e.target.checked})} className="accent-[#FFCB05]" />
              Secreta
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={createForm.isRepeatable} onChange={e => setCreateForm({...createForm, isRepeatable: e.target.checked})} className="accent-[#FFCB05]" />
              Repetível
            </label>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="button" disabled={!createForm.key || !createForm.name || pending} onClick={handleCreate}
              className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">Criar</Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Atribuir conquista */}
      {showAward && (
        <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-400">
            <span>Conquista</span>
            <select value={awardForm.achievementId} onChange={e => setAwardForm({...awardForm, achievementId: e.target.value})}
              className={selectCls}>
              <option value="">Selecione</option>
              {achievements.filter(a => a.type === "MANUAL" && a.active).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.rarity})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Jogador</span>
            <select value={awardForm.playerId} onChange={e => setAwardForm({...awardForm, playerId: e.target.value})}
              className={selectCls}>
              <option value="">Selecione</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Pontos extras no ranking (opcional)</span>
            <input type="number" min={0} max={100} value={awardForm.pointsAwarded}
              onChange={e => setAwardForm({...awardForm, pointsAwarded: e.target.value})}
              placeholder="0" className={inputCls} />
          </label>
          {seasons.length > 0 && (
            <label className="space-y-1 text-xs text-slate-400">
              <span>Temporada (opcional)</span>
              <select value={awardForm.seasonId} onChange={e => setAwardForm({...awardForm, seasonId: e.target.value})}
                className={selectCls}>
                <option value="">Sem temporada</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label className="space-y-1 text-xs text-slate-400 sm:col-span-2">
            <span>Observação (aparece no histórico)</span>
            <textarea value={awardForm.notes} onChange={e => setAwardForm({...awardForm, notes: e.target.value})}
              rows={2} placeholder="Ex: Virou uma partida após estar 5-1 abaixo..." className={`${inputCls} resize-none`} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" disabled={!awardForm.achievementId || !awardForm.playerId || pending} onClick={handleAward}
              className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">Atribuir e enviar recompensa</Button>
            <Button type="button" variant="outline" onClick={() => setShowAward(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista de conquistas */}
      {achievements.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-900/80 text-left text-xs uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Raridade</th>
                <th className="px-4 py-3">Pts sugeridos</th>
                <th className="px-4 py-3">Conquistado por</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {achievements.map(a => (
                <tr key={a.id} className={a.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-200">{a.name}</p>
                    {a.isSecret && <span className="text-[10px] text-slate-500">🔒 Secreta</span>}
                    {a.isRepeatable && <span className="ml-2 text-[10px] text-slate-500">🔄 Repetível</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{a.type}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{a.rarity}</td>
                  <td className="px-4 py-3 text-slate-400">{a.suggestedPoints ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{a.playersCount}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" disabled={pending} onClick={() => handleToggle(a.id, a.active)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200">
                      {a.active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
