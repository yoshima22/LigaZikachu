"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reportMatchResult, confirmMatchResult, disputeMatchResult, adminResolveMatch } from "../actions";
import { useRouter } from "next/navigation";

interface MatchCardProps {
  match: {
    id: string;
    playerAId: string;
    playerBId: string | null;
    playerA: { id: string; displayName: string };
    playerB: { id: string; displayName: string } | null;
    winnerPlayerId: string | null;
    winnerPlayer: { id: string; displayName: string } | null;
    status: string;
    roundLabel: string | null;
    rankingPointsA: number;
    rankingPointsB: number;
    notes: string | null;
    confirmations: Array<{ playerId: string; status: string }>;
  };
  currentPlayerId?: string;
  isAdmin: boolean;
}

export function MatchCard({ match, currentPlayerId, isAdmin }: MatchCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const isPlayerA = match.playerAId === currentPlayerId;
  const isPlayerB = match.playerBId === currentPlayerId;
  const isParticipant = isPlayerA || isPlayerB;

  const myConfirmation = match.confirmations.find(
    (c) => c.playerId === currentPlayerId
  );
  const opponentConfirmation = match.confirmations.find(
    (c) => c.playerId !== currentPlayerId
  );

  const statusColors: Record<string, string> = {
    PENDING_CONFIRMATION: "border-yellow-500/50 bg-yellow-500/5",
    CONFIRMED: "border-green-500/50 bg-green-500/5",
    DISPUTED: "border-red-500/50 bg-red-500/5",
    DRAFT: "border-slate-500/50",
    CANCELED: "border-slate-500/30 opacity-50",
  };

  const statusLabels: Record<string, string> = {
    PENDING_CONFIRMATION: "Pendente",
    CONFIRMED: "Confirmada",
    DISPUTED: "Disputada",
    DRAFT: "Rascunho",
    CANCELED: "Cancelada",
  };

  async function handleReport(winnerId: string) {
    setLoading(true);
    try {
      await reportMatchResult({ matchId: match.id, winnerId });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      await confirmMatchResult({ matchId: match.id });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleDispute() {
    if (!disputeReason.trim()) return;
    setLoading(true);
    try {
      await disputeMatchResult({ matchId: match.id, reason: disputeReason });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminResolve(winnerId: string) {
    setLoading(true);
    try {
      await adminResolveMatch({ matchId: match.id, winnerId });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all hover:shadow-lg ${
        statusColors[match.status] || "border-slate-700"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400">
          {match.roundLabel || "Partida"}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            match.status === "CONFIRMED"
              ? "bg-green-500/20 text-green-400"
              : match.status === "DISPUTED"
              ? "bg-red-500/20 text-red-400"
              : "bg-yellow-500/20 text-yellow-400"
          }`}
        >
          {statusLabels[match.status] || match.status}
        </span>
      </div>

      {/* Players */}
      <div className="flex items-center justify-between gap-2">
        <div className={`flex-1 text-center p-2 rounded-lg ${
          match.winnerPlayerId === match.playerAId
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-slate-800/50"
        }`}>
          <p className="font-semibold text-white text-sm">{match.playerA.displayName}</p>
          {match.status === "CONFIRMED" && (
            <p className="text-xs text-green-400 mt-1">+{match.rankingPointsA}pt</p>
          )}
        </div>

        <div className="text-slate-500 font-bold text-lg">VS</div>

        <div className={`flex-1 text-center p-2 rounded-lg ${
          match.winnerPlayerId === match.playerBId
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-slate-800/50"
        }`}>
          <p className="font-semibold text-white text-sm">
            {match.playerB?.displayName || "Bye"}
          </p>
          {match.status === "CONFIRMED" && match.playerBId && (
            <p className="text-xs text-green-400 mt-1">+{match.rankingPointsB}pt</p>
          )}
        </div>
      </div>

      {/* Confirmation status */}
      {match.confirmations.length > 0 && (
        <div className="mt-2 flex justify-center gap-3 text-xs">
          <span className={myConfirmation?.status === "CONFIRMED" ? "text-green-400" : "text-slate-500"}>
            {isParticipant ? "Você" : "Jogador A"}: {myConfirmation?.status === "CONFIRMED" ? "✓" : "○"}
          </span>
          <span className={opponentConfirmation?.status === "CONFIRMED" ? "text-green-400" : "text-slate-500"}>
            {isParticipant ? "Adversário" : "Jogador B"}: {opponentConfirmation?.status === "CONFIRMED" ? "✓" : "○"}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 space-y-2">
        {/* Reportar resultado */}
        {match.status === "PENDING_CONFIRMATION" &&
          isParticipant &&
          !match.winnerPlayerId && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-green-500/50 text-green-400 hover:bg-green-500/10"
                onClick={() => handleReport(match.playerAId)}
                disabled={loading}
              >
                Vitória {match.playerA.displayName}
              </Button>
              {match.playerBId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-green-500/50 text-green-400 hover:bg-green-500/10"
                  onClick={() => handleReport(match.playerBId)}
                  disabled={loading}
                >
                  Vitória {match.playerB.displayName}
                </Button>
              )}
            </div>
          )}

        {/* Confirmar / Contestar */}
        {match.status === "PENDING_CONFIRMATION" &&
          isParticipant &&
          match.winnerPlayerId &&
          match.reportedById !== currentPlayerId &&
          myConfirmation?.status !== "CONFIRMED" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={loading}
              >
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={() => setShowDispute(true)}
                disabled={loading}
              >
                Contestar
              </Button>
            </div>
          )}

        {showDispute && (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Motivo da contestação..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={handleDispute} disabled={loading}>
                Enviar Contestação
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowDispute(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Admin resolve */}
        {isAdmin && match.status === "DISPUTED" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => handleAdminResolve(match.playerAId)}
              disabled={loading}
            >
              Vitória {match.playerA.displayName}
            </Button>
            {match.playerBId && (
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => handleAdminResolve(match.playerBId)}
                disabled={loading}
              >
                Vitória {match.playerB.displayName}
              </Button>
            )}
          </div>
        )}
      </div>

      {match.notes && (
        <p className="mt-2 text-xs text-slate-500 italic">{match.notes}</p>
      )}
    </div>
  );
}
