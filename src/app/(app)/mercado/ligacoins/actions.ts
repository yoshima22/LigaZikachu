"use server";
import { getSessionUser } from "@/lib/auth/permissions";
import { isAdmin } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CASH_PRODUCTS, cardPriceCents, fulfillLigaCashOrder, professorEnguicaThankYou } from "@/lib/liga-cash";
import { changeLigaCash } from "@/lib/liga-cash-wallet";

const ligaCashGiftSchema = z.object({
  recipientPlayerId: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  content: z.string().trim().min(1).max(350),
});

const cardPaymentSchema = z.object({
  token: z.string().min(8).max(200),
  paymentMethodId: z.string().min(2).max(40),
  issuerId: z.string().max(40).optional(),
  installments: z.number().int().min(1).max(12),
});

/**
 * DEBUG (admin): simula uma compra bem-sucedida. Credita realisticamente o valor
 * do pacote de LC na conta do próprio admin e devolve a notificação do Professor
 * Enguiça para pré-visualização LOCAL (não é transmitida a ninguém). Passes só
 * testam a mensagem (não são concedidos no debug).
 */
export async function debugSimulateLigaCashPurchase(code: string): Promise<{ error?: string; creditedLc?: number; title?: string; body?: string; note?: string }> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return { error: "Apenas administradores." };
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true, displayName: true } });
  if (!player) return { error: "Jogador não encontrado." };

  const isPass = code === "PASS_CURRENT" || code === "PASS_NEXT";
  const product = CASH_PRODUCTS.find((p) => p.code === code);
  if (!product && !isPass) return { error: "Pacote inválido." };

  let creditedLc = 0;
  let note: string | undefined;
  if (product && product.type === "LIGA_COINS") {
    creditedLc = product.base + product.bonus;
    await prisma.$transaction(async (tx) => {
      await changeLigaCash(tx, {
        playerId: player.id,
        amount: creditedLc,
        reason: "ADMIN_GRANT",
        referenceType: "DebugSimulatedPurchase",
        actorUserId: user.id,
        purchasedDelta: creditedLc,
        metadata: { debug: true, productCode: product.code, simulated: true },
      });
    });
    revalidatePath("/mercado/ligacoins");
    revalidatePath("/carteira");
  } else {
    note = "Debug de Passe: apenas a notificação é testada (o passe não é concedido).";
  }

  const msg = professorEnguicaThankYou(player.displayName, isPass ? "SUPPORTER_PASS" : "LIGA_COINS");
  return { creditedLc, title: msg.title, body: msg.body, note };
}

