import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const CASH_PRODUCTS = [
  { code:"LC_850", type:"LIGA_COINS", label:"Bolsa Inicial", base:850, bonus:0, cents:990 },
  { code:"LC_1700", type:"LIGA_COINS", label:"Reserva de Treinador", base:1500, bonus:200, cents:1990 },
  { code:"LC_3450", type:"LIGA_COINS", label:"Cofre de Ginásio", base:3000, bonus:450, cents:3490 },
  { code:"LC_7700", type:"LIGA_COINS", label:"Tesouro da Liga", base:6500, bonus:1200, cents:6990 },
  { code:"NEXT_PASS", type:"SUPPORTER_PASS", label:"Próximo Passe de Apoiador", base:0, bonus:0, cents:2490 },
] as const;

export async function fulfillLigaCashOrder(orderId:string, providerPaymentId:string) {
  return prisma.$transaction(async tx => {
    const order = await tx.ligaCashOrder.findUnique({ where:{ id:orderId } });
    if (!order || order.providerPaymentId !== providerPaymentId) throw new Error("Pedido incompatível.");
    if (order.fulfilledAt) return order;
    if (order.productType === "LIGA_COINS") {
      const amount = order.ligaCoins + order.bonusLigaCoins;
      await tx.ligaCoinWallet.upsert({ where:{ playerId:order.playerId }, create:{ playerId:order.playerId,balance:amount,purchased:amount }, update:{ balance:{increment:amount},purchased:{increment:amount} } });
    }
    return tx.ligaCashOrder.update({ where:{id:order.id}, data:{status:"PAID",paidAt:new Date(),fulfilledAt: order.productType === "LIGA_COINS" ? new Date() : null} });
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
