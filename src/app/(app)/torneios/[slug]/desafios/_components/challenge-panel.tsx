"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChallengeType } from "@prisma/client";
import { Award, CheckCircle, Plus, Swords, X, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChallengeConfig } from "../config";
import {
  createChallenge,
  respondToChallenge,
  resolveChallenge,
  deleteChallenge,
  setBadgeProgress
} from "../actions";

interface BadgeSummary {
  id: string;
  name: string;
  imageUrl: string;
  ownerId: string | null;
  ownerName: string | null;
  myProgress: number;
}

interface ChallengeSummary {
  id: string;
  type: ChallengeType;
  status: string;
  reason: string;
  resolutionNotes: string | null;
  openedAt: string;
  resolvedAt: string | null;
  challenger: { id: string; displayName: string };
  challenged: { id: string; displayName: string };
  badge: { id: string; name: string; imageUrl: string } | null;
  week: { weekNumber: number; label: string | null } | null;
  isMyChallenge: boolean;
}

interface Props {
  tournamentId: string;
  tournamentSlug: string;
  config: ChallengeConfig;
  challengesEnabled: boolean;
  isParticipant: boolean;
  isAdmin: boolean;
  playerId: string | null;
  playerDisplayName: string | null;
  approvedPlayers: { id: string; displayName: string }[];
  badges: BadgeSummary[];
  weeks: { id: string; weekNumber: number; label: string | null; status: string }[];
  challenges: ChallengeSummary[];
}

const statusStyle: Record<string, string> = {
  OPEN:         "text-[#F7D02C] border-[#F7D02C]/40 bg-[#F7D02C]/10",
  UNDER_REVIEW: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  ACCEPTED:     "text-[#7AC74C] border-[#7AC74C]/40 bg-[#7AC74C]/10",
  REJECTED:     "text-slate-400 border-slate-400/30 bg-slate-400/10",
  RESOLVED:     "text-[#6390F0] border-[#6390F0]/40 bg-[#6390F0]/10"
};
const statusLabel: Record<string, string> = {
  OPEN: "Aberto", UNDER_REVIEW: "Em análise", ACCEPTED: "Aprovado", REJECTED: "Encerrado", RESOLVED: "Concluído"
};

