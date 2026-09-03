"use server";
import {revalidatePath,revalidateTag} from "next/cache";
import {prisma} from "@/lib/prisma";
import {requirePlatformAdmin} from "@/lib/auth/permissions";

export async function saveEconomySettings(input:{zcPerLcReference:number;shopLcValueMultiplier:number;bazarListingFeeZc:number;bazarListingFeeLc:number;allowLcShop:boolean;allowLcBazar:boolean;allowMixedProposals:boolean;allowLcAuctions:boolean}){const actor=await requirePlatformAdmin();if(input.zcPerLcReference<1||input.shopLcValueMultiplier<=0||input.bazarListingFeeZc<0||input.bazarListingFeeLc<0)return{error:"Valores econômicos inválidos."};await prisma.economySettings.upsert({where:{id:"singleton"},create:{id:"singleton",...input,updatedBy:actor.id},update:{...input,updatedBy:actor.id}});revalidatePath("/shop");revalidatePath("/bazar");revalidatePath("/shop/admin");return{ok:true}}
export async function saveItemLigaCashPrice(itemId:string,value:number|null){await requirePlatformAdmin();if(value!==null&&(!Number.isInteger(value)||value<1))return{error:"Preço inválido."};await prisma.shopItem.update({where:{id:itemId},data:{ligaCashPrice:value}});revalidateTag("shop-items-active");revalidatePath("/shop");return{ok:true}}
