// Carteira de pontos do Rei do Rio (servidor). Ao fim de cada semana os pontos do ranking viram saldo (centésimos),
// que acumula entre edições e paga as caixas de recompensa (1 resgate por caixa). Tudo idempotente e atômico.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { giftPayload, resolveItems, type ResolvedItem } from "@/lib/amigo-oculto/catalog-db";
import { PT } from "./config";
import { REWARD_BOXES, boxByKey, optionOf } from "./rewards";

type Tx = Prisma.TransactionClient;

/** Credita o saldo dos jogadores reais de uma edição FINALIZADA (não-teste). Seguro rodar várias vezes: 1 crédito por (edição, jogador). */
export async function creditEditionPoints(tx: Tx, editionId: string) {
  const ed = await tx.reiRioEdition.findUnique({ where: { id: editionId }, select: { isTest: true, phase: true } });
  if (!ed || ed.isTest || ed.phase !== "FINISHED") return { credited: 0 };
  const parts = await tx.reiRioParticipant.findMany({ where: { editionId, isBot: false, totalScore: { gt: 0 } }, select: { playerKey: true, totalScore: true } });
  let credited = 0;
  for (const p of parts) {
    const ins = await tx.reiRioCredit.createMany({ data: [{ editionId, playerId: p.playerKey, amount: p.totalScore }], skipDuplicates: true });
    if (ins.count !== 1) continue;
    await tx.reiRioWallet.upsert({
      where: { playerId: p.playerKey },
      create: { playerId: p.playerKey, balance: p.totalScore, earned: p.totalScore },
      update: { balance: { increment: p.totalScore }, earned: { increment: p.totalScore } },
    });
    credited++;
  }
  return { credited };
}

export type BoxesView = {
  balance: number; earned: number; spent: number;
  boxes: { key: string; name: string; emoji: string; tier: number; cost: number; blurb: string; claimed: { optionKey: string; at: string } | null; options: { key: string; label: string; items: ResolvedItem[] }[] }[];
};

export async function loadBoxesView(playerId: string): Promise<BoxesView> {
  const [wallet, claims] = await Promise.all([
    prisma.reiRioWallet.findUnique({ where: { playerId } }),
    prisma.reiRioBoxClaim.findMany({ where: { playerId }, select: { boxKey: true, optionKey: true, createdAt: true } }),
  ]);
  const resolved = await resolveItems(REWARD_BOXES.flatMap((b) => b.options.map((o) => o.items)));
  let n = 0;
  const claimBy = new Map(claims.map((c) => [c.boxKey, c]));
  return {
    balance: wallet?.balance ?? 0, earned: wallet?.earned ?? 0, spent: wallet?.spent ?? 0,
    boxes: REWARD_BOXES.map((b) => ({
      key: b.key, name: b.name, emoji: b.emoji, tier: b.tier, cost: b.cost, blurb: b.blurb,
      claimed: claimBy.has(b.key) ? { optionKey: claimBy.get(b.key)!.optionKey, at: claimBy.get(b.key)!.createdAt.toISOString() } : null,
      options: b.options.map((o) => ({ key: o.key, label: o.label, items: resolved[n++] })),
    })),
  };
}

/** Resgata uma caixa: debita o saldo, registra o resgate (único por jogador+caixa) e cria o presente na Caixa de Presentes. */
export async function claimBox(playerId: string, boxKey: string, optionKey: string): Promise<{ ok: true; giftId: string } | { ok: false; error: string }> {
  const box = boxByKey(boxKey);
  const opt = box && optionOf(box, optionKey);
  if (!box || !opt) return { ok: false, error: "Caixa ou opção inválida." };
  const cost = box.cost * PT;
  const [items] = await resolveItems([opt.items]);
  if (!items.length) return { ok: false, error: "Itens indisponíveis no momento." };
  const pkg = { key: `${box.key}:${opt.key}`, tier: 1 as const, name: box.name, emoji: box.emoji, items };
  try {
    const giftId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"rdr-wallet:" + playerId}))`;
      if (await tx.reiRioBoxClaim.findUnique({ where: { playerId_boxKey: { playerId, boxKey } }, select: { id: true } })) throw new Error("Você já resgatou esta caixa.");
      const debit = await tx.reiRioWallet.updateMany({ where: { playerId, balance: { gte: cost } }, data: { balance: { decrement: cost }, spent: { increment: cost } } });
      if (debit.count !== 1) throw new Error("Pontos insuficientes para esta caixa.");
      const gift = await tx.playerGift.create({
        data: { playerId, type: "CUSTOM", title: `${box.emoji} Rei do Rio: ${box.name}`, description: `Opção escolhida: ${opt.label}.`, payload: { ...giftPayload(pkg, null), origin: "Rei do Rio" } as Prisma.InputJsonValue },
      });
      await tx.reiRioBoxClaim.create({ data: { playerId, boxKey, optionKey, cost, giftId: gift.id } });
      return gift.id;
    });
    return { ok: true, giftId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível resgatar." };
  }
}
