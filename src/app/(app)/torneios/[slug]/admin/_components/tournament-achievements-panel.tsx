"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Award, Link2, Link2Off, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkAchievementToTournament, awardAchievement } from "@/app/(app)/conquistas/actions";

interface Props {
  tournamentId: string;
  tournamentAchievements: Array<{ id: string; name: string; rarity: string; rewardsCount: number }>;
  allAchievements: Array<{ id: string; name: string; rarity: string; linkedToThisTournament: boolean }>;
  players: Array<{ id: string; displayName: string }>;
}

const rarityColors: Record<string, string> = {
  COMMON:    "text-slate-400",
  UNCOMMON:  "text-[#7AC74C]",
  RARE:      "text-[#6390F0]",
  EPIC:      "text-[#735797]",
  LEGENDARY: "text-[#FFCB05]",
  SECRET:    "text-slate-600"
};

export function TournamentAchievementsPanel({ tournamentId, tournamentAchievements, allAchievements, players }: Props) {
  const [pending, startTransition] = useTransition();
  const [showLink, setShowLink] = useState(false);
  const [showAward, setShowAward] = useState(false);
  const [awardForm, setAwardForm] = useState({ achievementId: "", playerId: "", notes: "", points: "" });

  const handleLink = (achievementId: string, link: boolean) => {
    startTransition(async () => {
      try {
        const result = await linkAchievementToTournament(achievementId, link ? tournamentId : null);
        if (result.error) { toast.error(result.error); return; }
        toast.success(link ? "Conquista vinculada ao torneio!" : "Vínculo removido.");
      } catch { toast.error("Erro."); }
    });
  };

  const handleAward = () => {
    if (!awardForm.achievementId || !awardForm.playerId) {
      toast.error("Selecione conquista e jogador.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await awardAchievement({
          achievementId: awardForm.achievementId,
          playerId: awardForm.playerId,
          notes: awardForm.notes || undefined,
          pointsAwarded: awardForm.points ? parseInt(awardForm.points) : undefined
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Conquista atribuída! Recompensa enviada para a Caixa de Presentes.");
        setShowAward(false);
        setAwardForm({ achievementId: "", playerId: "", notes: "", points: "" });
      } catch { toast.error("Erro."); }
    });
  };

  const inputCls = "w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]";

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Trophy size={18} className="text-[#FFCB05]" />
          Conquistas deste Torneio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">
          Vincule conquistas a este torneio e atribua-as diretamente aos jogadores inscritos.
        </p>

        {/* Conquistas vinculadas */}
        {tournamentAchievements.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Conquistas vinculadas</p>
            {tournamentAchievements.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-slate-950/50 px-3 py-2">
                <div>
                  <span className={`text-sm font-semibold ${rarityColors[a.rarity]}`}>{a.name}</span>
                  {a.rewardsCount > 0 && (
                    <span className="ml-2 text-[10px] text-slate-500">{a.rewardsCount} recompensa(s)</span>
                  )}
                </div>
                <button type="button" disabled={pending} onClick={() => handleLink(a.id, false)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-red-400">
                  <Link2Off size={13} /> Desvincular
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowLink(!showLink)}>
            <Award size={14} className="mr-1" /> Vincular conquista
          </Button>
          {tournamentAchievements.length > 0 && players.length > 0 && (
            <Button type="button" size="sm" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
              onClick={() => setShowAward(!showAward)}>
              <Trophy size={14} className="mr-1" /> Atribuir a jogador
            </Button>
          )}
        </div>

        {/* Painel de vínculo */}
        {showLink && (
          <div className="rounded-xl border border-border bg-slate-900/40 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-300">Selecione conquistas para vincular:</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {allAchievements
                .filter(a => !a.linkedToThisTournament)
                .map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-800/40">
                    <span className={`text-sm ${rarityColors[a.rarity]}`}>{a.name}</span>
                    <button type="button" disabled={pending} onClick={() => handleLink(a.id, true)}
                      className="flex items-center gap-1 rounded-lg border border-[#FFCB05]/30 px-2 py-0.5 text-xs text-[#FFCB05] hover:bg-[#FFCB05]/10">
                      <Link2 size={11} /> Vincular
                    </button>
                  </div>
                ))
              }
              {allAchievements.filter(a => !a.linkedToThisTournament).length === 0 && (
                <p className="text-xs text-slate-500 py-2">Todas as conquistas já estão vinculadas ou não há conquistas cadastradas.</p>
              )}
            </div>
            <p className="text-[10px] text-slate-600">
              Conquistas sem vínculo aparecem na lista global. Vincular a um torneio mostra na página do torneio.
            </p>
          </div>
        )}

        {/* Painel de atribuição */}
        {showAward && (
          <div className="grid gap-3 rounded-xl border border-border bg-slate-900/40 p-4 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-400">
              <span>Conquista</span>
              <select value={awardForm.achievementId} onChange={e => setAwardForm({ ...awardForm, achievementId: e.target.value })}
                className={inputCls}>
                <option value="">Selecione</option>
                {tournamentAchievements.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Jogador</span>
              <select value={awardForm.playerId} onChange={e => setAwardForm({ ...awardForm, playerId: e.target.value })}
                className={inputCls}>
                <option value="">Selecione</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Pontos extras no ranking (opcional)</span>
              <input type="number" min={0} max={100} value={awardForm.points}
                onChange={e => setAwardForm({ ...awardForm, points: e.target.value })}
                placeholder="0" className={inputCls} />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Observação</span>
              <input value={awardForm.notes} onChange={e => setAwardForm({ ...awardForm, notes: e.target.value })}
                placeholder="Ex: Virada épica no final..." className={inputCls} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" disabled={pending} onClick={handleAward}
                className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                Atribuir conquista
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAward(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Re-export Card types needed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