export function ChallengePanel({
  tournamentId, config, challengesEnabled, isParticipant, isAdmin,
  playerId, approvedPlayers, badges, weeks, challenges
}: Props) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showBadgeProgress, setShowBadgeProgress] = useState(false);

  // Create challenge form state
  const [form, setForm] = useState({
    type: config.badgeChallenge ? ChallengeType.BADGE : ChallengeType.FREE,
    challengedId: "",
    badgeId: "",
    weekId: "",
    reason: ""
  });

  // Admin badge progress form
  const [progressForm, setProgressForm] = useState({ badgeId: "", playerId: "", points: 0, notes: "" });

  // Admin resolve form
  const [resolveForm, setResolveForm] = useState<{ challengeId: string; matchId: string; notes: string } | null>(null);

  const handleCreateChallenge = () => {
    startTransition(async () => {
      try {
        const result = await createChallenge({
          tournamentId,
          challengedId: form.challengedId,
          type: form.type,
          badgeId: form.type === ChallengeType.BADGE && form.badgeId ? form.badgeId : undefined,
          tournamentWeekId: form.weekId || undefined,
          reason: form.reason
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Desafio solicitado com sucesso!");
        setShowCreate(false);
        setForm({ ...form, challengedId: "", reason: "", badgeId: "", weekId: "" });
      } catch { toast.error("Erro ao criar desafio. Tente novamente."); }
    });
  };

  const handleRespond = (challengeId: string, accept: boolean) => {
    startTransition(async () => {
      try {
        const result = await respondToChallenge(challengeId, accept);
        if (result.error) { toast.error(result.error); return; }
        toast.success(accept ? "Desafio aprovado!" : "Desafio rejeitado.");
      } catch { toast.error("Erro ao responder desafio. Tente novamente."); }
    });
  };

  const handleResolve = (challengerWon: boolean) => {
    if (!resolveForm) return;
    startTransition(async () => {
      try {
        const result = await resolveChallenge({
          challengeId: resolveForm.challengeId,
          challengerWon,
          matchId: resolveForm.matchId || undefined,
          notes: resolveForm.notes || undefined
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success(challengerWon ? "Desafio resolvido — insígnia transferida!" : "Desafio encerrado — penalidade aplicada.");
        setResolveForm(null);
      } catch { toast.error("Erro ao registrar resultado. Tente novamente."); }
    });
  };

  const handleDelete = (challengeId: string) => {
    if (!confirm("Excluir este desafio permanentemente?")) return;
    startTransition(async () => {
      try {
        const result = await deleteChallenge(challengeId);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Desafio excluído.");
      } catch { toast.error("Erro ao excluir desafio. Tente novamente."); }
    });
  };

  const handleSetProgress = () => {
    startTransition(async () => {
      try {
        const result = await setBadgeProgress(
          progressForm.badgeId,
          progressForm.playerId,
          progressForm.points,
          progressForm.notes || undefined
        );
        if (result.error) { toast.error(result.error); return; }
        toast.success("Progresso atualizado!");
      } catch { toast.error("Erro ao salvar progresso. Tente novamente."); }
    });
  };

  return (
    <div className="space-y-6">
      {/* Admin: Registrar progresso de insígnia */}
      {isAdmin && badges.length > 0 && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-5">
          <button
            onClick={() => setShowBadgeProgress(!showBadgeProgress)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              <Award size={16} className="text-[#FFCB05]" />
              Registrar Progresso de Insígnia
            </h2>
            <span className="text-xs text-slate-500">{showBadgeProgress ? "Fechar" : "Abrir"}</span>
          </button>

          {showBadgeProgress && (
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_80px_1fr_auto]">
              <label className="space-y-1 text-xs text-slate-400">
                <span>Insígnia</span>
                <select
                  value={progressForm.badgeId}
                  onChange={(e) => setProgressForm({ ...progressForm, badgeId: e.target.value })}
                  className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                >
                  <option value="">Selecione</option>
                  {badges.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Jogador</span>
                <select
                  value={progressForm.playerId}
                  onChange={(e) => setProgressForm({ ...progressForm, playerId: e.target.value })}
                  className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                >
                  <option value="">Selecione</option>
                  {approvedPlayers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Pontos</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={progressForm.points}
                  onChange={(e) => setProgressForm({ ...progressForm, points: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Obs.</span>
                <input
                  value={progressForm.notes}
                  onChange={(e) => setProgressForm({ ...progressForm, notes: e.target.value })}
                  placeholder="Ex: 3 vitórias com Fogo"
                  className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                />
              </label>
              <div className="flex items-end">
                <Button
                  disabled={!progressForm.badgeId || !progressForm.playerId || pending}
                  onClick={handleSetProgress}
                  className="w-full bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Criar desafio */}
      {challengesEnabled && (isParticipant || isAdmin) && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              <Swords size={16} className="text-[#FFCB05]" />
              Solicitar Desafio
            </h2>
            <Button
              size="sm"
              onClick={() => setShowCreate(!showCreate)}
              className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
            >
              <Plus size={14} />
              Novo
            </Button>
          </div>

          {showCreate && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {/* Tipo */}
              {config.badgeChallenge && config.freeChallenge && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm({ ...form, type: ChallengeType.BADGE })}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      form.type === ChallengeType.BADGE
                        ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                        : "border-border text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <Award size={13} /> Insígnia
                  </button>
                  <button
                    onClick={() => setForm({ ...form, type: ChallengeType.FREE })}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      form.type === ChallengeType.FREE
                        ? "border-blue-400/50 bg-blue-400/10 text-blue-400"
                        : "border-border text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <Zap size={13} /> Livre
                  </button>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {/* Jogador desafiado */}
                <label className="space-y-1 text-xs text-slate-400">
                  <span>Desafiar jogador</span>
                  <select
                    value={form.challengedId}
                    onChange={(e) => setForm({ ...form, challengedId: e.target.value })}
                    className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                  >
                    <option value="">Selecione</option>
                    {approvedPlayers
                      .filter((p) => p.id !== playerId)
                      .map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                  </select>
                </label>

                {/* Semana */}
                <label className="space-y-1 text-xs text-slate-400">
                  <span>Semana (opcional)</span>
                  <select
                    value={form.weekId}
                    onChange={(e) => setForm({ ...form, weekId: e.target.value })}
                    className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                  >
                    <option value="">Sem semana específica</option>
                    {weeks.map((w) => (
                      <option key={w.id} value={w.id}>
                        Semana {w.weekNumber}{w.label ? ` — ${w.label}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Insígnia (apenas se BADGE) */}
              {form.type === ChallengeType.BADGE && badges.length > 0 && (
                <label className="space-y-1 text-xs text-slate-400">
                  <span>Insígnia disputada</span>
                  <select
                    value={form.badgeId}
                    onChange={(e) => setForm({ ...form, badgeId: e.target.value })}
                    className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                  >
                    <option value="">Selecione a insígnia</option>
                    {badges.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.ownerName ? `(dono: ${b.ownerName})` : "(sem dono)"}
                        {" "}— meu progresso: {b.myProgress}pt
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Motivo */}
              <label className="space-y-1 text-xs text-slate-400">
                <span>Motivo / Mensagem</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={2}
                  placeholder="Ex: Tenho 3 pontos na Insígnia de Fogo e desejo desafiar o dono."
                  className="w-full resize-none rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                />
              </label>

              <div className="flex gap-2">
                <Button
                  disabled={!form.challengedId || !form.reason || pending}
                  onClick={handleCreateChallenge}
                  className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
                >
                  {pending ? "Enviando…" : "Solicitar Desafio"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista de desafios */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-200">
          <Swords size={16} className="text-[#FFCB05]" />
          Histórico de Desafios
        </h2>

        {challenges.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-slate-500">
            Nenhum desafio registrado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {challenges.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* tipo */}
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        c.type === ChallengeType.BADGE
                          ? "border-[#FFCB05]/30 bg-[#FFCB05]/10 text-[#FFCB05]"
                          : "border-blue-400/30 bg-blue-400/10 text-blue-400"
                      }`}>
                        {c.type === ChallengeType.BADGE ? <Award size={9} /> : <Zap size={9} />}
                        {c.type === ChallengeType.BADGE ? "Insígnia" : "Livre"}
                      </span>
                      {/* status */}
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle[c.status]}`}>
                        {statusLabel[c.status]}
                      </span>
                      {c.badge && (
                        <span className="text-xs text-slate-400">— {c.badge.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200">
                      <span className="font-semibold text-white">{c.challenger.displayName}</span>
                      <span className="text-slate-500"> desafia </span>
                      <span className="font-semibold text-white">{c.challenged.displayName}</span>
                    </p>
                    {c.week && (
                      <p className="text-xs text-slate-500">
                        Semana {c.week.weekNumber}{c.week.label ? ` — ${c.week.label}` : ""}
                      </p>
                    )}
                    <p className="max-w-lg text-xs text-slate-400">{c.reason}</p>
                    {c.resolutionNotes && (
                      <p className="text-xs italic text-slate-500">Resolução: {c.resolutionNotes}</p>
                    )}
                    <p className="text-[10px] text-slate-600">
                      {new Date(c.openedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap gap-2">
                    {/* Admin: aprovar/rejeitar desafios abertos */}
                    {isAdmin && (c.status === "OPEN" || c.status === "UNDER_REVIEW") && (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleRespond(c.id, true)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#7AC74C] hover:bg-[#7AC74C]/10"
                        >
                          <CheckCircle size={13} /> Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleRespond(c.id, false)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle size={13} /> Rejeitar
                        </button>
                      </>
                    )}

                    {/* Admin: resolver após partida */}
                    {isAdmin && c.status === "ACCEPTED" && (
                      <>
                        {resolveForm?.challengeId === c.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              placeholder="ID da partida (opcional)"
                              value={resolveForm.matchId}
                              onChange={(e) => setResolveForm({ ...resolveForm, matchId: e.target.value })}
                              className="rounded-lg border border-border bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
                            />
                            <input
                              placeholder="Observações"
                              value={resolveForm.notes}
                              onChange={(e) => setResolveForm({ ...resolveForm, notes: e.target.value })}
                              className="rounded-lg border border-border bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => handleResolve(true)}
                                className="flex-1 rounded-lg bg-[#7AC74C] px-2 py-1 text-xs font-semibold text-white"
                              >
                                Desafiante venceu
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => handleResolve(false)}
                                className="flex-1 rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white"
                              >
                                Desafiante perdeu
                              </button>
                              <button
                                type="button"
                                onClick={() => setResolveForm(null)}
                                className="rounded-lg border border-border px-2 py-1 text-xs text-slate-400"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setResolveForm({ challengeId: c.id, matchId: "", notes: "" })}
                            className="rounded-lg border border-[#FFCB05]/30 px-2 py-1.5 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/10"
                          >
                            Registrar resultado
                          </button>
                        )}
                      </>
                    )}

                    {/* Excluir (criador ou admin, apenas em estados abertos) */}
                    {(c.isMyChallenge || isAdmin) && ["OPEN", "UNDER_REVIEW"].includes(c.status) && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDelete(c.id)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:text-red-400"
                      >
                        <X size={13} /> Excluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
