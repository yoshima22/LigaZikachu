"use server";
import { getSessionUser } from "@/lib/auth/permissions";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CASH_PRODUCTS } from "@/lib/liga-cash";

export async function createLigaCashPayment(code:string,cpf:string,payerEmail:string){
  const user=await getSessionUser(); if(!user) return {error:"Faça login novamente."};
  const player=await prisma.player.findUnique({where:{userId:user.id},select:{id:true}}); if(!player) return {error:"Jogador não encontrado."};
  const product=CASH_PRODUCTS.find(p=>p.code===code); if(!product) return {error:"Pacote inválido."};
  const document=cpf.replace(/\D/g,"");if(document.length!==11)return{error:"Informe um CPF válido para gerar o PIX."};
  const email=payerEmail.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return{error:"Informe o e-mail do pagador."};
  if("adminOnly" in product&&product.adminOnly&&!isAdmin(user.role)) return {error:"Pacote disponível somente para testes administrativos."};
  const token=process.env.MERCADO_PAGO_ACCESS_TOKEN; const base=process.env.NEXT_PUBLIC_APP_URL;
  if(!token||!base) return {error:"Os pagamentos ainda não foram habilitados pelo administrador."};
  const now=new Date();
  await prisma.ligaCashOrder.updateMany({where:{playerId:player.id,status:"PENDING",expiresAt:{lte:now}},data:{status:"EXPIRED"}});
  const pendingCount=await prisma.ligaCashOrder.count({where:{playerId:player.id,status:"PENDING",expiresAt:{gt:now}}});
  if(pendingCount>=3)return {error:"Você já possui 3 pedidos em aberto. Pague, cancele ou aguarde a expiração."};
  const expiresAt=new Date(Date.now()+30*60_000);
  const order=await prisma.ligaCashOrder.create({data:{playerId:player.id,productType:product.type,productCode:product.code,productLabel:product.label,ligaCoins:product.base,bonusLigaCoins:product.bonus,amountCents:product.cents,expiresAt}});
  const response=await fetch("https://api.mercadopago.com/v1/payments",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","X-Idempotency-Key":order.id},body:JSON.stringify({transaction_amount:product.cents/100,description:`Liga Zikachu - ${product.label}`,payment_method_id:"pix",date_of_expiration:expiresAt.toISOString(),payer:{email,identification:{type:"CPF",number:document}},external_reference:order.id,notification_url:`${base}/api/payments/mercado-pago`})});
  const payment=await response.json();
  if(!response.ok){const causes=Array.isArray(payment?.cause)?payment.cause.map((item:unknown)=>{if(typeof item!=="object"||item===null)return"unknown";const cause=item as{code?:unknown;description?:unknown};return`${String(cause.code??"unknown")}${cause.description?`: ${String(cause.description)}`:""}`}):[];const providerMessage=typeof payment?.message==="string"?payment.message:typeof payment?.error==="string"?payment.error:null;await prisma.$transaction([prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}}),prisma.auditLog.create({data:{actorUserId:user.id,entityType:"LigaCashOrder",entityId:order.id,action:"ligacoins.payment_rejected",metadata:{httpStatus:response.status,providerMessage,causes}}})]);console.error("[LigaCoins] Mercado Pago recusou a criação",{orderId:order.id,httpStatus:response.status,providerMessage,causes});const detail=[providerMessage,...causes].filter(Boolean).join(" · ");return {error:detail?`Mercado Pago (${response.status}): ${detail}`:`O Mercado Pago recusou a cobrança (HTTP ${response.status}).`};}
  const pix=payment.point_of_interaction?.transaction_data;
  const providerExpiration=payment.date_of_expiration?new Date(payment.date_of_expiration):expiresAt;
  await prisma.ligaCashOrder.update({where:{id:order.id},data:{providerPaymentId:String(payment.id),qrCode:pix?.qr_code??null,qrCodeBase64:pix?.qr_code_base64??null,expiresAt:providerExpiration}});
  return {ok:true,orderId:order.id,qrCode:pix?.qr_code,qrCodeBase64:pix?.qr_code_base64,expiresAt:providerExpiration.toISOString()};
}

export async function getLigaCashOrderStatus(orderId:string){
  const user=await getSessionUser();if(!user)return{status:"UNAUTHORIZED" as const};
  const player=await prisma.player.findUnique({where:{userId:user.id},select:{id:true}});if(!player)return{status:"NOT_FOUND" as const};
  const order=await prisma.ligaCashOrder.findFirst({where:{id:orderId,playerId:player.id},select:{status:true,productType:true,productLabel:true,ligaCoins:true,bonusLigaCoins:true}});
  if(!order)return{status:"NOT_FOUND" as const};
  return{status:order.status,productType:order.productType,productLabel:order.productLabel,creditedLigaCoins:order.status==="PAID"&&order.productType==="LIGA_COINS"?order.ligaCoins+order.bonusLigaCoins:0};
}

export async function cancelLigaCashOrder(orderId:string){const user=await getSessionUser();if(!user)return{error:"Faça login novamente."};const player=await prisma.player.findUnique({where:{userId:user.id},select:{id:true}});if(!player)return{error:"Jogador não encontrado."};const order=await prisma.ligaCashOrder.findFirst({where:{id:orderId,playerId:player.id,status:"PENDING"}});if(!order)return{error:"Este pedido não está mais em aberto."};if(order.expiresAt&&order.expiresAt<=new Date()){await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"EXPIRED"}});return{ok:true}}const token=process.env.MERCADO_PAGO_ACCESS_TOKEN;if(order.providerPaymentId&&token){const response=await fetch(`https://api.mercadopago.com/v1/payments/${order.providerPaymentId}`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({status:"cancelled"})});if(!response.ok)return{error:"O Mercado Pago não permitiu cancelar esta cobrança agora."}}await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}});return{ok:true}}
