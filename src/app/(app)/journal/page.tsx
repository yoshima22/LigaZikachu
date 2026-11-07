import Link from "next/link";
import { redirect } from "next/navigation";
import { BookMarked, Eye } from "lucide-react";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getJournalMeta } from "@/journal-data/build-pages";
import { JOURNAL_PUBLIC } from "@/journal-data/config";
import { JournalBook } from "./_components/journal-book";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal | Liga Zikachu" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ tudo?: string }> }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  if (!user) redirect("/login");
  const admin = isAdmin(user.role);
  if (!JOURNAL_PUBLIC && !admin) redirect("/dashboard");

  // "Ver tudo" (todas as páginas abertas) é só para admins revisarem o conteúdo.
  const revealAll = admin && sp.tudo === "1";
  // Só metadados + primeiro bloco: o resto das páginas é carregado sob demanda pelo livro.
  const meta = await getJournalMeta(user.id, revealAll);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            <BookMarked size={14} /> Diário de campo{!JOURNAL_PUBLIC && " · visível só para admins"}
          </p>
          <h1 className="mt-2 font-pixel text-lg leading-snug text-[#FFCB05]">Journal</h1>
          <p className="mt-2 text-sm text-slate-400">
            {meta.unlockedCount} de {meta.total} registros desbloqueados — um por Pokémon, abertos ao ter o mascote e a figurinha do Pokémon.
            Use os marcadores<span className="hidden md:inline">, as setas do teclado</span> ou o campo de página.
          </p>
        </div>
        {admin && (
          <Link
            href={revealAll ? "/journal" : "/journal?tudo=1"}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-slate-300 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05]"
          >
            <Eye size={14} /> {revealAll ? "Ver como jogador" : "Ver tudo (admin)"}
          </Link>
        )}
      </div>

      <JournalBook meta={meta} revealAll={revealAll} />
    </div>
  );
}
