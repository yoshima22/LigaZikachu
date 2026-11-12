// Resolve os kits com os itens reais da loja (tipo + imagem original). Itens da loja que não existem mais são omitidos.
import { prisma } from "@/lib/prisma";
import { eggImageUrl } from "@/lib/egg-origin";
import { PACKAGES, MIMO, type EggKind, type Fx, type GiftPackage } from "./catalog";

export type ResolvedItem = { name: string; qty: number; type: string | null; imageUrl: string | null; egg?: EggKind; fx?: Fx };
export type ResolvedPackage = Omit<GiftPackage, "items"> & { items: ResolvedItem[] };

export async function loadPackages(): Promise<ResolvedPackage[]> {
  const names = [...new Set(PACKAGES.flatMap((p) => p.items.filter((i) => !i.egg && !i.fx).map((i) => i.name)))];
  const rows = await prisma.shopItem.findMany({ where: { name: { in: names }, active: true }, select: { name: true, type: true, imageUrl: true } });
  const byName = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!byName.has(r.name)) byName.set(r.name, r);
  return PACKAGES.map((p) => ({
    ...p,
    items: p.items.flatMap((i): ResolvedItem[] => {
      if (i.egg) return [{ ...i, type: null, imageUrl: eggImageUrl(i.egg) }];
      if (i.fx) return [{ ...i, type: null, imageUrl: null }];
      const r = byName.get(i.name);
      return r ? [{ ...i, type: r.type as string, imageUrl: r.imageUrl }] : [];
    }),
  }));
}

// Payload TOURNAMENT_BOX da Caixa de Presentes: itens por nome (inventário), ovos reais, comida/doce e pedras de mega sorteadas.
export function giftPayload(p: ResolvedPackage, mimo: boolean) {
  const fxQty = (k: Fx) => p.items.filter((i) => i.fx === k).reduce((s, i) => s + i.qty, 0);
  return {
    rewardKind: "TOURNAMENT_BOX",
    origin: "Amigo Oculto",
    food: fxQty("FOOD") + (mimo ? MIMO.food : 0),
    sweet: fxQty("SWEET") + (mimo ? MIMO.sweet : 0),
    rareSweet: fxQty("RARE_SWEET"),
    randomMegaStones: fxQty("MEGA"),
    eggs: p.items.filter((i) => i.egg).map((i) => ({ type: i.egg, quantity: i.qty })),
    shopItems: p.items.filter((i) => !i.egg && !i.fx && i.type).map((i) => ({ type: i.type, itemName: i.name, quantity: i.qty })),
  };
}
