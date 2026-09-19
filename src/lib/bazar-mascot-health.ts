import { prisma } from "@/lib/prisma";

type PayloadListing = { payload: unknown };

function collectMascotIds(payload: Record<string, unknown>): string[] {
  const ids: string[] = [];
  if (typeof payload.mascotId === "string") ids.push(payload.mascotId);
  if (Array.isArray(payload.bundleItems)) {
    for (const item of payload.bundleItems as Array<{ mascotId?: unknown }>) {
      if (typeof item.mascotId === "string") ids.push(item.mascotId);
    }
  }
  return ids;
}

/**
 * Marca `diseased` no payload dos anúncios cujo mascote está doente agora.
 * O payload é um snapshot tirado no momento do anúncio, então a saúde precisa
 * vir do banco na leitura — senão o comprador veria o estado de dias atrás.
 */
export async function withMascotHealth<T extends PayloadListing>(listings: T[]): Promise<T[]> {
  const ids = [...new Set(listings.flatMap((listing) => collectMascotIds((listing.payload ?? {}) as Record<string, unknown>)))];
  if (ids.length === 0) return listings;

  const sick = await prisma.mascot.findMany({
    where: { id: { in: ids }, diseasedAt: { not: null } },
    select: { id: true },
  }).catch(() => []);
  if (sick.length === 0) return listings;

  const sickIds = new Set(sick.map((mascot) => mascot.id));
  return listings.map((listing) => {
    const payload = (listing.payload ?? {}) as Record<string, unknown>;
    const mascotIds = collectMascotIds(payload);
    if (!mascotIds.some((id) => sickIds.has(id))) return listing;
    return { ...listing, payload: { ...payload, diseased: true } };
  });
}
