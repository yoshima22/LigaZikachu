"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Trophy, Award, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAchievement, awardAchievement, toggleAchievement, updateAchievement, deleteAchievement } from "../actions";

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
const rarityColors: Record<string, string> = {
  COMMON:"text-slate-400", UNCOMMON:"text-[#7AC74C]", RARE:"text-[#6390F0]",
  EPIC:"text-[#735797]", LEGENDARY:"text-[#FFCB05]", SECRET:"text-slate-600"
};

type FormState = {
  key: string; name: string; description: string; type: string;
  rarity: string; category: string; scope: string;
  isSecret: boolean; isRepeatable: boolean; suggestedPoints: string;
  iconUrl: string; seasonId: string;
};

const EMPTY_FORM: FormState = {
  key:"", name:"", description:"", type:"MANUAL",
  rarity:"COMMON", category:"TOURNAMENT", scope:"GLOBAL",
  isSecret:false, isRepeatable:false, suggestedPoints:"", iconUrl:"", seasonId:""
};

function achievementToForm(a: Achievement): FormState {
  return {
    key: a.key, name: a.name, description: a.description ?? "",
    type: a.type, rarity: a.rarity, category: a.category, scope: a.scope,
    isSecret: a.isSecret, isRepeatable: a.isRepeatable,
    suggestedPoints: a.suggestedPoints?.toString() ?? "",
    iconUrl: a.iconUrl ?? "", seasonId: ""
  };
}

