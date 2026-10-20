import "server-only";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { signalRealtime } from "@/lib/realtime-signal";

export const ZIKA_TV_LIVE_TAG = "zika-tv-live";

/**
 * Uma live começou ou terminou: limpa o cache do selo "ao vivo" do menu e avisa
 * quem está online (menu, lista da Zika TV e quem está assistindo).
 */
export async function announceZikaTvChange(streamId: string | null) {
  try {
    revalidateTag(ZIKA_TV_LIVE_TAG);
  } catch {
    // Chamado durante a renderização (limpeza de lives paradas): o cache curto expira sozinho.
  }
  const anyLive = await prisma.specStream
    .count({ where: { status: "LIVE", lastSeenAt: { gte: new Date(Date.now() - 3 * 60_000) } } })
    .then((n) => n > 0)
    .catch(() => null);
  signalRealtime("zikatv", "live", { streamId, anyLive });
}
