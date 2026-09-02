"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { chooseMatchDeck, correctMatchResult, reportMatchResult, confirmMatchResult, disputeMatchResult, adminResolveMatch, declareEnguicaContractCompletion, adminSetEnguicaCompletion, updateMatchSchedule } from "../actions";
import { CopyDeckButton } from "@/components/ui/copy-deck-button";
import { useRouter } from "next/navigation";
import { Award, CalendarClock, PawPrint, ShieldCheck } from "lucide-react";
import { validateGymDeckSubmission } from "@/app/(app)/torneios/actions";
import { SpecMatchControl } from "@/components/spec/spec-match-control";

interface PlayerDeckSummary {
  id: string;
  deckNumber: number;
  deckName: string;
  archetype: string | null;
  deckList: string;
  gymBadgeId: string | null;
  gymBadgeName: string | null;
  gymBadgeValid: boolean | null;
}

interface PublicDeckIntent {
  id: string;
  deckName: string;
  mascotMissionMascotName: string | null;
  mascotMissionPokemonId: number | null;
  mascotMissionSpriteUrl: string | null;
  mascotMissionValid: boolean | null;
  gymBadgeId: string | null;
  gymBadgeName: string | null;
  gymBadgeValid: boolean | null;
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
    scheduledAt: string;
    weekStartDate: string;
    weekEndDate: string;
    roundLabel: string | null;
    rankingPointsA: number;
    rankingPointsB: number;
    winnerDefendedPrizes: number;
    playerADeckSubmissionId: string | null;
    playerBDeckSubmissionId: string | null;
    reportedById: string | null;
    notes: string | null;
    confirmations: Array<{ playerId: string; status: string }>;
    enguicaCompletionPlayerIds: string[];
    playerADecks: PlayerDeckSummary[];
    playerBDecks: PlayerDeckSummary[];
    currentPlayerDecks: PlayerDeckSummary[];
    playerAIntent: PublicDeckIntent | null;
    playerBIntent: PublicDeckIntent | null;
  };
  currentPlayerId?: string;
  isAdmin: boolean;
  deckSelectionLocked?: boolean;
  // Mostra os apontamentos (insígnia/mascote) do deck. Só quando os decks já são
  // públicos para todos, ou para staff (admin/gamemaster), que veem antes.
  showDeckIntent?: boolean;
  tournamentFormat?: string;
  canReportResult?: boolean;
  specEnabled?: boolean;
  enguicaContract?: {
    key: string;
    title: string;
    description: string;
    myCompletionMatchId: string | null;
    weekClosed: boolean;
  } | null;
}

function toBrtDateTimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatBrtSchedule(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MatchCard({ match, currentPlayerId, isAdmin, deckSelectionLocked = false, showDeckIntent = false, tournamentFormat, canReportResult, specEnabled, enguicaContract }: MatchCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => toBrtDateTimeLocal(match.scheduledAt));
  const [winnerDefendedPrizes, setWinnerDefendedPrizes] = useState(
    String(match.winnerDefendedPrizes ?? 0)
  );
  const [enguicaContractCompleted, setEnguicaContractCompleted] = useState(
    enguicaContract?.myCompletionMatchId === match.id,
  );
  const [opponentGymBadgeValid, setOpponentGymBadgeValid] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState(() => {
    if (match.playerAId === currentPlayerId) return match.playerADeckSubmissionId ?? "";
    if (match.playerBId === currentPlayerId) return match.playerBDeckSubmissionId ?? "";
    return "";
  });

  const isPlayerA = match.playerAId === currentPlayerId;
  const isPlayerB = match.playerBId === currentPlayerId;
  const isParticipant = isPlayerA || isPlayerB;
  const isInPerson = tournamentFormat === "IN_PERSON";
  const canReport = isParticipant || isAdmin || !!canReportResult;
  const canEditSchedule = isParticipant || isAdmin;
  const opponentIntent = isPlayerA ? match.playerBIntent : isPlayerB ? match.playerAIntent : null;

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
        winnerDefendedPrizes: Number(winnerDefendedPrizes) || 0,
        enguicaContractCompleted,
        opponentGymBadgeValid: opponentIntent?.gymBadgeId ? opponentGymBadgeValid : undefined,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      await confirmMatchResult({
        matchId: match.id,
        enguicaContractCompleted,
        opponentGymBadgeValid: opponentIntent?.gymBadgeId ? opponentGymBadgeValid : undefined,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleScheduleUpdate() {
    if (!scheduledAt) return;
    setLoading(true);
    try {
      const res = await updateMatchSchedule({
        matchId: match.id,
        scheduledAt: new Date(`${scheduledAt}:00-03:00`).toISOString(),
      });
      if (res?.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao atualizar horário");
    } finally {
      setLoading(false);
    }
  }

  // Marca/desmarca a conclusão do contrato de um jogador específico. Admin pode
  // ambos; um participante marca só a própria (via declaração).
  async function handleTogglePlayerContract(playerId: string, completed: boolean) {
    setLoading(true);
    try {
      if (isAdmin) await adminSetEnguicaCompletion(match.id, playerId, completed);
      else await declareEnguicaContractCompletion(match.id);
      if (playerId === currentPlayerId) setEnguicaContractCompleted(completed);
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

  function DeckBadges({ decks, selectedDeckId }: { decks: PlayerDeckSummary[]; selectedDeckId?: string | null }) {
    // Mostra APENAS o deck vinculado a esta partida específica
    const linkedDeck = selectedDeckId ? decks.find(d => d.id === selectedDeckId) : null;

    // Se tem deck vinculado, mostra só ele
    if (linkedDeck) {
      return (
        <div className="mt-2 w-full overflow-hidden">
          <details className="w-full overflow-hidden rounded-md border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-2 py-1 text-left">
            <summary className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-[#FFCB05]">
              <span className="min-w-0 flex-1 truncate">
                {linkedDeck.deckName}
                {linkedDeck.archetype ? <span className="text-[#FFCB05]/60"> · {linkedDeck.archetype}</span> : null}
              </span>
              <span className="shrink-0"><CopyDeckButton deckList={linkedDeck.deckList} /></span>
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300">
              {linkedDeck.deckList}
            </pre>
            {linkedDeck.gymBadgeName && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#FFCB05]/20 pt-2 text-[10px]">
                <span className={linkedDeck.gymBadgeValid === true ? "text-emerald-300" : linkedDeck.gymBadgeValid === false ? "text-red-300" : "text-amber-300"}>
                  Jornada: {linkedDeck.gymBadgeName} · {linkedDeck.gymBadgeValid === true ? "deck valido" : linkedDeck.gymBadgeValid === false ? "deck invalido" : "aguardando revisao"}
                </span>
                {isAdmin && linkedDeck.gymBadgeValid !== true && (
                  <button type="button" className="rounded border border-emerald-400/30 px-2 py-0.5 text-emerald-300" onClick={async () => { await validateGymDeckSubmission({ submissionId: linkedDeck.id, valid: true }); router.refresh(); }}>
                    Validar
                  </button>
                )}
                {isAdmin && linkedDeck.gymBadgeValid !== false && (
                  <button type="button" className="rounded border border-red-400/30 px-2 py-0.5 text-red-300" onClick={async () => { await validateGymDeckSubmission({ submissionId: linkedDeck.id, valid: false }); router.refresh(); }}>
                    Invalidar
                  </button>
                )}
              </div>
            )}
          </details>
        </div>
      );
    }

    // Se tem decks mas nenhum vinculado a esta partida
    if (decks.length > 0) {
      return <p className="mt-1 text-[10px] text-amber-500/80">Deck não selecionado</p>;
    }

    // Nenhum deck enviado
    return <p className="mt-1 text-[10px] text-slate-500">Deck oculto</p>;
  }

  function hasIntent(intent: PublicDeckIntent | null): boolean {
    return Boolean(intent?.gymBadgeId || intent?.mascotMissionMascotName);
  }

  // Card de apontamentos (insígnia/mascote) de UM jogador, em largura total —
  // fora das colunas estreitas, para o texto não transbordar. Ícone em slot fixo,
  // rótulo + valor (com truncate) alinhados.
  function DeckIntent({ playerName, intent }: { playerName: string; intent: PublicDeckIntent | null }) {
    if (!hasIntent(intent) || !intent) return null;
    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/60 text-left">
        {/* Cabeçalho de largura total — agrupa tudo do jogador dentro do mesmo card. */}
        <div className="border-b border-white/10 bg-white/[0.06] px-3 py-1.5">
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-300">{playerName}</p>
        </div>
        <div className="grid gap-1.5 p-2">
          {intent.gymBadgeId && (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-amber-400/15">
                <Award size={18} className="text-amber-300" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300">Jornada de Ginásio</p>
                <p className="truncate text-xs font-semibold text-amber-50">{intent.gymBadgeName}</p>
                <p className="text-[9px] text-amber-200/70">{intent.gymBadgeValid === true ? "Confirmada" : intent.gymBadgeValid === false ? "Marcada como inválida" : "Aguardando confirmação"}</p>
              </div>
            </div>
          )}
          {intent.mascotMissionMascotName && (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-400/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {intent.mascotMissionSpriteUrl ? <img src={intent.mascotMissionSpriteUrl} alt="" className="h-7 w-7 object-contain" /> : <PawPrint size={18} className="text-emerald-300" />}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Missão de Mascote</p>
                <p className="truncate text-xs font-semibold text-emerald-50">{intent.mascotMissionMascotName}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  async function handleDeckChoice(applyToWeek: boolean) {
    if (!selectedDeckId) return;
    setLoading(true);
    try {
      await chooseMatchDeck({
        matchId: match.id,
        deckSubmissionId: selectedDeckId,
        applyToWeek
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleCorrect(winnerId: string) {
    setLoading(true);
    try {
      await correctMatchResult({
        matchId: match.id,
        winnerId,
        winnerDefendedPrizes: Number(winnerDefendedPrizes) || 0,
        notes: "Resultado corrigido pelo app"
      });
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
      <div className="mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
          <CalendarClock size={12} /> Data e horário da partida
        </div>
        {canEditSchedule ? (
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
            <Button size="sm" variant="outline" onClick={handleScheduleUpdate} disabled={loading || !scheduledAt}>
              Salvar
            </Button>
          </div>
        ) : (
          <p className="text-xs font-semibold text-slate-200">{formatBrtSchedule(match.scheduledAt)}</p>
        )}
      </div>

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
        <div className={`flex-1 min-w-0 text-center p-2 rounded-lg ${
          match.winnerPlayerId === match.playerAId
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-slate-800/50"
        }`}>
          <p className="font-semibold text-white text-sm truncate">{match.playerA.displayName}</p>
          <DeckBadges decks={match.playerADecks} selectedDeckId={match.playerADeckSubmissionId} />
          {match.status === "CONFIRMED" && (
            <p className="text-xs text-green-400 mt-1">+{match.rankingPointsA}pt</p>
          )}
        </div>

        <div className="text-slate-500 font-bold text-lg">VS</div>

        <div className={`flex-1 min-w-0 text-center p-2 rounded-lg ${
          match.winnerPlayerId === match.playerBId
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-slate-800/50"
        }`}>
          <p className="font-semibold text-white text-sm truncate">
            {match.playerB?.displayName || "Bye"}
          </p>
          {match.playerBId && <DeckBadges decks={match.playerBDecks} selectedDeckId={match.playerBDeckSubmissionId} />}
          {match.status === "CONFIRMED" && match.playerBId && (
            <p className="text-xs text-green-400 mt-1">+{match.rankingPointsB}pt</p>
          )}
        </div>
      </div>

      {/* Apontamentos de deck (insígnia/mascote) — largura total, fora das colunas
          estreitas, para o texto não transbordar. */}
      {showDeckIntent && (hasIntent(match.playerAIntent) || hasIntent(match.playerBIntent)) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <DeckIntent playerName={match.playerA.displayName} intent={match.playerAIntent} />
          {match.playerBId && <DeckIntent playerName={match.playerB?.displayName ?? "Bye"} intent={match.playerBIntent} />}
        </div>
      )}

      {/* Modo SPEC: transmissão ao vivo desta partida (só aparece se ativado) */}
      {specEnabled && match.playerBId && <SpecMatchControl matchId={match.id} canBroadcast={isParticipant || isAdmin} />}

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
        {isParticipant && showDeckIntent && opponentIntent?.gymBadgeId && match.status === "PENDING_CONFIRMATION" && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
            <div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-300"/><div><p className="text-xs font-bold text-amber-100">Confirmação da Jornada adversária</p><p className="mt-1 text-[10px] leading-4 text-slate-400">O deck de {isPlayerA ? match.playerB.displayName : match.playerA.displayName} está buscando <b className="text-amber-200">{opponentIntent.gymBadgeName}</b>. Sua declaração será considerada válida, a menos que a organização faça uma correção.</p></div></div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-200"><input type="checkbox" checked={opponentGymBadgeValid} onChange={(event)=>setOpponentGymBadgeValid(event.target.checked)} className="h-4 w-4 accent-amber-400"/><span>Confirmo que o deck adversário conta para esta insígnia</span></label>
          </div>
        )}
        {isParticipant && !deckSelectionLocked && match.currentPlayerDecks.length > 0 && (
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Deck para esta partida
            </label>
            <select
              value={selectedDeckId}
              onChange={(event) => setSelectedDeckId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white"
            >
              <option value="">Escolher deck</option>
              {/* Deduplica por deckName+archetype — mantém apenas um de cada deck único */}
              {Array.from(
                new Map(
                  match.currentPlayerDecks.map(d => [
                    `${d.deckName}||${d.archetype ?? ""}`,
                    d
                  ])
                ).values()
              ).map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.deckName}
                  {deck.archetype ? ` · ${deck.archetype}` : ""}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="sm" variant="outline" onClick={() => handleDeckChoice(false)} disabled={loading || !selectedDeckId}>
                Usar neste jogo
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDeckChoice(true)} disabled={loading || !selectedDeckId}>
                Usar em todos do dia
              </Button>
            </div>
          </div>
        )}

        {enguicaContract && (
          <div className="space-y-2 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">📋 Contrato: {enguicaContract.title}</p>
            <p className="text-[11px] leading-5 text-slate-400">{enguicaContract.description}</p>
            {/* Cada jogador tem a sua própria marcação de conclusão do contrato. */}
            <div className="grid gap-1.5">
              {([
                { id: match.playerAId, name: match.playerA.displayName },
                ...(match.playerBId ? [{ id: match.playerBId, name: match.playerB.displayName }] : []),
              ] as { id: string; name: string }[]).map((pl) => {
                const done = match.enguicaCompletionPlayerIds.includes(pl.id);
                const isMe = currentPlayerId === pl.id;
                const completedElsewhere = isMe && Boolean(enguicaContract.myCompletionMatchId) && enguicaContract.myCompletionMatchId !== match.id;
                const canToggle = !enguicaContract.weekClosed && (isAdmin || (isMe && !done && !completedElsewhere));
                return (
                  <label key={pl.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${done ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-200" : "border-slate-700 bg-slate-950/40 text-slate-300"} ${canToggle ? "cursor-pointer" : "cursor-default"}`}>
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={!canToggle || loading}
                      onChange={(event) => handleTogglePlayerContract(pl.id, event.target.checked)}
                      className="h-4 w-4 accent-cyan-400 disabled:opacity-60"
                    />
                    <span className="min-w-0 flex-1 truncate">{pl.name}{isMe ? " (você)" : ""}</span>
                    {done && <span className="shrink-0 font-semibold text-emerald-300">Concluído ✓</span>}
                    {completedElsewhere && <span className="shrink-0 text-[10px] font-semibold text-cyan-300">Registrado em outra partida</span>}
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500">Cada jogador marca a própria conclusão. Só vale se o resultado ficar confirmado; o pagamento ocorre no encerramento do dia.</p>
          </div>
        )}

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
              <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                variant="outline"
                className="min-w-0 flex-1 whitespace-normal border-green-500/50 text-green-400 hover:bg-green-500/10"
                onClick={() => handleReport(match.playerAId)}
                disabled={loading}
              >
                <span className="truncate">Vitória {match.playerA.displayName}</span>
              </Button>
              {match.playerBId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-w-0 flex-1 whitespace-normal border-green-500/50 text-green-400 hover:bg-green-500/10"
                  onClick={() => match.playerBId && handleReport(match.playerBId)}
                  disabled={loading}
                >
                  <span className="truncate">Vitória {match.playerB.displayName}</span>
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

        {canReport && match.winnerPlayerId && match.status !== "CANCELED" && (
          <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
              Corrigir resultado
            </p>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Premios defendidos corrigidos
            </label>
            <input
              type="number"
              min={0}
              max={99}
              value={winnerDefendedPrizes}
              onChange={(event) => setWinnerDefendedPrizes(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" variant="outline" className="min-w-0 flex-1 whitespace-normal border-amber-500/40 text-amber-300 hover:bg-amber-500/10" onClick={() => handleCorrect(match.playerAId)} disabled={loading}>
                <span className="truncate">Corrigir: {match.playerA.displayName}</span>
              </Button>
              {match.playerBId && (
                <Button size="sm" variant="outline" className="min-w-0 flex-1 whitespace-normal border-amber-500/40 text-amber-300 hover:bg-amber-500/10" onClick={() => match.playerBId && handleCorrect(match.playerBId)} disabled={loading}>
                  <span className="truncate">Corrigir: {match.playerB.displayName}</span>
                </Button>
              )}
            </div>
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
