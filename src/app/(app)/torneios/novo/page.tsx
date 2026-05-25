import { requireAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CreateTournamentForm } from "./_components/create-tournament-form";

export default async function NovoTorneioPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="hover:text-slate-300">Torneios</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Novo Torneio</span>
      </nav>

      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Criar Torneio</h1>
        <p className="mt-1 text-sm text-slate-400">Preencha os dados do novo torneio.</p>
      </div>

      <CreateTournamentForm />
    </div>
  );
}
