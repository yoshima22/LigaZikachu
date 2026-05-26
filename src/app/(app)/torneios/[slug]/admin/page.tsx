import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Swords, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import { closeWeek } from "../semanas/[weekNumber]/partidas/actions";
import { updateTournamentWeekDeckLock } from "../../actions";

interface Props {
  params: Promise<{ slug: string }>;
}

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
      _count: {
        select: { registrations: true },
      },
    },
  });

  if (!tournament) notFound();

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

  const currentWeek = tournament.weeks.find((w) => w.status === "OPEN") ||
    tournament.weeks.find((w) => w.status === "PLANNED");

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
                  className="mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                  action={async (formData) => {
                    "use server";
                    await updateTournamentWeekDeckLock({
                      weekId: week.id,
                      deckLockAt: String(formData.get("deckLockAt") ?? "")
                    });
                  }}
                >
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
                    <Button size="sm" variant="outline" type="submit">
                      Salvar prazo
                    </Button>
                  </div>
                  <p className="sm:col-span-2 text-xs text-slate-500">
                    Antes desse prazo, cada jogador ve apenas a propria decklist.
                    Depois, as listas dos inscritos ficam liberadas.
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
