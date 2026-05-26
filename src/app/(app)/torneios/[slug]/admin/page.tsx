import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Swords, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import { closeWeek } from "../semanas/[weekNumber]/partidas/actions";
import {
  finishTournament,
  publishTournament,
  startTournament,
  updateTournamentSeason,
  updateTournamentWeekSettings
} from "../../actions";
import { TournamentStatus, WeekMode, WeekStatus } from "@prisma/client";

interface Props {
  params: Promise<{ slug: string }>;
}

const weekModeLabels: Record<WeekMode, string> = {
  PADRAO: "Padrao",
  GLC: "GLC",
  DUPLAS_SINCRONIZADAS: "Duplas Sincronizadas",
  PONTUACAO_DOBRADA: "Pontuacao Dobrada",
  CONSTRUTOR_MISTERIOSO: "Construtor Misterioso",
  GUERRA_DE_TIMES: "Guerra de Times",
  BATALHA_FINAL: "Batalha Final"
};

const weekStatusLabels: Record<WeekStatus, string> = {
  PLANNED: "Planejada",
  OPEN: "Aberta",
  LOCKED: "Bloqueada",
  CLOSED: "Encerrada"
};

const tournamentStatusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Rascunho",
  REGISTRATION_OPEN: "Inscricoes abertas",
  IN_PROGRESS: "Em andamento",
  FINISHED: "Encerrado"
};

