"use server";
import {requireAdmin} from "@/lib/auth/permissions";
import {prisma} from "@/lib/prisma";
import {adminGrantVip,getActiveSchedule} from "@/app/(app)/passe-apoiador/actions";
import {revalidatePath} from "next/cache";
export async function activatePaidPass(orderId:string,retroactive:boolean){await requireAdmin();const order=await prisma.ligaCashOrder.findUnique({where:{id:orderId}});if(!order||order.status!=="PAID"||order.productType!=="SUPPORTER_PASS"||order.fulfilledAt)return {error:"Pedido não está disponível."};let key=order.passScheduleKey;if(!key&&order.passOfferSlot){const cfg=await prisma.passScheduleConfig.findFirst({where:order.passOfferSlot==="CURRENT"?{isCurrentStorePass:true}:{isNextStorePass:true},select:{id:true}});key=cfg?.id??null}if(!key)return{error:"Marque o calendário correspondente antes de distribuir este passe."};const label=key==="singleton"?"Passe Apoiador":key;const schedule=await getActiveSchedule(label);const granted=await adminGrantVip({playerId:order.playerId,days:schedule.length,startDay:1,passLabel:label});if(!granted.ok||!granted.passId)return {error:granted.error};await prisma.$transaction([prisma.supporterPass.update({where:{id:granted.passId},data:{allowRetroactiveClaims:retroactive}}),prisma.ligaCashOrder.update({where:{id:order.id},data:{fulfilledAt:new Date(),passScheduleKey:key}})]);revalidatePath("/admin");return {ok:true};}

/** Busca jogadores por nome (autocomplete da lista do próximo passe). */
export async function searchPlayersForPass(query: string): Promise<{ id: string; displayName: string; onList: boolean }[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];
  const next = await prisma.passScheduleConfig.findFirst({ where: { isNextStorePass: true }, select: { id: true } });
  const players = await prisma.player.findMany({
    where: { displayName: { contains: q, mode: "insensitive" } },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
    take: 10,
  });
  if (!next || players.length === 0) return players.map((p) => ({ ...p, onList: false }));
  const reserved = await prisma.ligaCashOrder.findMany({
    where: { playerId: { in: players.map((p) => p.id) }, productType: "SUPPORTER_PASS", passOfferSlot: "NEXT", passScheduleKey: next.id, status: { in: ["PAID", "PENDING"] }, fulfilledAt: null },
    select: { playerId: true },
  });
  const onList = new Set(reserved.map((r) => r.playerId));
  return players.map((p) => ({ ...p, onList: onList.has(p.id) }));
}

/**
 * Inclui UM jogador na LISTA do próximo passe (lista de espera). Cria uma reserva
 * (pedido PAID de PASS_NEXT) que já apaga o botão de compra do próximo passe no
 * LigaCash para ele. Não ativa nada — apenas entra na fila de distribuição.
 */
export async function adminAddPassReservation(playerId: string): Promise<{ error?: string; ok?: boolean; already?: boolean; name?: string }> {
  await requireAdmin();
  const next = await prisma.passScheduleConfig.findFirst({ where: { isNextStorePass: true }, select: { id: true, displayTitle: true } });
  if (!next) return { error: "Marque um calendário como 'Próximo passe da loja' antes de montar a lista." };
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, displayName: true } });
  if (!player) return { error: "Jogador não encontrado." };

  const exists = await prisma.ligaCashOrder.findFirst({
    where: { playerId: player.id, productType: "SUPPORTER_PASS", passOfferSlot: "NEXT", passScheduleKey: next.id, status: { in: ["PAID", "PENDING"] }, fulfilledAt: null },
    select: { id: true },
  });
  if (exists) return { already: true, name: player.displayName };

  await prisma.ligaCashOrder.create({
    data: {
      playerId: player.id, productType: "SUPPORTER_PASS", productCode: "PASS_NEXT", productLabel: next.displayTitle?.trim() || "Passe do mês seguinte",
      amountCents: 0, status: "PAID", paidAt: new Date(), provider: "ADMIN_MANUAL",
      passOfferSlot: "NEXT", passScheduleKey: next.id,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/mercado/ligacoins");
  return { ok: true, name: player.displayName };
}

/** Remove um jogador da lista de espera do próximo passe (reserva ainda não distribuída). */
export async function adminRemovePassReservation(orderId: string): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const order = await prisma.ligaCashOrder.findUnique({ where: { id: orderId }, select: { id: true, provider: true, fulfilledAt: true, passOfferSlot: true } });
  if (!order || order.fulfilledAt || order.passOfferSlot !== "NEXT") return { error: "Reserva não encontrada." };
  // Reservas manuais (cortesia) podem ser removidas; compras Pix não são apagadas aqui.
  if (order.provider !== "ADMIN_MANUAL") return { error: "Compras por Pix não podem ser removidas da lista; use a distribuição." };
  await prisma.ligaCashOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  revalidatePath("/admin");
  revalidatePath("/mercado/ligacoins");
  return { ok: true };
}

/**
 * Distribui o passe a TODOS da lista de espera do próximo passe (reservas manuais
 * + compras Pix), com a retroatividade escolhida na hora, e promove o calendário:
 * o passe atual perde a marca, o do mês seguinte vira o atual e o slot do próximo
 * fica vazio (esperando nova config). As reservas distribuídas saem da lista.
 */
export async function adminActivateNextPassList(retroactive: boolean): Promise<{ error?: string; granted?: number; failed?: number }> {
  await requireAdmin();
  const next = await prisma.passScheduleConfig.findFirst({ where: { isNextStorePass: true } });
  if (!next) return { error: "Não há calendário marcado como 'Próximo passe da loja'." };

  const label = next.id === "singleton" ? "Passe Apoiador" : next.id;
  const schedule = await getActiveSchedule(label);
  const retro = retroactive;

  const reservations = await prisma.ligaCashOrder.findMany({
    where: { productType: "SUPPORTER_PASS", passOfferSlot: "NEXT", status: "PAID", fulfilledAt: null, OR: [{ passScheduleKey: next.id }, { passScheduleKey: null }] },
    select: { id: true, playerId: true },
  });

  let granted = 0, failed = 0;
  for (const order of reservations) {
    const res = await adminGrantVip({ playerId: order.playerId, days: schedule.length, startDay: 1, passLabel: label });
    if (!res.ok || !res.passId) { failed++; continue; }
    await prisma.$transaction([
      prisma.supporterPass.update({ where: { id: res.passId }, data: { allowRetroactiveClaims: retro } }),
      prisma.ligaCashOrder.update({ where: { id: order.id }, data: { fulfilledAt: new Date(), passScheduleKey: next.id } }),
    ]);
    granted++;
  }

  // Promoção do calendário: atual perde a marca, próximo vira atual, próximo fica vazio.
  await prisma.$transaction([
    prisma.passScheduleConfig.updateMany({ where: { isCurrentStorePass: true }, data: { isCurrentStorePass: false } }),
    prisma.passScheduleConfig.update({ where: { id: next.id }, data: { isCurrentStorePass: true, isNextStorePass: false } }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/mercado/ligacoins");
  return { granted, failed };
}
