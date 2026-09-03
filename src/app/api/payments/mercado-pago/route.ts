import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillLigaCashOrder,refundLigaCashOrder,validMpSignature } from "@/lib/liga-cash";
export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({})); const id=String(req.nextUrl.searchParams.get("data.id")??body?.data?.id??"");
  if(!id||!validMpSignature(req.headers.get("x-signature"),req.headers.get("x-request-id"),id)) return NextResponse.json({error:"invalid signature"},{status:401});
  const token=process.env.MERCADO_PAGO_ACCESS_TOKEN; if(!token) return NextResponse.json({error:"not configured"},{status:503});
  const response=await fetch(`https://api.mercadopago.com/v1/payments/${id}`,{headers:{Authorization:`Bearer ${token}`}}); if(!response.ok)return NextResponse.json({ok:true});
  const payment=await response.json(); const orderId=String(payment.external_reference??"");
  const order=await prisma.ligaCashOrder.findUnique({where:{id:orderId}}); if(!order||String(payment.id)!==order.providerPaymentId||Math.round(Number(payment.transaction_amount)*100)!==order.amountCents)return NextResponse.json({ok:true});
  if(payment.status==="approved")await fulfillLigaCashOrder(order.id,String(payment.id));
  else if(["refunded","charged_back"].includes(payment.status))await refundLigaCashOrder(order.id,String(payment.id));
  else if(["cancelled","rejected"].includes(payment.status)&&order.status==="PENDING")await prisma.ligaCashOrder.update({where:{id:order.id},data:{status:"CANCELLED"}});
  return NextResponse.json({ok:true});
}
