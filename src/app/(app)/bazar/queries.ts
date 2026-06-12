import { unstable_cache } from "next/cache";
import { getListings, getRecentTransactions } from "./actions";

/** Listagens do bazar — 45s de cache por combinação de filtros. Invalidado por tag. */
export function getCachedListings(filters?: Parameters<typeof getListings>[0]) {
  const key = JSON.stringify(filters ?? {});
  return unstable_cache(
    () => getListings(filters),
    ["bazar-listings", key],
    { revalidate: 45, tags: ["bazar-listings"] },
  )();
}

/** Transações recentes — 60s de cache global. Invalidado por tag. */
export const getCachedRecentTransactions = unstable_cache(
  (take = 6) => getRecentTransactions(take),
  ["bazar-transactions"],
  { revalidate: 60, tags: ["bazar-transactions"] },
);
