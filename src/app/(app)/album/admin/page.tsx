import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ImportPanel } from "./_components/import-panel";
import { PackManager } from "./_components/pack-manager";
import { RarityEditor } from "./_components/rarity-editor";
import { PlayerAlbumManager } from "./_components/player-album-manager";

export const dynamic = "force-dynamic";

export default async function AlbumAdminPage() {
  await requireAdmin();

  const [packs, cardStats, players] = await Promise.all([
    prisma.stickerPack.findMany({ orderBy: { price: "asc" } }),
    prisma.pokemonCard.groupBy({
      by: ["rarity", "generation"],
      _count: { id: true },
      orderBy: [{ generation: "asc" }, { rarity: "asc" }]
    }),
    prisma.player.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } })
  ]);

  const totalCards = cardStats.reduce((s, g) => s + g._count.id, 0);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/album" className="hover:text-slate-300">Álbum</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Admin</span>
      </nav>

      <div>
        <h1 className="font-pixel text-base text-[#FFCB05]">Admin do Álbum</h1>
        <p className="mt-1 text-sm text-slate-400">
          {totalCards} Pokémon importados no banco.
        </p>
      </div>

      <Card>
        <p className="mb-3 font-semibold text-slate-200">Importar Pokémon da PokeAPI</p>
        <p className="mb-4 text-xs text-slate-500">
          Use os atalhos de geração ou "Importar tudo" para popular o banco. Raridade atribuída automaticamente por base stats da PokeAPI.
        </p>
        <ImportPanel />
      </Card>

      <Card>
        <p className="mb-3 font-semibold text-slate-200">Gerenciar Pacotes</p>
        <PackManager packs={packs.map((p) => ({ ...p, description: p.description ?? null, imageUrl: p.imageUrl ?? null }))} />
      </Card>

      <Card>
        <p className="mb-3 font-semibold text-slate-200">Editar Raridade de Pokémon</p>
        <p className="mb-3 text-xs text-slate-500">Ajuste a raridade individual de qualquer Pokémon pelo ID do banco.</p>
        <RarityEditor />
      </Card>

      <Card>
        <p className="mb-3 font-semibold text-slate-200">Gerenciar Álbum por Jogador</p>
        <p className="mb-3 text-xs text-slate-500">Adicione/remova figurinhas ou resete o álbum completo de um jogador específico.</p>
        <PlayerAlbumManager players={players} />
      </Card>
    </div>
  );
}
