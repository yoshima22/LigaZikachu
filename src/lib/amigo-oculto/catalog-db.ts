// Resolve os pacotes com os itens reais da loja (tipo + imagem original). Itens que não existem mais são omitidos.
import { prisma } from "@/lib/prisma";
import { PACKAGES, MIMO, type GiftPackage } from "./catalog";

export type ResolvedItem = { name: string; qty: number; type: string | null; imageUrl: string | null; egg?: "COMMON" | "RARE" | "SPECIAL" };
export type ResolvedPackage = Omit<GiftPackage, "items"> & { items: ResolvedItem[] };

export async function loadPackages(): Promise<ResolvedPackage[]> {
  const names = [...new Set(PACKAGES.flatMap((p) => p.items.map((i) => i.name)))];
  const rows = await prisma.shopItem.findMany({ where: { name: { in: names }, active: true }, select: { name: true, type: true, imageUrl: true } });
  const byName = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!byName.has(r.name)) byName.set(r.name, r);
  return PACKAGES.map((p) => ({ ...p, items: p.items.flatMap((i) => { const r = byName.get(i.name); return r ? [{ ...i, type: r.type as string, imageUrl: r.imageUrl }] : []; }) }))
    .filter((p) => p.items.length > 0 || p.food || p.sweet);
}

// Payload TOURNAMENT_BOX da Caixa de Presentes: itens por nome (inventário), ovos reais e comida/doce.
export function giftPayload(p: ResolvedPackage, mimo: boolean) {
  return {
    rewardKind: "TOURNAMENT_BOX",
    origin: "Amigo Oculto",
    food: (p.food ?? 0) + (mimo ? MIMO.food : 0),
    sweet: (p.sweet ?? 0) + (mimo ? MIMO.sweet : 0),
    eggs: p.items.filter((i) => i.egg).map((i) => ({ type: i.egg, quantity: i.qty })),
    shopItems: p.items.filter((i) => !i.egg && i.type).map((i) => ({ type: i.type, itemName: i.name, quantity: i.qty })),
  };
}
