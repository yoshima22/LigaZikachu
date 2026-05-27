import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import type { WeekMode } from "@/components/ui/poke/week-mode-badge";
import Link from "next/link";
import { ChevronRight, CalendarDays, Clock, Crown, Eye, Info, Lock, Swords } from "lucide-react";
import { computeTournamentWeekTopOfDay } from "@/lib/ranking";
import { RankingTable } from "@/components/ranking/ranking-table";
import {
  canSubmitTournamentWeekDeck,
  canViewTournamentWeekDecklist,
  getDeckVisibilityState
} from "@/lib/decks";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { DeckSubmissionForm } from "./_components/deck-submission-form";
import { applyTournamentWeekBonus, updateTournamentWeekSettings } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function WeekDetailPage({
  params
}: {
  params: Promise<{ slug: string; weekNumber: string }>;
}) {
  const { slug, weekNumber } = await params;
  const user = await getSessionUser();
  const admin = user ? isAdmin(user.role) : false;
  const weekNum = parseInt(weekNumber, 10);
  if (isNaN(weekNum)) notFound();

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true, seasonId: true }
  });
  if (!tournament) notFound();
  if (!admin && tournament.status === "DRAFT") notFound();

  const week = await prisma.tournamentWeek.findUnique({
    where: { tournamentId_weekNumber: { tournamentId: tournament.id, weekNumber: weekNum } },
    include: {
      deckSubmissions: {
        include: {
          player: {
            select: {
              id: true,
              displayName: true,
              ptcglNick: true
            }
          }
        },
        orderBy: [{ player: { displayName: "asc" } }, { deckNumber: "asc" }]
      }
    }
  });
  if (!week) notFound();

  const player = user
    ? await prisma.player.findUnique({
        where: { userId: user.id },
        select: { id: true }
      })
    : null;
  const registration = player
    ? await prisma.tournamentRegistration.findUnique({
        where: {
          tournamentId_playerId: {
            tournamentId: tournament.id,
            playerId: player.id
          }
        },
        select: { status: true }
      })
    : null;

  const topDoDiaRanking = await computeTournamentWeekTopOfDay(week.id);
  const deckVisibility = getDeckVisibilityState(week);

  const fmt = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "-";

  const bonusRule =
    week.bonusRule && typeof week.bonusRule === "object"
      ? (week.bonusRule as Record<string, unknown>)
      : null;

  const deckSlots = Math.min(
    Math.max(Number(bonusRule?.decksToSubmit ?? 1), 1),
    3
  );
  const currentPlayerDecks = player
    ? week.deckSubmissions.filter((submission) => submission.playerId === player.id)
    : [];
  const canSubmitDeck =
    !!user &&
    !!player &&
    canSubmitTournamentWeekDeck({
      viewerRole: user.role,
      registrationStatus: registration?.status ?? null,
      week
    });
  const visibleDecks = user
    ? week.deckSubmissions.filter((submission) =>
        canViewTournamentWeekDecklist({
          viewerRole: user.role,
          isOwner: submission.playerId === player?.id,
          registrationStatus: registration?.status ?? null,
          week
        })
      )
    : [];
  const approvedPlayers = admin
    ? await prisma.tournamentRegistration.findMany({
        where: { tournamentId: tournament.id, status: "APPROVED" },
        include: { player: { select: { id: true, displayName: true } } },
        orderBy: { player: { displayName: "asc" } }
      })
    : [];

  const positionBonus: Array<Record<string, unknown>> | null =
    bonusRule && Array.isArray(bonusRule.positionBonus)
      ? (bonusRule.positionBonus as Array<Record<string, unknown>>)
      : null;

  const statusConfig: Record<string, { label: string; cls: string }> = {
    PLANNED: { label: "Planejada", cls: "border-slate-500/30 bg-slate-500/10 text-slate-400" },
    OPEN: { label: "Aberta", cls: "border-[#7AC74C]/40 bg-[#7AC74C]/10 text-[#7AC74C]" },
    LOCKED: { label: "Bloqueada", cls: "border-[#F7D02C]/40 bg-[#F7D02C]/10 text-[#F7D02C]" },
    CLOSED: { label: "Encerrada", cls: "border-[#6390F0]/40 bg-[#6390F0]/10 text-[#6390F0]" }
  };
  const sc = statusConfig[week.status] ?? statusConfig.PLANNED;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="transition-colors hover:text-slate-300">Torneios</Link>
        <ChevronRight size={12} />
        <Link href={`/torneios/${slug}`} className="transition-colors hover:text-slate-300">
          {tournament.name}
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Semana {week.weekNumber}</span>
      </nav>

      <div className="rounded-2xl border border-border bg-slate-950/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Semana {week.weekNumber}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${sc.cls}`}>
                {sc.label}
              </span>
            </div>
            <h1 className="font-pixel text-base leading-snug text-white">
              {week.label ?? `Semana ${week.weekNumber}`}
            </h1>
          </div>
          <WeekModeBadge mode={week.mode as WeekMode} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border bg-slate-950/50 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-200">
            <CalendarDays size={16} className="text-[#FFCB05]" />
            Datas
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="mb-0.5 text-xs text-slate-500">Inicio</dt>
              <dd className="capitalize text-slate-200">{fmt(week.startDate)}</dd>
            </div>
            <div>
              <dt className="mb-0.5 text-xs text-slate-500">Fim</dt>
              <dd className="capitalize text-slate-200">{fmt(week.endDate)}</dd>
            </div>
            {week.lockAt && (
              <div>
                <dt className="mb-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={11} /> Bloqueio de resultados
                </dt>
                <dd className="capitalize text-slate-200">{fmt(week.lockAt)}</dd>
              </div>
            )}
            <div>
              <dt className="mb-0.5 flex items-center gap-1 text-xs text-slate-500">
                <Clock size={11} /> Fechamento de decklists
              </dt>
              <dd className="capitalize text-slate-200">{fmt(deckVisibility.deadline)}</dd>
              <p className="mt-1 text-xs text-slate-500">{deckVisibility.label}</p>
            </div>
          </dl>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-slate-950/50 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-200">
            <Info size={16} className="text-[#FFCB05]" />
            Regras do Modo
          </h2>
          {bonusRule ? (
            <div className="space-y-2 text-sm text-slate-300">
              {!!bonusRule.description && (
                <p className="text-slate-400">{String(bonusRule.description)}</p>
              )}
              {Number(week.multiplier) !== 1 && (
                <div className="flex items-center gap-2 rounded-lg border border-[#F7D02C]/20 bg-[#F7D02C]/5 px-3 py-2">
                  <span className="font-bold text-[#F7D02C]">{Number(week.multiplier)}x</span>
                  <span className="text-xs text-slate-400">multiplicador de pontos</span>
                </div>
              )}
              {!!bonusRule.extraPointsPerWin && (
                <div className="flex items-center gap-2 rounded-lg border border-[#7AC74C]/20 bg-[#7AC74C]/5 px-3 py-2">
                  <span className="font-bold text-[#7AC74C]">+{String(bonusRule.extraPointsPerWin)}pt</span>
                  <span className="text-xs text-slate-400">bonus por vitoria</span>
                </div>
              )}
              {!!bonusRule.winnerTeamBonus && (
                <div className="flex items-center gap-2 rounded-lg border border-[#EE8130]/20 bg-[#EE8130]/5 px-3 py-2">
                  <span className="font-bold text-[#EE8130]">+{String(bonusRule.winnerTeamBonus)}pt</span>
                  <span className="text-xs text-slate-400">bonus para o time vencedor</span>
                </div>
              )}
              {!!bonusRule.decksToSubmit && (
                <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                  Envie {String(bonusRule.decksToSubmit)} decks antes do prazo. O adversario escolhe qual voce usa.
                </div>
              )}
              {week.mode === "BATALHA_FINAL" && positionBonus && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">Bonus por posicao:</p>
                  {positionBonus.map((pb) => {
                    const positionsRaw = Array.isArray(pb.positions) ? pb.positions : [];
                    const positions: unknown[] = positionsRaw;
                    const bonusPerWin = typeof pb.bonusPerWin === "number" ? pb.bonusPerWin : 0;
                    const first = typeof positions[0] === "number" ? positions[0] : 0;
                    const last = typeof positions[positions.length - 1] === "number" ? positions[positions.length - 1] : first;
                    const firstNum = typeof first === "number" ? first : 0;
                    const lastNum = typeof last === "number" ? last : firstNum;
                    return (
                      <div key={String(firstNum)} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-slate-300">
                          {firstNum}-{lastNum}
                        </span>
                        <span className="text-slate-500">-&gt;</span>
                        <span className="font-semibold text-[#FFCB05]">+{bonusPerWin}pt/vitoria</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Formato padrao, sem restricoes especiais.
            </p>
          )}
          {week.notes && (
            <p className="border-t border-border pt-3 text-xs text-slate-500">{week.notes}</p>
          )}
          {admin && (
            <form
              className="border-t border-border pt-3"
              action={async (formData) => {
                "use server";
                await updateTournamentWeekSettings({
                  weekId: week.id,
                  label: week.label ?? "",
                  mode: week.mode,
                  status: week.status,
                  deckLockAt: week.deckLockAt?.toISOString() ?? "",
                  notes: String(formData.get("notes") ?? "")
                });
              }}
            >
              <label className="space-y-1 text-xs text-slate-400">
                <span>Editar explicacao manual do modo</span>
                <textarea
                  name="notes"
                  defaultValue={week.notes ?? ""}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded-lg bg-[#FFCB05] px-3 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700]"
              >
                Salvar explicacao
              </button>
            </form>
          )}
        </div>
      </div>

      {admin && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-5">
          <h2 className="mb-3 font-semibold text-slate-200">Bonus manual do modo de jogo</h2>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto]"
            action={async (formData) => {
              "use server";
              await applyTournamentWeekBonus({
                weekId: week.id,
                playerId: String(formData.get("playerId") ?? ""),
                points: Number(formData.get("points") ?? 0),
                reason: String(formData.get("reason") ?? "")
              });
            }}
          >
            <label className="space-y-1 text-xs text-slate-400">
              <span>Jogador</span>
              <select
                name="playerId"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              >
                {approvedPlayers.map((registration) => (
                  <option key={registration.playerId} value={registration.playerId}>
                    {registration.player.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Pontos</span>
              <input
                name="points"
                type="number"
                defaultValue={1}
                min={-50}
                max={50}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Motivo</span>
              <input
                name="reason"
                placeholder="Ex: bonus do modo especial"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={approvedPlayers.length === 0}
                className="w-full rounded-lg bg-[#FFCB05] px-3 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
              >
                Aplicar bonus
              </button>
            </div>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Use 0 para remover o bonus manual atual de um jogador neste dia.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-slate-950/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              {deckVisibility.locked ? (
                <Eye size={16} className="text-[#FFCB05]" />
              ) : (
                <Lock size={16} className="text-[#FFCB05]" />
              )}
              Decklists do Dia
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Antes do fechamento, cada jogador ve apenas a propria lista. Depois do fechamento, jogadores inscritos podem ver as listas uns dos outros.
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-slate-300">
            {deckVisibility.label}
          </span>
        </div>

        {!player && !admin ? (
          <p className="text-sm text-slate-500">
            Entre com uma conta de jogador para se inscrever e enviar decklist.
          </p>
        ) : registration?.status !== "APPROVED" && registration?.status !== "PENDING" && !admin ? (
          <p className="text-sm text-slate-500">
            Voce precisa estar inscrito neste torneio para enviar decklist deste dia.
          </p>
        ) : canSubmitDeck ? (
          <div className="space-y-3">
            {Array.from({ length: deckSlots }, (_, index) => {
              const deckNumber = index + 1;
              return (
                <DeckSubmissionForm
                  key={deckNumber}
                  tournamentWeekId={week.id}
                  deckNumber={deckNumber}
                  existingSubmission={
                    currentPlayerDecks.find((deck) => deck.deckNumber === deckNumber) ?? null
                  }
                />
              );
            })}
          </div>
        ) : currentPlayerDecks.length === 0 && !admin ? (
          <p className="text-sm text-slate-500">
            O prazo de envio de decklist ja foi encerrado para este dia.
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {visibleDecks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-slate-500">
              Nenhuma decklist visivel para voce neste momento.
            </p>
          ) : (
            visibleDecks.map((submission) => (
              <div
                key={submission.id}
                className="rounded-xl border border-border bg-slate-900/40 p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {submission.player.displayName}
                      {submission.deckNumber > 1 ? ` - Deck ${submission.deckNumber}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {submission.deckName}
                      {submission.archetype ? ` - ${submission.archetype}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-slate-400">
                    {submission.status}
                  </span>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300">
                  {submission.deckList}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-slate-950/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              <Crown size={16} className="text-[#FFCB05]" />
              Top do Dia
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Previa calculada somente com partidas validadas desta semana/dia.
            </p>
          </div>
          <Link
            href={`/torneios/${slug}/semanas/${weekNum}/partidas`}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5"
          >
            Validar resultados
          </Link>
        </div>

        {topDoDiaRanking.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum resultado validado neste dia ainda. O Top do Dia so deve ser calculado depois da validacao.
          </p>
        ) : (
          <RankingTable ranking={topDoDiaRanking} compact />
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-slate-900/20 px-6 py-8 text-center">
        <Swords className="mx-auto mb-2 h-8 w-8 text-[#FFCB05]" />
        <p className="mb-3 text-sm text-slate-400">Veja as partidas desta semana</p>
        <Link
          href={`/torneios/${slug}/semanas/${weekNum}/partidas`}
          className="inline-flex items-center gap-1 rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E] transition-colors hover:bg-[#FFD700]"
        >
          Ver Partidas
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