export async function createLigaCashPayment(code:string,cpf:string,payerEmail:string,gift?:z.infer<typeof ligaCashGiftSchema>,card?:z.infer<typeof cardPaymentSchema>){
  const user=await getSessionUser(); if(!user) return {error:"Faça login novamente."};
  const player=await prisma.player.findUnique({where:{userId:user.id},select:{id:true}}); if(!player) return {error:"Jogador não encontrado."};
  const parsedGift=gift?ligaCashGiftSchema.safeParse(gift):null;
  if(parsedGift&&!parsedGift.success)return{error:"Informe um jogador, título (até 80 caracteres) e mensagem (até 350 caracteres)."};
  const parsedCard=card?cardPaymentSchema.safeParse(card):null;
  if(parsedCard&&!parsedCard.success)return{error:"Dados do cartão inválidos. Confira o formulário e tente novamente."};
  let product:{code:string;type:"LIGA_COINS"|"SUPPORTER_PASS";label:string;base:number;bonus:number;cents:number;adminOnly?:boolean}|undefined=CASH_PRODUCTS.find(p=>p.code===code);
  let passScheduleKey:string|null=null;let passOfferSlot:string|null=null;
  if(code==="PASS_CURRENT"||code==="PASS_NEXT"){
    passOfferSlot=code==="PASS_CURRENT"?"CURRENT":"NEXT";
    const config=await prisma.passScheduleConfig.findFirst({where:passOfferSlot==="CURRENT"?{isCurrentStorePass:true}:{isNextStorePass:true},select:{id:true,displayTitle:true}});
    if(code==="PASS_CURRENT"&&!config)return{error:"O passe atual ainda não foi definido pelo administrador."};
    passScheduleKey=config?.id??null;product={code,type:"SUPPORTER_PASS",label:config?.displayTitle?.trim()||(code==="PASS_CURRENT"?"Passe atual":"Passe do mês seguinte"),base:0,bonus:0,cents:2000};
  }
  if(!product) return {error:"Pacote inválido."};
  let giftRecipient:{id:string;displayName:string}|null=null;
  if(parsedGift?.success){
    if(product.type!=="LIGA_COINS")return{error:"Somente pacotes de LigaCash podem ser presenteados."};
    if(parsedGift.data.recipientPlayerId===player.id)return{error:"Escolha outro jogador para presentear."};
    giftRecipient=await prisma.player.findFirst({where:{id:parsedGift.data.recipientPlayerId,user:{status:"ACTIVE"}},select:{id:true,displayName:true}});
    if(!giftRecipient)return{error:"Destinatário não encontrado ou inativo."};
  }
  // Impede comprar de novo um passe que o jogador já possui (ou já garantiu).
  if(passOfferSlot==="CURRENT"&&passScheduleKey){
    const label=passScheduleKey==="singleton"?"Passe Apoiador":passScheduleKey;
    const has=await prisma.supporterPass.findFirst({where:{playerId:player.id,passLabel:label,active:true,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true}});
    if(has)return{error:"Você já possui este passe."};
  }
  if(passOfferSlot==="NEXT"&&passScheduleKey){
    const has=await prisma.ligaCashOrder.findFirst({where:{playerId:player.id,productType:"SUPPORTER_PASS",passOfferSlot:"NEXT",passScheduleKey,status:{in:["PAID","PENDING"]}},select:{id:true}});
    if(has)return{error:"Você já garantiu este passe."};
  }
  const document=cpf.replace(/\D/g,"");if(document.length!==11)return{error:"Informe um CPF válido para o pagamento."};
  const email=payerEmail.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return{error:"Informe o e-mail do pagador."};
  if("adminOnly" in product&&product.adminOnly&&!isAdmin(user.role)) return {error:"Pacote disponível somente para testes administrativos."};
  const token=process.env.MERCADO_PAGO_ACCESS_TOKEN; const base=process.env.NEXT_PUBLIC_APP_URL;
  if(!token||!base) return {error:"Os pagamentos ainda não foram habilitados pelo administrador."};
  const now=new Date();
  const staleBefore=new Date(now.getTime()-60*60_000);
  await prisma.ligaCashOrder.updateMany({where:{playerId:player.id,status:"PENDING",OR:[{expiresAt:{lte:now}},{expiresAt:null},{createdAt:{lte:staleBefore}}]},data:{status:"EXPIRED"}});
  const pendingCount=await prisma.ligaCashOrder.count({where:{playerId:player.id,status:"PENDING",expiresAt:{gt:now}}});
  if(pendingCount>=3)return {error:"Você já possui 3 pedidos em aberto. Pague, cancele ou aguarde a expiração."};
  const isCard=Boolean(parsedCard?.success);
  const expiresAt=new Date(Date.now()+30*60_000);
  const amountCents=isCard?cardPriceCents(product.cents):product.cents;
  const order=await prisma.ligaCashOrder.create({data:{playerId:player.id,productType:product.type,productCode:product.code,productLabel:giftRecipient?`${product.label} — presente para ${giftRecipient.displayName}`:product.label,ligaCoins:product.base,bonusLigaCoins:product.bonus,amountCents,expiresAt,provider:isCard?"MERCADO_PAGO_CARD":"MERCADO_PAGO",passScheduleKey,passOfferSlot,giftRecipientPlayerId:giftRecipient?.id,giftTitle:parsedGift?.success?parsedGift.data.title:null,giftMessage:parsedGift?.success?parsedGift.data.content:null}});
  const paymentData=isCard?{
    transaction_amount:amountCents/100,description:`Liga Zikachu - ${product.label}`,token:parsedCard!.data.token,
    installments:parsedCard!.data.installments,payment_method_id:parsedCard!.data.paymentMethodId,
    ...(parsedCard!.data.issuerId?{issuer_id:parsedCard!.data.issuerId}:{}),
    payer:{email,identification:{type:"CPF",number:document}},external_reference:order.id,notification_url:`${base}/api/payments/mercado-pago`,
  }:{transaction_amount:amountCents/100,description:`Liga Zikachu - ${product.label}`,payment_method_id:"pix",date_of_expiration:expiresAt.toISOString(),payer:{email,identification:{type:"CPF",number:document}},external_reference:order.id,notification_url:`${base}/api/payments/mercado-pago`};
  let response:Response;
  try { response=await fetch("https://api.mercadopago.com/v1/payments",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","X-Idempotency-Key":order.id},body:JSON.stringify(paymentData)}); }
  catch { await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}}); return {error:"Não foi possível conectar ao Mercado Pago. Tente novamente."}; }
  const payment=await response.json().catch(()=>null);
  if(!payment||(!payment.id&&response.ok)){
    await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}});
    return {error:"O Mercado Pago não confirmou a criação da cobrança. Tente novamente."};
  }
  if(!response.ok){const causes=Array.isArray(payment?.cause)?payment.cause.map((item:unknown)=>{if(typeof item!=="object"||item===null)return"unknown";const cause=item as{code?:unknown;description?:unknown};return`${String(cause.code??"unknown")}${cause.description?`: ${String(cause.description)}`:""}`}):[];const providerMessage=typeof payment?.message==="string"?payment.message:typeof payment?.error==="string"?payment.error:null;await prisma.$transaction([prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}}),prisma.auditLog.create({data:{actorUserId:user.id,entityType:"LigaCashOrder",entityId:order.id,action:"ligacoins.payment_rejected",metadata:{httpStatus:response.status,providerMessage,causes}}})]);console.error("[LigaCoins] Mercado Pago recusou a criação",{orderId:order.id,httpStatus:response.status,providerMessage,causes});const detail=[providerMessage,...causes].filter(Boolean).join(" · ");return {error:detail?`Mercado Pago (${response.status}): ${detail}`:`O Mercado Pago recusou a cobrança (HTTP ${response.status}).`};}
  if(isCard&&payment.payment_type_id!=="credit_card"){
    await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}});
    if(payment.status==="approved"&&payment.id)await fetch(`https://api.mercadopago.com/v1/payments/${payment.id}/refunds`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"X-Idempotency-Key":`${order.id}-refund`}}).catch(console.error);
    return {error:"Este checkout aceita somente cartão de crédito."};
  }
  if(isCard&&["rejected","cancelled"].includes(payment.status)){
    await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED",providerPaymentId:String(payment.id)}});
    return {error:"Cartão não aprovado. Confira os dados ou tente outro cartão."};
  }
  const pix=payment.point_of_interaction?.transaction_data;
  const providerExpiration=payment.date_of_expiration?new Date(payment.date_of_expiration):expiresAt;
  await prisma.ligaCashOrder.updateMany({where:{id:order.id,providerPaymentId:null},data:{providerPaymentId:String(payment.id),qrCode:pix?.qr_code??null,qrCodeBase64:pix?.qr_code_base64??null,expiresAt:providerExpiration}});
  return {ok:true,orderId:order.id,qrCode:pix?.qr_code,qrCodeBase64:pix?.qr_code_base64,expiresAt:providerExpiration.toISOString(),card:isCard};
}

