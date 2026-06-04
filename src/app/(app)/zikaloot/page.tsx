import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { ZikaLootStatus, ShopItemType } from "@prisma/client";
import { Ticket, Trophy } from "lucide-react";
import type { PrizeConfig } from "@/lib/zikaloot-types";
import { Card } from "@/components/ui/card";
import { LootBoard } from "./_components/loot-board";
import { AdminLootPanel } from "./_components/admin-loot-panel";
import { checkAndRunPendingDraws } from "./actions";

export const dynamic = "force-dynamic";

const statusLabel: Record<ZikaLootStatus, string> = {
  SCHEDULED: "Aguardando sorteio",
  DRAWN: "Sorteada",
  NO_WINNER: "Sem vencedor — novo sorteio agendado",
  CANCELLED: "Cancelada"
};

export default async function ZikaLootPage() {
  const session = await getAppSession();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);

  // Executar sorteios que passaram do horário automaticamente
  await checkAndRunPendingDraws();

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  const [loots, myPicks, ticketCount] = await Promise.all([
    prisma.zikaLoot.findMany({
      orderBy: { drawAt: "desc" },
      take: 10,
      include: {
        picks: {
          select: { number: true, playerId: true, player: { select: { displayName: true } } }
        },
        winner: { select: { displayName: true } }
      }
    }),
    player
      ? prisma.zikaLootPick.findMany({ where: { playerId: player.id }, select: { lootId: true, number: true } })
      : [],
    player
      ? prisma.playerInventory.findFirst({
          where: { playerId: player.id, item: { type: ShopItemType.ZIKALOOT_TICKET } },
          select: { quantity: true }
        }).then((r) => r?.quantity ?? 0)
      : 0
  ]);

  // Agrupa múltiplos números por lootId
  const myPickMap = new Map<string, number[]>();
  for (const p of myPicks) {
    const arr = myPickMap.get(p.lootId) ?? [];
    arr.push(p.number);
    myPickMap.set(p.lootId, arr);
  }
  const activeLoot = loots.find((l) => l.status === ZikaLootStatus.SCHEDULED);

  // Busca imagens das figurinhas que são prêmio na loteria ativa.
  // cardId pode ser o nationalId numérico (ex: "248") ou o id CUID do card.
  const stickerCardImages = new Map<string, { imageUrl: string | null; displayName: string }>();
  if (activeLoot?.prizeConfig) {
    const cfg = activeLoot.prizeConfig as { prizes?: Array<{ type: string; cardId?: string }> };
    const stickerIds = (cfg.prizes ?? [])
      .filter(p => p.type === "STICKER" && p.cardId)
      .map(p => p.cardId!);
    if (stickerIds.length > 0) {
      // Tenta buscar por nationalId (número do Pokémon) primeiro
      const numericIds = stickerIds.map(id => parseInt(id.replace(/^0+/, ""))).filter(n => !isNaN(n));
      const cards = await prisma.pokemonCard.findMany({
        where: {
          OR: [
            { id: { in: stickerIds } },                // CUID exato
            { nationalId: { in: numericIds } },         // Número do Pokémon (248, 0248, etc.)
          ]
        },
        select: { id: true, nationalId: true, imageUrl: true, displayName: true },
        take: 20
      });
      for (const c of cards) {
        // Mapeia tanto pelo CUID quanto pelo nationalId string
        stickerCardImages.set(c.id, { imageUrl: c.imageUrl, displayName: c.displayName });
        stickerCardImages.set(String(c.nationalId), { imageUrl: c.imageUrl, displayName: c.displayName });
        stickerCardImages.set(String(c.nationalId).padStart(4, "0"), { imageUrl: c.imageUrl, displayName: c.displayName });
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">ZikaLoot</h1>
            <p className="mt-1 text-sm text-slate-400">
              200 números. Um sorteado por dia. Se o seu número for o escolhido, você ganha o prêmio!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2">
              <Ticket size={16} className="text-[#FFCB05]" />
              <span className="text-sm font-bold text-[#FFCB05]">{ticketCount} ticket{ticketCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {activeLoot && (
          <div className="mt-4 rounded-xl border border-[#FFCB05]/20 bg-slate-950/40 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Loteria ativa</p>
            <p className="font-semibold text-white">{activeLoot.name}</p>
            {activeLoot.description && <p className="text-xs text-slate-400 mt-0.5">{activeLoot.description}</p>}
            <div className="mt-2 flex flex-wrap gap-4">
              <div>
                <p className="text-[10px] text-slate-500">Prêmio</p>
                {/* Mostra prêmios estruturados (figurinhas, moedas, etc.) */}
                {(() => {
                  const cfg = activeLoot.prizeConfig as PrizeConfig | { prizes?: PrizeConfig["prizes"] } | null | undefined;
                  const items = (cfg as PrizeConfig)?.prizes ?? [];
                  if (items.length === 0) {
                    return <p className="text-sm font-semibold text-[#7AC74C]">{activeLoot.prize}</p>;
                  }
                  return (
                    <div className="flex flex-wrap gap-3 mt-1">
                      {items.map((item, i) => {
                        if (item.type === "STICKER") {
                          const card = stickerCardImages.get(item.cardId);
                          return (
                            <div key={i} className="flex items-center gap-2 rounded-xl border border-[#7AC74C]/30 bg-[#7AC74C]/10 px-3 py-2">
                              {card?.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={card.imageUrl}
                                  alt={card.displayName}
                                  className="h-16 w-12 rounded-lg object-cover shadow-md"
                                  style={{ imageRendering: "auto" }}
                                />
                              ) : (
                                <span className="text-2xl">🃏</span>
                              )}
                              <div>
                                <p className="text-[10px] text-[#7AC74C]/70 uppercase tracking-wide">Figurinha</p>
                                <p className="text-sm font-semibold text-[#7AC74C]">
                                  {card?.displayName ?? item.cardName}
                                </p>
                                <p className="text-[10px] text-slate-500">#{item.cardId}</p>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <span key={i} className="flex items-center gap-1 rounded-full border border-[#7AC74C]/30 bg-[#7AC74C]/10 px-2 py-1 text-xs font-semibold text-[#7AC74C]">
                            {item.type === "COINS"    && <>🪙 {item.amount} ZikaCoins</>}
                            {item.type === "TICKET"   && <>🎟️ Ticket ZikaLoot</>}
                            {item.type === "COSMETIC" && <>🎨 {item.itemName}</>}
                            {item.type === "CUSTOM"   && <>🎁 {item.description}</>}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Sorteio em</p>
                <p className="text-sm text-slate-300">
                  {new Date(activeLoot.drawAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Números escolhidos</p>
                <p className="text-sm text-slate-300">{activeLoot.picks.length}/200</p>
              </div>
            </div>
            {(myPickMap.get(activeLoot.id)??[]).length > 0 && (
              <p className="mt-2 text-xs text-[#FFCB05]">
                ✓ {(myPickMap.get(activeLoot.id)?.length ?? 0) > 1 ? "Seus números" : "Seu número"}: <strong>{(myPickMap.get(activeLoot.id) ?? []).join(", ")}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Board de números */}
      {activeLoot && (
        <LootBoard
          lootId={activeLoot.id}
          picks={activeLoot.picks.map((p) => ({ number: p.number, playerName: p.player.displayName }))}
          blockedNumbers={activeLoot.drawnNumbers}
          myNumbers={myPickMap.get(activeLoot.id) ?? []}
          hasTicket={ticketCount > 0}
          isLoggedIn={!!player}
          drawAt={activeLoot.drawAt.toISOString()}
          previousDraws={activeLoot.drawnNumbers}
        />
      )}

      {/* Admin panel */}
      {admin && <AdminLootPanel loots={loots.map((l) => ({
        id: l.id,
        name: l.name,
        prize: l.prize,
        description: l.description,
        status: l.status,
        drawAt: l.drawAt.toISOString(),
        drawnNumber: l.drawnNumber,
        winnerName: l.winner?.displayName ?? null,
        picksCount: l.picks.length,
        prizeConfig: l.prizeConfig
      }))} />}

      {/* Histórico */}
      <div className="space-y-3">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2">
          <Trophy size={16} className="text-[#FFCB05]" /> Histórico de Loterias
        </h2>
        {loots.filter((l) => l.status !== ZikaLootStatus.SCHEDULED).length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum sorteio realizado ainda.</p>
        ) : (
          <div className="space-y-2">
            {loots.filter((l) => l.status !== ZikaLootStatus.SCHEDULED).map((l) => (
              <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-slate-200">{l.name}</p>
                  <p className="text-xs text-slate-500">{statusLabel[l.status]} · {l.picks.length} participantes</p>
                  {l.drawnNumber && (
                    <p className="text-sm mt-1">
                      Número sorteado: <strong className="text-[#FFCB05]">{l.drawnNumber}</strong>
                      {l.winner ? (
                        <span className="ml-2 text-[#7AC74C]">🏆 {l.winner.displayName}</span>
                      ) : (
                        <span className="ml-2 text-slate-500">— sem vencedor</span>
                      )}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  {new Date(l.drawAt).toLocaleDateString("pt-BR")}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
