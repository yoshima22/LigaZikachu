import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { Award, ChevronRight, Shield, Swords, Zap } from "lucide-react";
import { ChallengeStatus, ChallengeType } from "@prisma/client";
import { parseChallengeConfig, DEFAULT_CHALLENGE_CONFIG } from "./actions";
import { ChallengePanel } from "./_components/challenge-panel";

export const dynamic = "force-dynamic";

const statusLabels: Record<ChallengeStatus, { label: string; cls: string }> = {
  OPEN:         { label: "Aberto",    cls: "text-[#F7D02C] border-[#F7D02C]/40 bg-[#F7D02C]/10" },
  UNDER_REVIEW: { label: "Em análise", cls: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
  ACCEPTED:     { label: "Aprovado",  cls: "text-[#7AC74C] border-[#7AC74C]/40 bg-[#7AC74C]/10" },
  REJECTED:     { label: "Encerrado", cls: "text-slate-400 border-slate-400/30 bg-slate-400/10" },
  RESOLVED:     { label: "Concluído", cls: "text-[#6390F0] border-[#6390F0]/40 bg-[#6390F0]/10" }
};

export default async function DesafiosPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const admin = isAdmin(user.role);

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      challengeConfig: true,
      createdById: true,
      badges: {
        include: {
          owners: {
            include: { player: { select: { id: true, displayName: true } } }
          },
          progress: {
            include: { player: { select: { id: true, displayName: true } } },
            orderBy: { points: "desc" }
          },
          challenges: {
            where: { status: { in: [ChallengeStatus.OPEN, ChallengeStatus.UNDER_REVIEW, ChallengeStatus.ACCEPTED] } },
            include: {
              challenger: { select: { id: true, displayName: true } }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      challenges: {
        orderBy: { openedAt: "desc" },
        take: 50,
        include: {
          challenger: { select: { id: true, displayName: true } },
          challenged: { select: { id: true, displayName: true } },
          badge: { select: { id: true, name: true, imageUrl: true } },
          tournamentWeek: { select: { weekNumber: true, label: true } }
        }
      },
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: { id: true, weekNumber: true, label: true, status: true }
      },
      registrations: {
        where: { status: "APPROVED" },
        include: { player: { select: { id: true, displayName: true } } },
        orderBy: { player: { displayName: "asc" } }
      }
    }
  });

  if (!tournament) notFound();
  const canManage = admin || tournament.createdById === user.id;
  if (!canManage && tournament.status === "DRAFT") notFound();

  const config = parseChallengeConfig(tournament.challengeConfig ?? DEFAULT_CHALLENGE_CONFIG);
  const challengesEnabled = config.badgeChallenge || config.freeChallenge;

  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true }
  });

  const myRegistration = player
    ? await prisma.tournamentRegistration.findUnique({
        where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: player.id } },
        select: { status: true }
      })
    : null;

  const isParticipant = myRegistration?.status === "APPROVED";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="hover:text-slate-300">Torneios</Link>
        <ChevronRight size={12} />
        <Link href={`/torneios/${slug}`} className="hover:text-slate-300">{tournament.name}</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Desafios</span>
      </nav>

      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Sistema de Desafios</p>
            <h1 className="mt-1 font-pixel text-base text-[#FFCB05]">{tournament.name}</h1>
          </div>
          {canManage && (
            <Link
              href={`/torneios/${slug}/admin`}
              className="rounded-lg border border-[#FFCB05]/30 px-3 py-1.5 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/10"
            >
              Configurar Desafios
            </Link>
          )}
        </div>

        {/* Regras resumidas */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {config.badgeChallenge && (
            <div className="rounded-xl border border-[#FFCB05]/20 bg-slate-950/40 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#FFCB05]">
                <Award size={12} /> Desafio por Insígnia
              </p>
              <p className="text-xs text-slate-400">
                Acumule <strong className="text-white">{config.pointsToChallenge} pontos</strong> em uma insígnia para desafiar o dono.
                Vencer dá a insígnia (+<strong className="text-white">{config.pointsPerBadge}pt</strong> no ranking).
                Perder aplica <strong className="text-red-400">−{config.challengerPenalty}pt</strong>.
              </p>
            </div>
          )}
          {config.freeChallenge && (
            <div className="rounded-xl border border-blue-400/20 bg-slate-950/40 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                <Zap size={12} /> Desafio Livre
              </p>
              <p className="text-xs text-slate-400">
                Desafie qualquer jogador mesmo sem insígnia envolvida. Regras e efeitos definidos pelo torneio.
              </p>
            </div>
          )}
          <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Shield size={12} /> Limite de Desafios
            </p>
            <p className="text-xs text-slate-400">
              Cada jogador pode ser desafiado no máximo{" "}
              <strong className="text-white">{config.maxChallengesReceivedPerWeek}x por semana</strong>.
              Prioridade: quem fez menos desafios no torneio.
            </p>
          </div>
        </div>
      </div>

      {!challengesEnabled && !canManage && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-8 text-center">
          <Swords size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Desafios não estão habilitados neste torneio.</p>
        </div>
      )}

      {!challengesEnabled && canManage && (
        <div className="rounded-xl border border-dashed border-[#FFCB05]/30 bg-[#FFCB05]/5 p-6 text-center">
          <Award size={28} className="mx-auto mb-2 text-[#FFCB05]" />
          <p className="mb-3 text-sm text-slate-300">Configure os tipos de desafio no painel admin.</p>
          <Link
            href={`/torneios/${slug}/admin`}
            className="rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E]"
          >
            Ir para configurações
          </Link>
        </div>
      )}

      {/* Quadro de insígnias */}
      {tournament.badges.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-200">
            <Award size={16} className="text-[#FFCB05]" />
            Insígnias e Progresso
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tournament.badges.map((badge) => {
              const owner = badge.owners[0];
              const activeChallenges = badge.challenges;
              return (
                <div key={badge.id} className="rounded-xl border border-border bg-slate-950/50 overflow-hidden">
                  {/* Header da insígnia */}
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    {badge.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={badge.imageUrl} alt={badge.name} className="h-9 w-9 rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFCB05]/10">
                        <Award size={18} className="text-[#FFCB05]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{badge.name}</p>
                      {owner ? (
                        <p className="text-xs text-[#FFCB05]">
                          Dono: <Link href={`/jogadores/${owner.playerId}`} className="hover:underline">{owner.player.displayName}</Link>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">Sem dono — em disputa</p>
                      )}
                    </div>
                  </div>

                  {/* Progresso dos jogadores */}
                  {badge.progress.length > 0 && (
                    <div className="px-4 py-2">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Pontuação na Insígnia</p>
                      <div className="space-y-1">
                        {badge.progress.slice(0, 5).map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{p.player.displayName}</span>
                            <span className={`font-bold ${p.points >= config.pointsToChallenge ? "text-[#FFCB05]" : "text-slate-400"}`}>
                              {p.points}pt
                              {p.points >= config.pointsToChallenge && (
                                <span className="ml-1 text-[10px] text-[#7AC74C]">✓ pode desafiar</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Desafios ativos */}
                  {activeChallenges.length > 0 && (
                    <div className="border-t border-border px-4 py-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Desafios Abertos</p>
                      {activeChallenges.map((c) => (
                        <p key={c.id} className="text-xs text-slate-400">
                          <span className="text-white">{c.challenger.displayName}</span>
                          {" "}está desafiando o dono
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Painel interativo (criar desafio, admin manage) */}
      <ChallengePanel
        tournamentId={tournament.id}
        tournamentSlug={slug}
        config={config}
        challengesEnabled={challengesEnabled}
        isParticipant={isParticipant}
        isAdmin={canManage}
        playerId={player?.id ?? null}
        playerDisplayName={player?.displayName ?? null}
        approvedPlayers={tournament.registrations.map((r) => ({
          id: r.player.id,
          displayName: r.player.displayName
        }))}
        badges={tournament.badges.map((b) => ({
          id: b.id,
          name: b.name,
          imageUrl: b.imageUrl,
          ownerId: b.owners[0]?.playerId ?? null,
          ownerName: b.owners[0]?.player.displayName ?? null,
          myProgress: b.progress.find((p) => p.playerId === player?.id)?.points ?? 0
        }))}
        weeks={tournament.weeks}
        challenges={tournament.challenges.map((c) => ({
          id: c.id,
          type: c.type,
          status: c.status,
          reason: c.reason,
          resolutionNotes: c.resolutionNotes ?? null,
          openedAt: c.openedAt.toISOString(),
          resolvedAt: c.resolvedAt?.toISOString() ?? null,
          challenger: c.challenger,
          challenged: c.challenged,
          badge: c.badge ?? null,
          week: c.tournamentWeek ? { weekNumber: c.tournamentWeek.weekNumber, label: c.tournamentWeek.label } : null,
          isMyChallenge: c.challenger.id === player?.id
        }))}
      />
    </div>
  );
}
