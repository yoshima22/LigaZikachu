// Black Friday do Miauvadão (2026): janela, regras de preço e cupons do sorteio final.
// A janela e os percentuais são constantes (evento único). Os 20% da ZikaShop vivem numa ShopPromotion
// global (id BF_PROMO_ID), que o admin pode desligar em /shop/admin.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { changeLigaCash } from "@/lib/liga-cash-wallet";
import { publishLeagueTicker } from "@/lib/league-ticker";

import { BF_ENDS_AT, BF_KEY, BF_PRIZE_LC } from "./black-friday-core";
export * from "./black-friday-core";

type Tx = Prisma.TransactionClient;

/** Registra quem aproveitou a promoção (no-op sem economia, ou seja, fora do evento). */
export async function bfRecordUsage(db: Tx | typeof prisma, a: { playerId: string; kind: "SHOP" | "MIAUVADAO" | "LC_PACKAGE"; label: string; currency: "ZC" | "LC" | "BRL"; saved: number; bonusLc?: number }) {
  if (a.saved <= 0 && !a.bonusLc) return;
  await db.blackFridayUsage.create({ data: { playerId: a.playerId, kind: a.kind, label: a.label.slice(0, 160), currency: a.currency, savedAmount: Math.max(0, Math.round(a.saved)), bonusLc: a.bonusLc ?? 0 } });
}

/** Concede os cupons de um pedido de LC pago (1 por LC do pacote), numerados em sequência. Idempotente por orderId. */
export async function bfGrantTickets(tx: Tx, order: { id: string; playerId: string; eventKey: string | null; ligaCoins: number; bonusLigaCoins: number; eventBonusLc: number }) {
  if (order.eventKey !== BF_KEY) return;
  const quantity = order.ligaCoins + order.bonusLigaCoins - order.eventBonusLc;
  if (quantity <= 0) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('black-friday-tickets'))`;
  if (await tx.blackFridayTicket.findUnique({ where: { orderId: order.id }, select: { id: true } })) return;
  const last = await tx.blackFridayTicket.findFirst({ orderBy: { startNumber: "desc" }, select: { startNumber: true, quantity: true } });
  const startNumber = last ? last.startNumber + last.quantity : 1;
  await tx.blackFridayTicket.create({ data: { playerId: order.playerId, orderId: order.id, startNumber, quantity } });
}

export type BfSummary = { totalTickets: number; players: number; draw: { winningNumber: number; winnerName: string; totalTickets: number; prizeLc: number; drawnAt: Date } | null };

export async function bfSummary(): Promise<BfSummary> {
  const [agg, players, draw] = await Promise.all([
    prisma.blackFridayTicket.aggregate({ _sum: { quantity: true } }),
    prisma.blackFridayTicket.groupBy({ by: ["playerId"] }),
    prisma.blackFridayDraw.findUnique({ where: { id: BF_KEY } }),
  ]);
  const winner = draw ? await prisma.player.findUnique({ where: { id: draw.winnerPlayerId }, select: { displayName: true } }) : null;
  return { totalTickets: agg._sum.quantity ?? 0, players: players.length, draw: draw ? { winningNumber: draw.winningNumber, winnerName: winner?.displayName ?? "Jogador", totalTickets: draw.totalTickets, prizeLc: draw.prizeLc, drawnAt: draw.drawnAt } : null };
}

/**
 * Sorteia o número vencedor assim que o evento acaba (e não há Pix do evento ainda aguardando pagamento).
 * Chamado sob demanda (página do evento) e pelo cron; idempotente via lock + PK da tabela.
 */
export async function bfDrawIfDue(now = new Date()): Promise<boolean> {
  if (now < BF_ENDS_AT) return false;
  if (await prisma.blackFridayDraw.findUnique({ where: { id: BF_KEY }, select: { id: true } })) return false;
  const pending = await prisma.ligaCashOrder.count({ where: { eventKey: BF_KEY, status: "PENDING", expiresAt: { gt: now } } });
  if (pending > 0) return false;
  const winner = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('black-friday-draw'))`;
    if (await tx.blackFridayDraw.findUnique({ where: { id: BF_KEY }, select: { id: true } })) return null;
    const agg = await tx.blackFridayTicket.aggregate({ _sum: { quantity: true } });
    const total = agg._sum.quantity ?? 0;
    if (total <= 0) return null;
    const { randomInt } = await import("crypto");
    const winningNumber = randomInt(1, total + 1);
    const ticket = await tx.blackFridayTicket.findFirst({ where: { startNumber: { lte: winningNumber } }, orderBy: { startNumber: "desc" } });
    if (!ticket || winningNumber >= ticket.startNumber + ticket.quantity) throw new Error("Cupom vencedor não encontrado.");
    await tx.blackFridayDraw.create({ data: { id: BF_KEY, winningNumber, winnerPlayerId: ticket.playerId, totalTickets: total, prizeLc: BF_PRIZE_LC } });
    await changeLigaCash(tx, { playerId: ticket.playerId, amount: BF_PRIZE_LC, reason: "EVENT_REWARD", referenceType: "BlackFridayDraw", referenceId: BF_KEY, metadata: { winningNumber, total } });
    return { playerId: ticket.playerId, winningNumber, total };
  });
  if (!winner) return false;
  try {
    const p = await prisma.player.findUnique({ where: { id: winner.playerId }, select: { displayName: true } });
    await publishLeagueTicker({ type: "BLACK_FRIDAY", message: `🎟️ Sorteio da Black Friday: o cupom nº ${winner.winningNumber} (de ${winner.total.toLocaleString("pt-BR")}) é de ${p?.displayName ?? "um treinador"}, que ganhou ${BF_PRIZE_LC} LC! Parabéns!`, href: "/black-friday", ttlHours: 24 });
    await prisma.playerNotification.create({ data: { playerId: winner.playerId, category: "GIFT", type: "BLACK_FRIDAY_WIN", title: "🎟️ Você ganhou o sorteio da Black Friday!", body: `Seu cupom nº ${winner.winningNumber} foi sorteado: ${BF_PRIZE_LC} LC já estão na sua carteira.`, href: "/black-friday", entityId: BF_KEY, eventKey: `bf-win:${BF_KEY}` } }).catch(() => null);
  } catch (e) { console.error("[BlackFriday] falha ao anunciar", e); }
  return true;
}
