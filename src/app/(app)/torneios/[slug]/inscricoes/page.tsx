import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/permissions";
import { TrainerAvatar } from "@/components/ui/poke/trainer-avatar";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RegistrationActions } from "./_components/registration-actions";

export default async function InscricoesPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireAdmin();

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      registrations: {
        include: {
          player: {
            include: { user: { select: { image: true, email: true } } }
          },
          decidedBy: { select: { name: true } }
        },
        orderBy: { registeredAt: "asc" }
      }
    }
  });

  if (!tournament) notFound();

  const groups = {
    PENDING:   tournament.registrations.filter((r) => r.status === "PENDING"),
    APPROVED:  tournament.registrations.filter((r) => r.status === "APPROVED"),
    REJECTED:  tournament.registrations.filter((r) => r.status === "REJECTED"),
    WITHDRAWN: tournament.registrations.filter((r) => r.status === "WITHDRAWN")
  };

  const statusConfig = {
    PENDING:   { label: "Pendentes",  cls: "text-[#F7D02C]", count: groups.PENDING.length },
    APPROVED:  { label: "Aprovados",  cls: "text-[#7AC74C]", count: groups.APPROVED.length },
    REJECTED:  { label: "Rejeitados", cls: "text-red-400",    count: groups.REJECTED.length },
    WITHDRAWN: { label: "Cancelados", cls: "text-slate-500",  count: groups.WITHDRAWN.length }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
        <Link href="/torneios" className="hover:text-slate-300">Torneios</Link>
        <ChevronRight size={12} />
        <Link href={`/torneios/${slug}`} className="hover:text-slate-300">{tournament.name}</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Inscrições</span>
      </nav>

      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Gerenciar Inscrições</h1>
        <p className="mt-1 text-sm text-slate-400">{tournament.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(statusConfig).map(([key, { label, cls, count }]) => (
          <div key={key} className="rounded-xl border border-border bg-slate-950/50 p-4 text-center">
            <p className={`text-2xl font-bold ${cls}`}>{count}</p>
            <p className="mt-0.5 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Seção pendentes com ações */}
      {groups.PENDING.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-[#F7D02C] text-sm">Pendentes de Aprovação ({groups.PENDING.length})</h2>
          <div className="rounded-xl border border-[#F7D02C]/20 bg-slate-950/50 divide-y divide-border overflow-hidden">
            {groups.PENDING.map((reg) => (
              <div key={reg.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <TrainerAvatar displayName={reg.player.displayName} image={reg.player.user?.image} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{reg.player.displayName}</p>
                    <p className="text-xs text-slate-500">{reg.player.user?.email}</p>
                  </div>
                </div>
                <RegistrationActions
                  tournamentId={tournament.id}
                  playerId={reg.player.id}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aprovados */}
      {groups.APPROVED.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-[#7AC74C] text-sm">Aprovados ({groups.APPROVED.length})</h2>
          <div className="rounded-xl border border-border bg-slate-950/50 divide-y divide-border overflow-hidden">
            {groups.APPROVED.map((reg) => (
              <div key={reg.id} className="flex items-center gap-3 px-4 py-3">
                <TrainerAvatar displayName={reg.player.displayName} image={reg.player.user?.image} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{reg.player.displayName}</p>
                  {reg.decidedBy && (
                    <p className="text-xs text-slate-500">Aprovado por {reg.decidedBy.name}</p>
                  )}
                </div>
                <span className="text-xs text-[#7AC74C]">Aprovado</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
