import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Trophy, Users, Swords, Calendar, TrendingUp, AlertTriangle, Megaphone, Pencil } from "lucide-react";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import { DeleteTournamentButton } from "./_components/delete-tournament-button";
import { closeWeek } from "../semanas/[weekNumber]/partidas/actions";
import {
  addTournamentWeek,
  finishTournament,
  publishTournament,
  removeTournamentWeek,
  reopenRegistrations,
  deletePlayerRegistration,
  startTournament,
  updateTournamentSeason,
  updateTournamentWeekSettings,
  updateTournamentInfo,
  reopenTournament
} from "../../actions";
import { TournamentStatus, WeekMode, WeekStatus } from "@prisma/client";
import {
  updateTournamentAnnouncement,
  updateChallengeConfig
} from "../desafios/actions";
import { parseChallengeConfig, DEFAULT_CHALLENGE_CONFIG } from "../desafios/config";
import { TournamentAchievementsPanel } from "./_components/tournament-achievements-panel";

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
  const user = await getSessionUser();
  if (!user) return null;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      _count: { select: { registrations: true, challenges: true } },
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
    },
  });

  if (!tournament) notFound();
  const canManage = isAdmin(user.role) || tournament.createdById === user.id;
  if (!canManage) notFound();

  const challengeConfig = parseChallengeConfig(tournament.challengeConfig ?? DEFAULT_CHALLENGE_CONFIG);

  // Conquistas deste torneio e todas disponíveis para vincular
  const [tournamentAchievements, allAchievements, registeredPlayers] = await Promise.all([
    prisma.achievement.findMany({ where: { tournamentId: tournament.id, active: true }, include: { rewards: true } }),
    prisma.achievement.findMany({ where: { active: true }, select: { id: true, name: true, rarity: true, tournamentId: true } }),
    prisma.tournamentRegistration.findMany({
      where: { tournamentId: tournament.id, status: "APPROVED" },
      include: { player: { select: { id: true, displayName: true } } }
    })
  ]);

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

      {/* Editar nome e info do torneio */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Pencil size={18} className="text-[#FFCB05]" />
            Editar informações do torneio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            action={async (formData) => {
              "use server";
              await updateTournamentInfo({
                tournamentId:       tournament.id,
                name:               String(formData.get("name") ?? ""),
                edition:            String(formData.get("edition") ?? ""),
                description:        String(formData.get("description") ?? ""),
                startDate:          String(formData.get("startDate") ?? ""),
                endDate:            String(formData.get("endDate") ?? ""),
                format:             String(formData.get("format") ?? ""),
                matchesPerPlayerMax: Number(formData.get("matchesPerPlayerMax") || 4),
              });
            }}
          >
            <label className="space-y-1 text-xs text-slate-400">
              <span>Nome do torneio *</span>
              <input
                name="name"
                defaultValue={tournament.name}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Edição (ex: 2ª Edição)</span>
              <input
                name="edition"
                defaultValue={tournament.edition ?? ""}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Formato</span>
              <select
                name="format"
                defaultValue={tournament.format}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              >
                <option value="ONLINE">Online</option>
                <option value="IN_PERSON">Presencial</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Data de início</span>
              <input
                type="date"
                name="startDate"
                defaultValue={tournament.startDate ? new Date(tournament.startDate).toISOString().slice(0,10) : ""}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Data de encerramento</span>
              <input
                type="date"
                name="endDate"
                defaultValue={tournament.endDate ? new Date(tournament.endDate).toISOString().slice(0,10) : ""}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Mín. partidas/jogador/semana</span>
              <input
                type="number" name="matchesPerPlayerMin" min={1} max={10}
                defaultValue={Math.max(1, (tournament.matchesPerPlayer ?? 4) - 2)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Máx. partidas/jogador/semana</span>
              <input
                type="number" name="matchesPerPlayerMax" min={1} max={10}
                defaultValue={tournament.matchesPerPlayer ?? 4}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400 md:col-span-2">
              <span>Descrição</span>
              <textarea
                name="description"
                defaultValue={tournament.description ?? ""}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                Salvar informações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base text-white">
            <span>Codigo e acoes do torneio</span>
            <span className="font-mono text-[#FFCB05]">{tournament.code ?? "Sem codigo"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-slate-400">
            O codigo do torneio e gerado automaticamente para novos campeonatos.
            Deletar um torneio remove semanas, partidas, inscricoes e decklists vinculadas.
          </p>
          <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} />
        </CardContent>
      </Card>

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
            {tournament.status === "FINISHED" && (
              <form
                action={async () => {
                  "use server";
                  await reopenTournament(tournament.id);
                }}
              >
                <Button type="submit" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                  Reabrir torneio
                </Button>
              </form>
            )}
            {(tournament.status === "IN_PROGRESS" || tournament.status === "DRAFT") && (
              <form
                action={async () => {
                  "use server";
                  await reopenRegistrations(tournament.id);
                }}
              >
                <Button type="submit" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                  Reabrir inscrições
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
        <form
          action={async () => {
            "use server";
            await addTournamentWeek({ tournamentId: tournament.id });
          }}
        >
          <Button type="submit" size="sm" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
            Adicionar dia de jogo
          </Button>
        </form>

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
                    <form
                      action={async () => {
                        "use server";
                        await removeTournamentWeek({ weekId: week.id });
                      }}
                    >
                      <Button size="sm" type="submit" variant="destructive">
                        Remover
                      </Button>
                    </form>
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
                      deckLockAt: String(formData.get("deckLockAt") ?? ""),
                      notes: String(formData.get("notes") ?? "")
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
                  <label className="space-y-1 text-xs text-slate-400 md:col-span-2 lg:col-span-5">
                    <span>Explicacao manual do modo de jogo</span>
                    <textarea
                      name="notes"
                      defaultValue={week.notes ?? ""}
                      rows={3}
                      placeholder="Explique regras especiais, bonus, restricoes ou combinados desse dia."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
                    />
                  </label>
                  <p className="text-xs text-slate-500 md:col-span-2 lg:col-span-5">
                    Aqui o admin define o modo do dia, abre/bloqueia/encerra o dia e controla o fechamento das decklists.
                  </p>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Anúncio do torneio */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Megaphone size={18} className="text-[#FFCB05]" />
            Anúncio / Aviso do Torneio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-500">
            Este texto aparece em destaque na página pública do torneio. Use para avisos, lembretes ou informações importantes.
          </p>
          <form
            className="space-y-3"
            action={async (formData) => {
              "use server";
              await updateTournamentAnnouncement(
                tournament.id,
                String(formData.get("announcement") ?? "")
              );
            }}
          >
            <textarea
              name="announcement"
              defaultValue={tournament.announcement ?? ""}
              rows={4}
              placeholder="Ex: A próxima rodada acontece no sábado às 15h. Deck de GLC obrigatório."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
            />
            <Button type="submit" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
              Salvar anúncio
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Configuração de Desafios */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base text-white">
            <span className="flex items-center gap-2">
              <Award size={18} className="text-[#FFCB05]" />
              Sistema de Desafios
            </span>
            <Link href={`/torneios/${slug}/desafios`} className="text-xs text-[#FFCB05] hover:underline">
              Ver aba de desafios →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Configure quais tipos de desafio estão habilitados e as regras de pontuação.
            Desafio por Insígnia: jogadores acumulam pontos em uma insígnia e podem desafiar o dono.
            Desafio Livre: qualquer jogador pode ser desafiado independente de insígnia.
          </p>
          <form
            className="grid gap-4"
            action={async (formData) => {
              "use server";
              await updateChallengeConfig({
                tournamentId: tournament.id,
                badgeChallenge: formData.get("badgeChallenge") === "on",
                freeChallenge: formData.get("freeChallenge") === "on",
                pointsPerBadge: Number(formData.get("pointsPerBadge") ?? 3),
                pointsToChallenge: Number(formData.get("pointsToChallenge") ?? 3),
                challengerPenalty: Number(formData.get("challengerPenalty") ?? 2),
                maxChallengesReceivedPerWeek: Number(formData.get("maxChallengesReceivedPerWeek") ?? 1)
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 cursor-pointer hover:border-[#FFCB05]/40">
                <input
                  type="checkbox"
                  name="badgeChallenge"
                  defaultChecked={challengeConfig.badgeChallenge}
                  className="mt-0.5 accent-[#FFCB05]"
                />
                <div>
                  <p className="text-sm font-semibold text-white">Desafio por Insígnia</p>
                  <p className="text-xs text-slate-500">Jogador acumula pontos em uma insígnia e pode desafiar o dono.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 cursor-pointer hover:border-[#FFCB05]/40">
                <input
                  type="checkbox"
                  name="freeChallenge"
                  defaultChecked={challengeConfig.freeChallenge}
                  className="mt-0.5 accent-[#FFCB05]"
                />
                <div>
                  <p className="text-sm font-semibold text-white">Desafio Livre</p>
                  <p className="text-xs text-slate-500">Qualquer jogador pode ser desafiado, sem insígnia envolvida.</p>
                </div>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-xs text-slate-400">
                <span>Bônus por posse de insígnia (pts)</span>
                <input
                  type="number"
                  name="pointsPerBadge"
                  defaultValue={challengeConfig.pointsPerBadge}
                  min={1}
                  max={20}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Pontos mínimos para desafiar</span>
                <input
                  type="number"
                  name="pointsToChallenge"
                  defaultValue={challengeConfig.pointsToChallenge}
                  min={1}
                  max={20}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Penalidade ao perder desafio (pts)</span>
                <input
                  type="number"
                  name="challengerPenalty"
                  defaultValue={challengeConfig.challengerPenalty}
                  min={0}
                  max={20}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Desafios recebidos por semana</span>
                <input
                  type="number"
                  name="maxChallengesReceivedPerWeek"
                  defaultValue={challengeConfig.maxChallengesReceivedPerWeek}
                  min={1}
                  max={10}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
                />
              </label>
            </div>

            <Button type="submit" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
              Salvar configuração de desafios
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Conquistas do Torneio */}
      <TournamentAchievementsPanel
        tournamentId={tournament.id}
        tournamentAchievements={tournamentAchievements.map(a => ({
          id: a.id, name: a.name, rarity: (a as { rarity: string }).rarity ?? "COMMON",
          rewardsCount: a.rewards.length
        }))}
        allAchievements={allAchievements.map(a => ({
          id: a.id, name: a.name, rarity: a.rarity,
          linkedToThisTournament: a.tournamentId === tournament.id
        }))}
        players={registeredPlayers.map(r => ({ id: r.player.id, displayName: r.player.displayName }))}
      />

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
              <div className="flex items-center gap-2">
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
                <form
                  action={async () => {
                    "use server";
                    await deletePlayerRegistration(tournament.id, reg.player.id);
                  }}
                >
                  <button type="submit" className="rounded-lg px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10">
                    Remover
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
