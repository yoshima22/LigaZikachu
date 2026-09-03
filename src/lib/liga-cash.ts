import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {changeLigaCash} from "@/lib/liga-cash-wallet";

export const CASH_PRODUCTS = [
  { code:"LC_850", type:"LIGA_COINS", label:"Bolsa Inicial", base:850, bonus:0, cents:999 },
  { code:"LC_1900", type:"LIGA_COINS", label:"Reserva de Treinador", base:1700, bonus:200, cents:1999 },
  { code:"LC_3900", type:"LIGA_COINS", label:"Cofre de Ginásio", base:3450, bonus:450, cents:3499 },
  { code:"LC_8900", type:"LIGA_COINS", label:"Tesouro da Liga", base:7700, bonus:1200, cents:6999 },
  { code:"DEBUG_LC_100", type:"LIGA_COINS", label:"Teste administrativo", base:100, bonus:0, cents:100, adminOnly:true },
] as const;

export async function fulfillLigaCashOrder(orderId:string, providerPaymentId:string) {
  return prisma.$transaction(async tx => {
    const order = await tx.ligaCashOrder.findUnique({ where:{ id:orderId } });
    if (!order || order.providerPaymentId !== providerPaymentId) throw new Error("Pedido incompatível.");
    if (order.fulfilledAt) return order;
    if (order.productType === "LIGA_COINS") {
      const amount = order.ligaCoins + order.bonusLigaCoins;
      await changeLigaCash(tx,{playerId:order.playerId,amount,reason:"PIX_PURCHASE",referenceType:"LigaCashOrder",referenceId:order.id,purchasedDelta:amount,metadata:{productCode:order.productCode,base:order.ligaCoins,bonus:order.bonusLigaCoins}});
    }
    let fulfilledAt=order.productType === "LIGA_COINS" ? new Date() : null;
    if(order.productType==="SUPPORTER_PASS"&&order.passOfferSlot==="CURRENT"&&order.passScheduleKey){
      const config=await tx.passScheduleConfig.findUnique({where:{id:order.passScheduleKey}});
      if(config&&Array.isArray(config.schedule)){
        const days=Math.max(1,config.schedule.length);const now=new Date();const label=config.id==="singleton"?"Passe Apoiador":config.id;
        const title=await tx.shopItem.findFirst({where:{name:"Pilar da Comunidade",type:"TITLE"},select:{id:true}});
        if(title)await tx.playerInventory.upsert({where:{playerId_itemId:{playerId:order.playerId,itemId:title.id}},create:{playerId:order.playerId,itemId:title.id,quantity:1,source:"VIP_PASS"},update:{}});
        await tx.supporterPass.create({data:{playerId:order.playerId,passLabel:label,startsAt:now,expiresAt:new Date(now.getTime()+days*86400000),allowRetroactiveClaims:config.allowRetroactiveClaims,titleItemId:title?.id}});
        fulfilledAt=now;
      }
    }
    return tx.ligaCashOrder.update({ where:{id:order.id}, data:{status:"PAID",paidAt:new Date(),fulfilledAt} });
  });
}

// kind distingue estorno normal (REFUND) de chargeback (CHARGEBACK) no ledger.
// Em ambos o débito recai sobre o ORIGINADOR da compra (allowDebt = pode ficar
// negativo, virando dívida), nunca sobre terceiros que receberam LC no Bazar.
export async function refundLigaCashOrder(orderId:string, providerPaymentId:string, kind:"REFUND"|"CHARGEBACK"="REFUND") {
  return prisma.$transaction(async tx => {
    const order=await tx.ligaCashOrder.findUnique({where:{id:orderId}});
    if(!order||order.providerPaymentId!==providerPaymentId)throw new Error("Pedido incompatível.");
    if(order.status==="REFUNDED")return order;
    if(order.status==="PAID"&&order.productType==="LIGA_COINS"&&order.fulfilledAt){
      const amount=order.ligaCoins+order.bonusLigaCoins;
      await changeLigaCash(tx,{playerId:order.playerId,amount:-amount,reason:kind,referenceType:"LigaCashOrder",referenceId:order.id,purchasedDelta:-amount,allowDebt:true});
    }
    return tx.ligaCashOrder.update({where:{id:order.id},data:{status:"REFUNDED"}});
  });
}

export function validMpSignature(signature:string|null, requestId:string|null, dataId:string) {
  const secret=process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if(!secret||!signature||!requestId) return false;
  const parts=Object.fromEntries(signature.split(",").map(x=>x.split("=").map(v=>v.trim())));
  if(!parts.ts||!parts.v1) return false;
  const expected=createHmac("sha256",secret).update(`id:${dataId};request-id:${requestId};ts:${parts.ts};`).digest("hex");
  return expected.length===parts.v1.length && timingSafeEqual(Buffer.from(expected),Buffer.from(parts.v1));
}
