import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import type { WeekMode } from "@/components/ui/poke/week-mode-badge";
import { TrainerAvatar } from "@/components/ui/poke/trainer-avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarDays, Users, ChevronRight, Settings, Trophy } from "lucide-react";
import type { RegistrationStatus } from "@prisma/client";
import { RegisterButton } from "./_components/register-button";

export default async function TorneioDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();
  const admin = isAdmin(user.role);

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      weeks: { orderBy: { weekNumber: "asc" } },
      registrations: {
        include: {
          player: {
            include: { user: { select: { image: true } } }
          }
        },
        orderBy: { registeredAt: "asc" }
      }
    }
  });

  if (!tournament) notFound();

  const player = await prisma.player.findUnique({ where: { userId: user.id } });
  let myRegistration: { status: RegistrationStatus } | null = null;
  if (player) {
    myRegistration = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: player.id } },
      select: { status: true }
    });
  }

  const approved = tournament.registrations.filter((r) => r.status === "APPROVED");

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const statusColors: Record<string, string> = {
    DRAFT:             "bg-slate-500/15 text-slate-400 border-slate-500/30",
    REGISTRATION_OPEN: "bg-[#7AC74C]/15 text-[#7AC74C] border-[#7AC74C]/40",
    IN_PROGRESS:       "bg-[#F7D02C]/15 text-[#F7D02C] border-[#F7D02C]/40",
    FINISHED:          "bg-[#6390F0]/15 text-[#6390F0] border-[#6390F0]/40"
  };
  const statusLabels: Record<string, string> = {
    DRAFT:             "Rascunho",
    REGISTRATION_OPEN: "Inscrições abertas",
    IN_PROGRESS:       "Em andamento",
    FINISHED:          "Encerrado"
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="hover:text-slate-300 transition-colors">Torneios</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">{tournament.name}</span>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950/70 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#735797]/10 via-transparent to-[#FFCB05]/5 pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            {tournament.edition && (
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">{tournament.edition}</p>
            )}
            <h1 className="font-pixel text-base leading-snug text-white sm:text-lg">
              {tournament.name}
            </h1>
            {tournament.description && (
              <p className="mt-2 max-w-xl text-sm text-slate-400">{tournament.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColors[tournament.status]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabels[tournament.status]}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <CalendarDays size={12} />
                {fmt(tournament.startDate)} – {fmt(tournament.endDate)}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Users size={12} />
                {approved.length}{tournament.maxPlayers ? `/${tournament.maxPlayers}` : ""} inscritos
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {admin && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/torneios/${slug}/inscricoes`}>
                  <Settings size={14} className="mr-1" />
                  Gerenciar
                </Link>
              </Button>
            )}
            <RegisterButton
              tournamentId={tournament.id}
              tournamentStatus={tournament.status}
              myRegistrationStatus={myRegistration?.status ?? null}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Semanas */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <CalendarDays size={16} className="text-[#FFCB05]" />
            Cronograma de Semanas
          </h2>
          <div className="space-y-2">
            {tournament.weeks.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Semanas ainda não configuradas.</p>
            ) : (
              tournament.weeks.map((wk) => (
                <Link
                  key={wk.id}
                  href={`/torneios/${slug}/semanas/${wk.weekNumber}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-slate-900/50 px-4 py-3 hover:border-[#FFCB05]/30 hover:bg-slate-900 transition-all"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                    {wk.weekNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{wk.label ?? `Semana ${wk.weekNumber}`}</p>
                    <p className="text-xs text-slate-500">
                      {fmt(wk.startDate)} – {fmt(wk.endDate)}
                    </p>
                  </div>
                  <WeekModeBadge mode={wk.mode as WeekMode} short />
                  <ChevronRight size={14} className="text-slate-500" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Inscritos */}
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <Trophy size={16} className="text-[#FFCB05]" />
            Inscritos ({approved.length})
          </h2>
          <div className="rounded-xl border border-border bg-slate-950/50 divide-y divide-border overflow-hidden">
            {approved.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Nenhum inscrito aprovado.</p>
            ) : (
              approved.map((reg) => (
                <div key={reg.player.id} className="flex items-center gap-3 px-4 py-3">
                  <TrainerAvatar
                    displayName={reg.player.displayName}
                    image={reg.player.user?.image}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{reg.player.displayName}</p>
                    {reg.player.ptcglNick && (
                      <p className="text-xs text-slate-500">{reg.player.ptcglNick}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
