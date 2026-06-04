import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MyDecksClient } from "./_components/my-decks-client";

export const dynamic = "force-dynamic";

export default async function MeusDecksPage() {
  const session = await getAppSession();
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!player) notFound();

  const decks = await prisma.savedDeck.findMany({
    where: { playerId: player.id },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/perfil" className="hover:text-slate-300">Meu Perfil</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Meus Decks</span>
      </nav>

      <div>
        <h1 className="font-pixel text-base text-[#FFCB05]">Meus Decks</h1>
        <p className="mt-1 text-sm text-slate-400">
          Salve suas listas para reutilizar ao registrar decks em torneios.
          Decks públicos aparecem no seu perfil.
        </p>
      </div>

      <MyDecksClient decks={decks.map((d) => ({
        id: d.id,
        name: d.name,
        archetype: d.archetype ?? null,
        deckList: d.deckList,
        isPublic: d.isPublic,
        updatedAt: d.updatedAt.toISOString()
      }))} />
    </div>
  );
}
