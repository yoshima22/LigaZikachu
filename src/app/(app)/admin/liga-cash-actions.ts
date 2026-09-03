"use server";
import {requireAdmin} from "@/lib/auth/permissions";
import {prisma} from "@/lib/prisma";
import {adminGrantVip} from "@/app/(app)/passe-apoiador/actions";
import {revalidatePath} from "next/cache";
export async function activatePaidPass(orderId:string){await requireAdmin();const order=await prisma.ligaCashOrder.findUnique({where:{id:orderId}});if(!order||order.status!=="PAID"||order.productType!=="SUPPORTER_PASS"||order.fulfilledAt)return {error:"Pedido não está disponível."};const granted=await adminGrantVip({playerId:order.playerId,days:30,startDay:1,passLabel:"Passe Apoiador"});if(!granted.ok)return {error:granted.error};await prisma.ligaCashOrder.update({where:{id:order.id},data:{fulfilledAt:new Date()}});revalidatePath("/admin");return {ok:true};}
