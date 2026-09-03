"use server";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CASH_PRODUCTS } from "@/lib/liga-cash";

export async function createLigaCashPayment(code:string){
  const user=await getSessionUser(); if(!user) return {error:"Faça login novamente."};
  const player=await prisma.player.findUnique({where:{userId:user.id},select:{id:true}}); if(!player) return {error:"Jogador não encontrado."};
  const product=CASH_PRODUCTS.find(p=>p.code===code); if(!product) return {error:"Pacote inválido."};
  const token=process.env.MERCADO_PAGO_ACCESS_TOKEN; const base=process.env.NEXT_PUBLIC_APP_URL;
  if(!token||!base) return {error:"Os pagamentos ainda não foram habilitados pelo administrador."};
  const order=await prisma.ligaCashOrder.create({data:{playerId:player.id,productType:product.type,productCode:product.code,productLabel:product.label,ligaCoins:product.base,bonusLigaCoins:product.bonus,amountCents:product.cents}});
  const response=await fetch("https://api.mercadopago.com/v1/payments",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","X-Idempotency-Key":order.id},body:JSON.stringify({transaction_amount:product.cents/100,description:`Liga Zikachu - ${product.label}`,payment_method_id:"pix",payer:{email:user.email},external_reference:order.id,notification_url:`${base}/api/payments/mercado-pago`})});
  const payment=await response.json();
  if(!response.ok){await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}});return {error:"Não foi possível gerar o PIX agora."};}
  const pix=payment.point_of_interaction?.transaction_data;
  await prisma.ligaCashOrder.update({where:{id:order.id},data:{providerPaymentId:String(payment.id),qrCode:pix?.qr_code??null,qrCodeBase64:pix?.qr_code_base64??null,expiresAt:payment.date_of_expiration?new Date(payment.date_of_expiration):null}});
  return {ok:true,orderId:order.id,qrCode:pix?.qr_code,qrCodeBase64:pix?.qr_code_base64};
}