function AchievementForm({ form, setForm, seasons, onSave, onCancel, pending, label }: {
  form: FormState; setForm: (f: FormState) => void;
  seasons: { id: string; name: string }[];
  onSave: () => void; onCancel: () => void;
  pending: boolean; label: string;
}) {
  const cls = "w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]";
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-xs text-slate-400">
        <span>Chave (ex: virada_impossivel)</span>
        <input value={form.key} onChange={e => setForm({...form, key: e.target.value})}
          placeholder="virada_impossivel" className={cls} />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Nome</span>
        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
          placeholder="Virada Impossível" className={cls} />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Tipo</span>
        <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className={cls}>
          {TYPES.map(t => <option key={t} value={t}>{t === "MANUAL" ? "Manual (admin atribui)" : "Automático"}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Categoria</span>
        <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={cls}>
          {CATEGORIES.map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Raridade</span>
        <select value={form.rarity} onChange={e => setForm({...form, rarity: e.target.value})} className={cls}>
          {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Escopo</span>
        <select value={form.scope} onChange={e => setForm({...form, scope: e.target.value})} className={cls}>
          {SCOPES.map(s => <option key={s} value={s}>{s === "GLOBAL" ? "Global" : s === "SEASON" ? "Por temporada" : "Por torneio"}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Descrição</span>
        <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
          placeholder="Descrição da conquista..." className={cls} />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Pontos sugeridos</span>
        <input type="number" min={0} max={100} value={form.suggestedPoints}
          onChange={e => setForm({...form, suggestedPoints: e.target.value})} className={cls} />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>URL do ícone (opcional)</span>
        <input value={form.iconUrl} onChange={e => setForm({...form, iconUrl: e.target.value})}
          placeholder="https://..." className={cls} />
      </label>
      {seasons.length > 0 && (
        <label className="space-y-1 text-xs text-slate-400">
          <span>Temporada (opcional)</span>
          <select value={form.seasonId} onChange={e => setForm({...form, seasonId: e.target.value})} className={cls}>
            <option value="">Global</option>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <div className="flex gap-4 text-sm text-slate-300 items-end pb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isSecret} onChange={e => setForm({...form, isSecret: e.target.checked})} className="accent-[#FFCB05]" />
          Secreta
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isRepeatable} onChange={e => setForm({...form, isRepeatable: e.target.checked})} className="accent-[#FFCB05]" />
          Repetível
        </label>
      </div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="button" disabled={!form.key || !form.name || pending} onClick={onSave}
          className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">{label}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export function AchievementsAdminPanel({ achievements, players, seasons }: Props) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showAward, setShowAward] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [awardForm, setAwardForm] = useState({
    achievementId:"", playerId:"", seasonId:"", notes:"", pointsAwarded:"", weekId:""
  });

  const inputCls = "w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]";

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createAchievement({
          key: createForm.key, name: createForm.name,
          description: createForm.description || undefined,
          type: createForm.type as "MANUAL" | "AUTOMATIC",
          rarity: createForm.rarity as "COMMON"|"UNCOMMON"|"RARE"|"EPIC"|"LEGENDARY"|"SECRET",
          category: createForm.category as "TOURNAMENT"|"COLLECTION"|"SOCIAL"|"ENGAGEMENT"|"COSMETIC"|"SPECIAL",
          scope: createForm.scope as "GLOBAL"|"SEASON"|"TOURNAMENT",
          isSecret: createForm.isSecret, isRepeatable: createForm.isRepeatable,
          suggestedPoints: createForm.suggestedPoints ? parseInt(createForm.suggestedPoints) : undefined,
          iconUrl: createForm.iconUrl || undefined,
          seasonId: createForm.seasonId || undefined,
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Conquista criada!"); setShowCreate(false); setCreateForm(EMPTY_FORM);
      } catch { toast.error("Erro ao criar."); }
    });
  };

  const openEdit = (a: Achievement) => {
    setEditingId(a.id);
    setEditForm(achievementToForm(a));
  };

  const handleUpdate = () => {
    if (!editingId) return;
    startTransition(async () => {
      try {
        const result = await updateAchievement(editingId, {
          key: editForm.key, name: editForm.name,
          description: editForm.description || undefined,
          type: editForm.type as "MANUAL" | "AUTOMATIC",
          rarity: editForm.rarity as "COMMON"|"UNCOMMON"|"RARE"|"EPIC"|"LEGENDARY"|"SECRET",
          category: editForm.category as "TOURNAMENT"|"COLLECTION"|"SOCIAL"|"ENGAGEMENT"|"COSMETIC"|"SPECIAL",
          scope: editForm.scope as "GLOBAL"|"SEASON"|"TOURNAMENT",
          isSecret: editForm.isSecret, isRepeatable: editForm.isRepeatable,
          suggestedPoints: editForm.suggestedPoints ? parseInt(editForm.suggestedPoints) : undefined,
          iconUrl: editForm.iconUrl || undefined,
          seasonId: editForm.seasonId || undefined,
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Conquista atualizada!"); setEditingId(null);
      } catch { toast.error("Erro ao atualizar."); }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Isso remove todas as atribuições também.`)) return;
    startTransition(async () => {
      const result = await deleteAchievement(id);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Conquista excluída.");
    });
  };

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      const result = await toggleAchievement(id, !active);
      if (result.error) { toast.error(result.error); return; }
      toast.success(active ? "Desativada." : "Ativada.");
    });
  };

  const handleAward = () => {
    startTransition(async () => {
      try {
        const result = await awardAchievement({
          achievementId: awardForm.achievementId, playerId: awardForm.playerId,
          seasonId: awardForm.seasonId || undefined, notes: awardForm.notes || undefined,
          pointsAwarded: awardForm.pointsAwarded ? parseInt(awardForm.pointsAwarded) : undefined,
          weekId: awardForm.weekId || undefined
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Conquista atribuída!"); setShowAward(false);
      } catch { toast.error("Erro ao atribuir."); }
    });
  };

  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-[#FFCB05] flex items-center gap-2">
          <Trophy size={16} /> Admin de Conquistas
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}
            className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
            <Plus size={14} /> Nova
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAward(!showAward)}
            className="gap-1">
            <Award size={14} /> Atribuir
          </Button>
        </div>
      </div>

      {/* Criar */}
      {showCreate && (
        <AchievementForm
          form={createForm} setForm={setCreateForm} seasons={seasons}
          onSave={handleCreate} onCancel={() => setShowCreate(false)}
          pending={pending} label="Criar conquista"
        />
      )}

      {/* Atribuir */}
      {showAward && (
        <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-400">
            <span>Conquista</span>
            <select value={awardForm.achievementId} onChange={e => setAwardForm({...awardForm, achievementId: e.target.value})} className={inputCls}>
              <option value="">Selecione</option>
              {achievements.filter(a => a.type === "MANUAL" && a.active).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.rarity})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Jogador</span>
            <select value={awardForm.playerId} onChange={e => setAwardForm({...awardForm, playerId: e.target.value})} className={inputCls}>
              <option value="">Selecione</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Pontos extras</span>
            <input type="number" min={0} max={100} value={awardForm.pointsAwarded}
              onChange={e => setAwardForm({...awardForm, pointsAwarded: e.target.value})}
              placeholder="0" className={inputCls} />
          </label>
          {seasons.length > 0 && (
            <label className="space-y-1 text-xs text-slate-400">
              <span>Temporada</span>
              <select value={awardForm.seasonId} onChange={e => setAwardForm({...awardForm, seasonId: e.target.value})} className={inputCls}>
                <option value="">Sem temporada</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label className="space-y-1 text-xs text-slate-400 sm:col-span-2">
            <span>Observação</span>
            <textarea value={awardForm.notes} onChange={e => setAwardForm({...awardForm, notes: e.target.value})}
              rows={2} className={`${inputCls} resize-none`} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" disabled={!awardForm.achievementId || !awardForm.playerId || pending} onClick={handleAward}
              className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">Atribuir</Button>
            <Button type="button" variant="outline" onClick={() => setShowAward(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {achievements.length > 0 && (
        <div className="space-y-1">
          {achievements.map(a => (
            <div key={a.id} className={`rounded-xl border border-border bg-slate-950/60 overflow-hidden ${a.active ? "" : "opacity-50"}`}>
              {/* Linha principal */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-200 text-sm">{a.name}</p>
                    <span className={`text-[10px] font-semibold ${rarityColors[a.rarity]}`}>{a.rarity}</span>
                    <span className="text-[10px] text-slate-500">{catLabel[a.category]}</span>
                    {a.suggestedPoints && <span className="text-[10px] text-[#FFCB05]">+{a.suggestedPoints}pts</span>}
                    {a.isSecret && <span className="text-[10px] text-slate-500">🔒</span>}
                  </div>
                  {a.description && <p className="text-xs text-slate-500 truncate mt-0.5">{a.description}</p>}
                  <p className="text-[10px] text-slate-600 mt-0.5">{a.playersCount} jogadores · {a.type}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" disabled={pending}
                    onClick={() => { setEditingId(editingId === a.id ? null : a.id); if (editingId !== a.id) openEdit(a); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title="Editar">
                    {editingId === a.id ? <X size={14} /> : <Pencil size={14} />}
                  </button>
                  <button type="button" disabled={pending} onClick={() => handleToggle(a.id, a.active)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title={a.active ? "Desativar" : "Ativar"}>
                    {a.active ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" disabled={pending} onClick={() => handleDelete(a.id, a.name)}
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                    title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Formulário de edição inline */}
              {editingId === a.id && (
                <div className="border-t border-border bg-slate-900/60 p-4">
                  <AchievementForm
                    form={editForm} setForm={setEditForm} seasons={seasons}
                    onSave={handleUpdate} onCancel={() => setEditingId(null)}
                    pending={pending} label="Salvar alterações"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