export async function getLigaCashOrderStatus(orderId:string){
  const user=await getSessionUser();if(!user)return{status:"UNAUTHORIZED" as const};
  const player=await prisma.player.findUnique({where:{userId:user.id},select:{id:true}});if(!player)return{status:"NOT_FOUND" as const};
  let order=await prisma.ligaCashOrder.findFirst({where:{id:orderId,playerId:player.id},select:{status:true,productType:true,productLabel:true,ligaCoins:true,bonusLigaCoins:true,passOfferSlot:true,fulfilledAt:true,provider:true,providerPaymentId:true,amountCents:true}});
  if(!order)return{status:"NOT_FOUND" as const};
  if(order.status==="PENDING"&&order.provider==="MERCADO_PAGO_CARD"&&order.providerPaymentId&&process.env.MERCADO_PAGO_ACCESS_TOKEN){
    try {
      const response=await fetch(`https://api.mercadopago.com/v1/payments/${order.providerPaymentId}`,{headers:{Authorization:`Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`},cache:"no-store"});
      if(response.ok){
        const payment=await response.json();
        if(String(payment.id)===order.providerPaymentId&&payment.external_reference===orderId&&payment.payment_type_id==="credit_card"&&Math.round(Number(payment.transaction_amount)*100)===order.amountCents){
          if(payment.status==="approved")await fulfillLigaCashOrder(orderId,order.providerPaymentId);
          else if(["rejected","cancelled"].includes(payment.status))await prisma.ligaCashOrder.updateMany({where:{id:orderId,status:"PENDING"},data:{status:"CANCELLED"}});
          order=await prisma.ligaCashOrder.findUniqueOrThrow({where:{id:orderId},select:{status:true,productType:true,productLabel:true,ligaCoins:true,bonusLigaCoins:true,passOfferSlot:true,fulfilledAt:true,provider:true,providerPaymentId:true,amountCents:true}});
        }
      }
    } catch(error) { console.error("[LigaCash] falha ao verificar cartão",error); }
  }
  return{status:order.status,productType:order.productType,productLabel:order.productLabel,creditedLigaCoins:order.status==="PAID"&&order.productType==="LIGA_COINS"?order.ligaCoins+order.bonusLigaCoins:0,passActivated:order.productType==="SUPPORTER_PASS"&&order.passOfferSlot==="CURRENT"&&Boolean(order.fulfilledAt)};
}

export async function cancelLigaCashOrder(orderId:string){
  const user=await getSessionUser();if(!user)return{error:"Faça login novamente."};
  const player=await prisma.player.findUnique({where:{userId:user.id},select:{id:true}});if(!player)return{error:"Jogador não encontrado."};
  const order=await prisma.ligaCashOrder.findFirst({where:{id:orderId,playerId:player.id,status:"PENDING"}});
  if(!order)return{error:"Este pedido não está mais em aberto."};
  // Cancelar no Mercado Pago é best-effort: se a cobrança já expirou/não pode ser
  // cancelada lá, ainda assim fechamos o pedido localmente para que ele saia da
  // lista de "aguardando". (Se o jogador pagar mesmo assim, o webhook credita.)
  const token=process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if(order.providerPaymentId&&token){
    try{
      await fetch(`https://api.mercadopago.com/v1/payments/${order.providerPaymentId}`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({status:"cancelled"})});
    }catch(e){console.error("[LigaCash] cancelamento no Mercado Pago falhou (fechando localmente)",e);}
  }
  const expired=Boolean(order.expiresAt&&order.expiresAt<=new Date());
  await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:expired?"EXPIRED":"CANCELLED"}});
  revalidatePath("/mercado/ligacoins");
  return{ok:true};
}
