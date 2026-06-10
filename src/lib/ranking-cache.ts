// Server-only — não adicionar "use server" pois unstable_cache não exige Server Action
/**
 * ranking-cache.ts — Wrappers cacheados para computeGlobalRanking e computePlayerRanking.
 *
 * Ambos usam a tag "ranking" — a mesma que partidas/actions.ts já invalida via
 * revalidateTag("ranking") ao confirmar partidas. TTL de 5 min como fallback.
 */
import { unstable_cache } from "next/cache";
import { computeGlobalRanking, computePlayerRanking } from "@/lib/ranking";

/** Ranking global cacheado por 5 min ou até confirmação de partida. */
export const getCachedGlobalRanking = unstable_cache(
  (seasonId?: string) => computeGlobalRanking(seasonId),
  ["global-ranking"],
  { revalidate: 300, tags: ["ranking"] },
);

/** Ranking por temporada (todos os jogadores) cacheado por 5 min. */
export const getCachedPlayerRanking = unstable_cache(
  (seasonId: string) => computePlayerRanking(seasonId),
  ["player-ranking"],
  { revalidate: 300, tags: ["ranking"] },
);
