import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  Gift,
  Package,
  ShieldCheck,
  Swords,
  Trophy,
  Users
} from "lucide-react";
import { MatchStatus, TournamentStatus, UserStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";

const adminCards = [
  {
    href: "/torneios",
    title: "Gerenciar torneios",
    description: "Criar torneios, publicar, iniciar, editar dias e acessar resultados.",
    icon: Trophy
  },
  {
    href: "/jogadores",
    title: "Gerenciar jogadores",
    description: "Aprovar contas, editar perfis, resetar senhas e acompanhar status.",
    icon: Users
  },
  {
    href: "/codigos",
    title: "Banco de codigos",
    description: "Importar, enviar, revogar e revisar codigos de booster.",
    icon: Package
  },
  {
    href: "/caixa-de-presentes",
    title: "Presentes",
    description: "Verificar o fluxo de presentes e resgates dos jogadores.",
    icon: Gift
  },
  {
    href: "/ranking",
    title: "Ranking geral",
    description: "Conferir pontuacao global e filtros por temporada.",
    icon: BarChart3
  },
  {
    href: "/temporadas",
    title: "Temporadas",
    description: "Organizar grupos de campeonatos por temporada.",
    icon: Calendar
  }
];

export default async function AdminPage() {
  await requireAdmin();

  const [
    pendingUsers,
    activeTournaments,
    draftTournaments,
    pendingMatches,
    disputedMatches,
    availableCodes,
    invalidCodes,
    pendingDecks,
    recentAuditLogs
  ] = await Promise.all([
    prisma.user.count({ where: { status: UserStatus.PENDING_APPROVAL } }),
    prisma.tournament.count({ where: { status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] } } }),
    prisma.tournament.count({ where: { status: TournamentStatus.DRAFT } }),
    prisma.match.count({ where: { status: MatchStatus.PENDING_CONFIRMATION } }),
    prisma.match.count({ where: { status: MatchStatus.DISPUTED } }),
    prisma.boosterCode.count({ where: { status: "AVAILABLE" } }),
    prisma.boosterCode.count({ where: { status: "INVALIDATED" } }),
    prisma.deckSubmission.count({ where: { status: "SUBMITTED" } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } }
    })
  ]);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">Painel Admin</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Central para operar torneios, jogadores, resultados, codigos, rankings e auditoria.
            </p>
          </div>
          <Link href="/torneios/novo">
            <Button className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
              Criar torneio
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contas pendentes" value={pendingUsers} icon={<ShieldCheck size={22} />} highlight={pendingUsers > 0} />
        <StatCard label="Torneios ativos" value={activeTournaments} icon={<Trophy size={22} />} />
        <StatCard label="Partidas pendentes" value={pendingMatches} icon={<Swords size={22} />} highlight={pendingMatches > 0} />
        <StatCard label="Disputas abertas" value={disputedMatches} icon={<AlertTriangle size={22} />} highlight={disputedMatches > 0} />
        <StatCard label="Rascunhos" value={draftTournaments} icon={<BookOpen size={22} />} />
        <StatCard label="Decks enviados" value={pendingDecks} icon={<BookOpen size={22} />} />
        <StatCard label="Codigos disponiveis" value={availableCodes} icon={<Package size={22} />} />
        <StatCard label="Codigos invalidos" value={invalidCodes} icon={<AlertTriangle size={22} />} highlight={invalidCodes > 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminCards.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:border-[#FFCB05]/30 hover:bg-slate-900/80">
              <Icon size={22} className="mb-3 text-[#FFCB05]" />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-2">{description}</CardDescription>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardTitle className="mb-4 text-base">Ultimas acoes registradas</CardTitle>
        {recentAuditLogs.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma acao registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentAuditLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">{log.action}</p>
                  <p className="text-xs text-slate-500">
                    {log.entityType} - {log.actor?.name ?? log.actor?.email ?? "Sistema"}
                  </p>
                </div>
                <time className="text-xs text-slate-500">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