export default async function TournamentAdminPage({ params }: Props) {
  const { slug } = await params;
  await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          matches: {
            include: {
              playerA: true,
              playerB: true,
              winnerPlayer: true,
            },
          },
        },
      },
      registrations: {
        include: { player: true },
        orderBy: { registeredAt: "desc" },
      },
      season: {
        select: { id: true, name: true, slug: true, status: true },
      },
      _count: {
        select: { registrations: true },
      },
    },
  });

  if (!tournament) notFound();

  const seasons = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, status: true, startDate: true, endDate: true }
  });

  const totalMatches = tournament.weeks.reduce(
    (acc, w) => acc + w.matches.length,
    0
  );
  const confirmedMatches = tournament.weeks.reduce(
    (acc, w) => acc + w.matches.filter((m) => m.status === "CONFIRMED").length,
    0
  );
  const disputedMatches = tournament.weeks.reduce(
    (acc, w) => acc + w.matches.filter((m) => m.status === "DISPUTED").length,
    0
  );
  const pendingMatches = totalMatches - confirmedMatches - disputedMatches;

  const toDateTimeLocal = (value: Date | null | undefined) => {
    if (!value) return "";

    const date = new Date(value);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-400">
        <Link href="/torneios" className="hover:text-[#FFCB05]">Torneios</Link>
        <span className="mx-2">/</span>
        <Link href={`/torneios/${slug}`} className="hover:text-[#FFCB05]">
          {tournament.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#FFCB05]">Admin</span>
      </nav>

      <h1 className="text-2xl font-bold text-white font-pixel">
        Painel Admin — {tournament.name}
      </h1>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Calendar size={18} className="text-[#FFCB05]" />
            Temporada do Campeonato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-slate-400">Temporada vinculada</p>
            <p className="text-lg font-semibold text-white">
              {tournament.season ? tournament.season.name : "Sem temporada vinculada"}
            </p>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Esse vinculo agrupa campeonatos dentro de uma temporada e e necessario para decklists,
              ranking geral por temporada e historico dos jogadores.
            </p>
          </div>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            action={async (formData) => {
              "use server";
              await updateTournamentSeason({
                tournamentId: tournament.id,
                seasonId: String(formData.get("seasonId") ?? "")
              });
            }}
          >
            <label className="flex-1 space-y-1 text-xs text-slate-400">
              <span>Escolher temporada</span>
              <select
                name="seasonId"
                defaultValue={tournament.seasonId ?? ""}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              >
                <option value="">Sem temporada</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({season.status})
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
              Salvar temporada
            </Button>
          </form>
          {seasons.length === 0 && (
            <p className="text-xs text-amber-300">
              Nenhuma temporada cadastrada ainda. Crie uma temporada em Temporadas antes de vincular este torneio.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Trophy size={18} className="text-[#FFCB05]" />
            Status do Torneio
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Status atual</p>
            <p className="text-lg font-semibold text-white">
              {tournamentStatusLabels[tournament.status]}
            </p>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Publique o torneio para remover do rascunho e abrir inscricoes para jogadores.
              Depois disso, voce pode iniciar ou encerrar conforme o andamento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tournament.status === "DRAFT" && (
              <form
                action={async () => {
                  "use server";
                  await publishTournament(tournament.id);
                }}
              >
                <Button type="submit" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                  Publicar e abrir inscricoes
                </Button>
              </form>
            )}
            {tournament.status === "REGISTRATION_OPEN" && (
              <form
                action={async () => {
                  "use server";
                  await startTournament(tournament.id);
                }}
              >
                <Button type="submit" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                  Iniciar torneio
                </Button>
              </form>
            )}
            {tournament.status === "IN_PROGRESS" && (
              <form
                action={async () => {
                  "use server";
                  await finishTournament(tournament.id);
                }}
              >
                <Button type="submit" variant="outline">
                  Encerrar torneio
                </Button>
              </form>
            )}
            <Button variant="outline" asChild>
              <Link href={`/torneios/${slug}`}>Ver pagina publica</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Users size={16} className="text-[#FFCB05]" />
              Inscritos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {tournament._count.registrations}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Swords size={16} className="text-blue-400" />
              Total Partidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{totalMatches}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <TrendingUp size={16} className="text-green-400" />
              Confirmadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-400">{confirmedMatches}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              Disputas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{disputedMatches}</p>
          </CardContent>
        </Card>
      </div>

      {/* Semanas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar size={18} className="text-[#FFCB05]" />
          Semanas
        </h2>

        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400">
          <p className="mb-2 font-semibold text-slate-200">O que significa cada status do dia</p>
          <div className="grid gap-2 md:grid-cols-2">
            <p><strong className="text-slate-300">Planejada:</strong> dia configurado, partidas podem ja existir, mas ainda nao e o dia ativo.</p>
            <p><strong className="text-[#7AC74C]">Aberta:</strong> dia ativo para jogar, reportar/importar e validar resultados.</p>
            <p><strong className="text-[#F7D02C]">Bloqueada:</strong> periodo de alterar deck acabou; jogadores inscritos veem as listas uns dos outros.</p>
            <p><strong className="text-[#6390F0]">Encerrada:</strong> dia fechado; use quando resultados e premiacoes daquele dia ja foram tratados.</p>
          </div>
        </div>
        <div className="grid gap-3">
          {tournament.weeks.map((week) => (
            <Card
              key={week.id}
              className={`bg-slate-900/50 border-slate-800 ${
                week.status === "OPEN" ? "border-[#FFCB05]/30" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                      {week.weekNumber}
                    </div>
                    <div>
                      <p className="font-medium text-white">{week.label || `Semana ${week.weekNumber}`}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <WeekModeBadge mode={week.mode} />
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            week.status === "OPEN"
                              ? "bg-green-500/20 text-green-400"
                              : week.status === "CLOSED"
                              ? "bg-slate-700 text-slate-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {week.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {week.matches.length} partidas
                    </span>
                    <Link
                      href={`/torneios/${slug}/semanas/${week.weekNumber}/partidas`}
                    >
                      <Button size="sm" variant="outline">
                        Ver Partidas
                      </Button>
                    </Link>
                    {week.status === "OPEN" && (
                      <form
                        action={async () => {
                          "use server";
                          await closeWeek(tournament.id, week.weekNumber);
                        }}
                      >
                        <Button size="sm" variant="destructive">
                          Fechar
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
                <form
                  className="mt-4 grid gap-3 border-t border-slate-800 pt-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)_minmax(160px,0.7fr)_minmax(220px,1fr)_auto]"
                  action={async (formData) => {
                    "use server";
                    await updateTournamentWeekSettings({
                      weekId: week.id,
                      label: String(formData.get("label") ?? ""),
                      mode: String(formData.get("mode") ?? week.mode) as WeekMode,
                      status: String(formData.get("status") ?? week.status) as WeekStatus,
                      deckLockAt: String(formData.get("deckLockAt") ?? "")
                    });
                  }}
                >
                  <label className="space-y-1 text-xs text-slate-400">
                    <span>Nome do dia/semana</span>
                    <input
                      name="label"
                      defaultValue={week.label ?? ""}
                      placeholder={`Semana ${week.weekNumber}`}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-400">
                    <span>Modo de jogo</span>
                    <select
                      name="mode"
                      defaultValue={week.mode}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
                    >
                      {Object.entries(weekModeLabels).map(([mode, label]) => (
                        <option key={mode} value={mode}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-slate-400">
                    <span>Status do dia</span>
                    <select
                      name="status"
                      defaultValue={week.status}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
                    >
                      {Object.entries(weekStatusLabels).map(([status, label]) => (
                        <option key={status} value={status}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-slate-400">
                    <span>Fechamento do cadastro de deck</span>
                    <input
                      type="datetime-local"
                      name="deckLockAt"
                      defaultValue={toDateTimeLocal(week.deckLockAt ?? week.lockAt)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
                    />
                  </label>
                  <div className="flex items-end">
                    <Button size="sm" type="submit" className="w-full bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                      Salvar dia
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 md:col-span-2 lg:col-span-5">
                    Aqui o admin define o modo do dia, abre/bloqueia/encerra o dia e controla o fechamento das decklists.
                  </p>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Inscritos */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users size={18} className="text-[#FFCB05]" />
          Inscritos
        </h2>
        <div className="grid gap-2">
          {tournament.registrations.map((reg) => (
            <div
              key={reg.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700] flex items-center justify-center text-[#1A1A2E] font-bold text-xs">
                  {reg.player.displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {reg.player.displayName}
                  </p>
                  <p className="text-xs text-slate-500">{reg.player.ptcglNick}</p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  reg.status === "APPROVED"
                    ? "bg-green-500/20 text-green-400"
                    : reg.status === "PENDING"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {reg.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
