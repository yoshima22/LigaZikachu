import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Hammer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConstrutorClient } from "./construtor-client";

export const dynamic = "force-dynamic";

export default async function TournamentConstrutorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } });
  if (!tournament) notFound();

  // Semana(s) do modo Construtor deste torneio.
  const weeks = await prisma.tournamentWeek.findMany({
    where: { tournamentId: tournament.id, mode: "CONSTRUTOR_MISTERIOSO" },
    orderBy: { weekNumber: "asc" },
    select: { id: true, weekNumber: true, label: true, status: true },
  });

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="transition-colors hover:text-slate-300">Torneios</Link>
        <ChevronRight size={12} />
        <Link href={`/torneios/${slug}`} className="transition-colors hover:text-slate-300">{tournament.name}</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Construtor</span>
      </nav>

      <div>
        <h1 className="flex items-center gap-2 font-pixel text-base leading-snug text-[#FFCB05]"><Hammer size={18} /> Modo Construtor</h1>
        <p className="mt-1 text-sm text-slate-400">
          Registre 3 decks. Em cada partida, o adversário escolhe qual dos seus decks você vai jogar. O deck usado no 1º jogo sai da escolha do 2º.
        </p>
      </div>

      {weeks.length === 0 ? (
        <Card><EmptyState message="Este torneio não tem uma semana no modo Construtor." icon={<Hammer size={32} />} /></Card>
      ) : (
        weeks.map((w) => (
          <div key={w.id} className="space-y-2">
            {weeks.length > 1 && <h2 className="text-sm font-bold text-slate-200">{w.label ?? `Semana ${w.weekNumber}`}</h2>}
            <ConstrutorClient weekId={w.id} slug={slug} weekNumber={w.weekNumber} />
          </div>
        ))
      )}
    </div>
  );
}
