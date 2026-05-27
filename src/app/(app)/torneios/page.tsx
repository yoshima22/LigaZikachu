import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { TournamentCard } from "@/components/ui/poke/tournament-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import type { TournamentStatus } from "@prisma/client";

const STATUS_FILTER_LABELS: Record<string, string> = {
  ALL:               "Todos",
  DRAFT:             "Rascunho",
  REGISTRATION_OPEN: "Inscrições abertas",
  IN_PROGRESS:       "Em andamento",
  FINISHED:          "Encerrados"
};

const BANNER_COLORS: Record<string, string> = {
  DRAFT:             "#374151",
  REGISTRATION_OPEN: "#7AC74C",
  IN_PROGRESS:       "#F7D02C",
  FINISHED:          "#6390F0"
};

export default async function TourneiosPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const user = await getSessionUser();
  const admin = user ? isAdmin(user.role) : false;

  const where = admin
    ? statusFilter && statusFilter !== "ALL"
      ? { status: statusFilter as TournamentStatus }
      : undefined
    : statusFilter && statusFilter !== "ALL" && statusFilter !== "DRAFT"
      ? { status: statusFilter as TournamentStatus }
      : { status: { not: "DRAFT" as const } };

  const statusFilterEntries = Object.entries(STATUS_FILTER_LABELS).filter(
    ([key]) => admin || key !== "DRAFT"
  );

  const tournaments = await prisma.tournament.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: {
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["APPROVED", "PENDING"] } }
          }
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Liga Zikachu</span>
            <span>/</span>
            <span className="text-slate-300">Torneios</span>
          </div>
          <h1 className="font-pixel text-lg text-[#FFCB05] leading-snug">Torneios</h1>
          <p className="mt-1 text-sm text-slate-400">
            {tournaments.length} torneio{tournaments.length !== 1 ? "s" : ""} encontrado
            {tournaments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/torneios/novo">
            <Plus size={16} className="mr-1" />
            Novo Torneio
          </Link>
        </Button>
      </div>

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2">
        {statusFilterEntries.map(([key, label]) => {
          const active = (statusFilter ?? "ALL") === key;
          return (
            <Link
              key={key}
              href={key === "ALL" ? "/torneios" : `/torneios?status=${key}`}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]"
                  : "border-border bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Grid de torneios */}
      {tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-slate-900/40 py-20 text-center">
          <Trophy size={40} className="mb-4 text-slate-600" />
          <p className="text-base font-semibold text-slate-400">Nenhum torneio encontrado</p>
          <p className="mt-1 text-sm text-slate-500">
            {admin ? "Crie o primeiro torneio clicando no botão acima." : "Aguarde o início do próximo torneio."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              name={t.name}
              code={t.code}
              edition={t.edition}
              description={t.description}
              status={t.status}
              slug={t.slug}
              playerCount={t._count.registrations}
              maxPlayers={t.maxPlayers}
              startDate={t.startDate}
              endDate={t.endDate}
              bannerColor={BANNER_COLORS[t.status] ?? "#735797"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
