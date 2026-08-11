import { unstable_cache } from "next/cache";
import { getListings, getRecentTransactions } from "./actions";
import { prisma } from "@/lib/prisma";

/** Listagens do bazar — 45s de cache por combinação de filtros. Invalidado por tag. */
export function getCachedListings(filters?: Parameters<typeof getListings>[0]) {
  const key = JSON.stringify(filters ?? {});
  return unstable_cache(
    () => getListings(filters),
    ["bazar-listings", key],
    { revalidate: 45, tags: ["bazar-listings"] },
  )();
}

/** Vitrine premium: no máximo seis registros e cacheada junto dos anúncios. */
export function getCachedPremiumListings(filters?: Parameters<typeof getListings>[0]) {
  const premiumFilters = { ...(filters ?? {}), page: 1, premiumMode: "only" as const };
  const key = JSON.stringify(premiumFilters);
  return unstable_cache(
    () => getListings(premiumFilters),
    ["bazar-premium-listings-v2", key],
    { revalidate: 45, tags: ["bazar-listings"] },
  )();
}

export const getCachedPremiumAvailability = unstable_cache(
  async () => {
    const active = await prisma.bazarListing.findMany({
      where: { status: { in: ["ACTIVE", "RESERVED"] }, expiresAt: { gt: new Date() }, premiumUntil: { gt: new Date() } },
      orderBy: { premiumUntil: "asc" },
      select: { premiumUntil: true },
      take: 6,
    });
    return { activeCount: active.length, nextVacancyAt: active[0]?.premiumUntil ?? null };
  },
  ["bazar-premium-availability"],
  { revalidate: 30, tags: ["bazar-listings"] },
);

/** Transações recentes — 60s de cache global. Invalidado por tag. */
export const getCachedRecentTransactions = unstable_cache(
  (take = 6) => getRecentTransactions(take),
  ["bazar-transactions"],
  { revalidate: 60, tags: ["bazar-transactions"] },
);
