"use server";
import {requireAdmin} from "@/lib/auth/permissions";
import {prisma} from "@/lib/prisma";
import {adminGrantVip,getActiveSchedule} from "@/app/(app)/passe-apoiador/actions";
import {revalidatePath} from "next/cache";
export async function activatePaidPass(orderId:string,retroactive:boolean){await requireAdmin();const order=await prisma.ligaCashOrder.findUnique({where:{id:orderId}});if(!order||order.status!=="PAID"||order.productType!=="SUPPORTER_PASS"||order.fulfilledAt)return {error:"Pedido não está disponível."};let key=order.passScheduleKey;if(!key&&order.passOfferSlot){const cfg=await prisma.passScheduleConfig.findFirst({where:order.passOfferSlot==="CURRENT"?{isCurrentStorePass:true}:{isNextStorePass:true},select:{id:true}});key=cfg?.id??null}if(!key)return{error:"Marque o calendário correspondente antes de distribuir este passe."};const label=key==="singleton"?"Passe Apoiador":key;const schedule=await getActiveSchedule(label);const granted=await adminGrantVip({playerId:order.playerId,days:schedule.length,startDay:1,passLabel:label});if(!granted.ok||!granted.passId)return {error:granted.error};await prisma.$transaction([prisma.supporterPass.update({where:{id:granted.passId},data:{allowRetroactiveClaims:retroactive}}),prisma.ligaCashOrder.update({where:{id:order.id},data:{fulfilledAt:new Date(),passScheduleKey:key}})]);revalidatePath("/admin");return {ok:true};}

/**
 * Inclui vários jogadores (por nome) na LISTA do próximo passe de uma vez. Cada
 * um vira uma reserva (pedido PAID de PASS_NEXT), o que já apaga o botão de
 * compra do próximo passe no LigaCash para eles. A escolha de retroatividade é
 * guardada no calendário do próximo passe e aplicada quando a lista for ativada.
 */
export async function adminAddPassReservations(rawNames: string, retroactive: boolean): Promise<{ error?: string; added?: number; already?: number; notFound?: string[] }> {
  await requireAdmin();
  const next = await prisma.passScheduleConfig.findFirst({ where: { isNextStorePass: true }, select: { id: true, displayTitle: true } });
  if (!next) return { error: "Marque um calendário como 'Próximo passe da loja' antes de montar a lista." };

  const names = [...new Set(rawNames.split(/[\n,;]+/).map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return { error: "Informe ao menos um nome." };

  // Guarda a preferência de retroatividade deste lote no calendário do próximo passe.
  await prisma.passScheduleConfig.update({ where: { id: next.id }, data: { allowRetroactiveClaims: retroactive } });

  const players = await prisma.player.findMany({
    where: { OR: names.map((n) => ({ displayName: { equals: n, mode: "insensitive" as const } })) },
    select: { id: true, displayName: true },
  });
  const foundByLower = new Map(players.map((p) => [p.displayName.toLowerCase(), p]));
  const notFound = names.filter((n) => !foundByLower.has(n.toLowerCase()));

  const label = next.displayTitle?.trim() || "Passe do mês seguinte";
  let added = 0, already = 0;
  for (const player of players) {
    const exists = await prisma.ligaCashOrder.findFirst({
      where: { playerId: player.id, productType: "SUPPORTER_PASS", passOfferSlot: "NEXT", passScheduleKey: next.id, status: { in: ["PAID", "PENDING"] } },
      select: { id: true },
    });
    if (exists) { already++; continue; }
    await prisma.ligaCashOrder.create({
      data: {
        playerId: player.id, productType: "SUPPORTER_PASS", productCode: "PASS_NEXT", productLabel: label,
        amountCents: 0, status: "PAID", paidAt: new Date(), provider: "ADMIN_MANUAL",
        passOfferSlot: "NEXT", passScheduleKey: next.id,
      },
    });
    added++;
  }
  revalidatePath("/admin");
  revalidatePath("/mercado/ligacoins");
  return { added, already, notFound };
}

/**
 * Ativa a lista do próximo passe: distribui o passe a todos os reservados (com a
 * retroatividade escolhida) e promove o calendário — o passe atual perde a marca,
 * o do mês seguinte vira o atual e o slot do próximo fica vazio.
 */
export async function adminActivateNextPassList(): Promise<{ error?: string; granted?: number; failed?: number }> {
  await requireAdmin();
  const next = await prisma.passScheduleConfig.findFirst({ where: { isNextStorePass: true } });
  if (!next) return { error: "Não há calendário marcado como 'Próximo passe da loja'." };

  const label = next.id === "singleton" ? "Passe Apoiador" : next.id;
  const schedule = await getActiveSchedule(label);
  const retro = next.allowRetroactiveClaims;

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
