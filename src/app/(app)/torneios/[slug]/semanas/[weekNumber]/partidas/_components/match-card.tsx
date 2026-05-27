"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reportMatchResult, confirmMatchResult, disputeMatchResult, adminResolveMatch } from "../actions";
import { useRouter } from "next/navigation";

interface PlayerDeckSummary {
  deckNumber: number;
  deckName: string;
  archetype: string | null;
  deckList: string;
}

interface MatchCardProps {
  match: {
    id: string;
    playerAId: string;
    playerBId: string | null;
    playerA: { id: string; displayName: string };
    playerB: { id: string; displayName: string };
    winnerPlayerId: string | null;
    winnerPlayer: { id: string; displayName: string } | null;
    status: string;
    roundLabel: string | null;
    rankingPointsA: number;
    rankingPointsB: number;
    winnerDefendedPrizes: number;
    reportedById: string | null;
    notes: string | null;
    confirmations: Array<{ playerId: string; status: string }>;
    playerADecks: PlayerDeckSummary[];
    playerBDecks: PlayerDeckSummary[];
  };
  currentPlayerId?: string;
  isAdmin: boolean;
  tournamentFormat?: string;
  canReportResult?: boolean;
}

export function MatchCard({ match, currentPlayerId, isAdmin, tournamentFormat, canReportResult }: MatchCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [winnerDefendedPrizes, setWinnerDefendedPrizes] = useState(
    String(match.winnerDefendedPrizes ?? 0)
  );

  const isPlayerA = match.playerAId === currentPlayerId;
  const isPlayerB = match.playerBId === currentPlayerId;
  const isParticipant = isPlayerA || isPlayerB;
  const isInPerson = tournamentFormat === "IN_PERSON";
  const canReport = isParticipant || isAdmin || !!canReportResult;

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
      await reportMatchResult({
        matchId: match.id,
        winnerId,
        winnerDefendedPrizes: Number(winnerDefendedPrizes) || 0
      });
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

  function DeckBadges({ decks }: { decks: PlayerDeckSummary[] }) {
    if (decks.length === 0) {
      return <p className="mt-1 text-[10px] text-slate-500">Deck oculto</p>;
    }

    return (
      <div className="mt-2 space-y-1">
        {decks.map((deck) => {
          const subtitle = deck.archetype ? " - " + deck.archetype : "";

          return (
            <details key={deck.deckNumber} className="rounded-md border border-slate-700/70 bg-slate-950/70 px-2 py-1 text-left">
              <summary className="cursor-pointer text-[10px] font-semibold text-[#FFCB05]">
                Deck {deck.deckNumber}: {deck.deckName}{subtitle}
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300">
                {deck.deckList}
              </pre>
            </details>
          );
        })}
      </div>
    );
  }

  async function handleAdminResolve(winnerId: string) {
    setLoading(true);
    try {
      await adminResolveMatch({
        matchId: match.id,
        winnerId,
        winnerDefendedPrizes: Number(winnerDefendedPrizes) || 0
      });
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
          <DeckBadges decks={match.playerADecks} />
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
          {match.playerBId && <DeckBadges decks={match.playerBDecks} />}
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
          canReport &&
          !match.winnerPlayerId && (
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Premios defendidos pelo vencedor
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={winnerDefendedPrizes}
                onChange={(event) => setWinnerDefendedPrizes(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
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
                  onClick={() => match.playerBId && handleReport(match.playerBId)}
                  disabled={loading}
                >
                  Vitória {match.playerB.displayName}
                </Button>
              )}
              </div>
            </div>
          )}

        {/* Confirmar / Contestar */}
        {match.status === "PENDING_CONFIRMATION" &&
          isParticipant &&
          match.winnerPlayerId &&
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

        {isInPerson && match.status === "PENDING_CONFIRMATION" && match.winnerPlayerId && (
          <p className="rounded-lg border border-[#FFCB05]/20 bg-[#FFCB05]/10 px-3 py-2 text-xs text-[#FFCB05]">
            Torneio presencial: o resultado e finalizado no primeiro reporte.
          </p>
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
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Premios defendidos pelo vencedor
            </label>
            <input
              type="number"
              min={0}
              max={99}
              value={winnerDefendedPrizes}
              onChange={(event) => setWinnerDefendedPrizes(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
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
                onClick={() => match.playerBId && handleAdminResolve(match.playerBId)}
                disabled={loading}
              >
                Vitória {match.playerB.displayName}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {match.winnerPlayerId && (
        <p className="mt-2 text-xs text-slate-400">
          Premios defendidos pelo vencedor:{" "}
          <span className="font-semibold text-[#FFCB05]">{match.winnerDefendedPrizes}</span>
        </p>
      )}

      {match.notes && (
        <p className="mt-2 text-xs text-slate-500 italic">{match.notes}</p>
      )}
    </div>
  );
}
