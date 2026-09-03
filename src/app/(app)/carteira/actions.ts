"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin,isAdmin } from "@/lib/auth/permissions";
import { ZikaCoinTxType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import {changeLigaCash} from "@/lib/liga-cash-wallet";

export async function adjustCoins(
  playerId: string,
  amount: number,
  description: string
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    if (!playerId || amount === 0) return { error: "Parâmetros inválidos." };

    await prisma.$transaction(async (tx) => {
      await getOrCreateWallet(playerId);
      await creditCoins(tx, {
        playerId,
        type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
        amount,
        description: description || "Ajuste manual pelo admin",
        adminId: actor.id
      });
    });

    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { userId: true } }).catch(() => null);
    revalidatePath("/carteira");
    if (player?.userId) revalidateTag(`nav-${player.userId}`);
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function adjustLigaCoins(playerId:string,amount:number,description:string):Promise<{error?:string}>{try{const actor=await requireAdmin();if(!playerId||!Number.isInteger(amount)||amount===0)return{error:"Parâmetros inválidos."};if(amount<0&&!isAdmin(actor.role))return{error:"Somente administradores podem remover LigaCash."};if(!description.trim())return{error:"Informe o motivo obrigatório do ajuste."};await prisma.$transaction(async tx=>{const before=await tx.ligaCoinWallet.findUnique({where:{playerId}});const balanceAfter=await changeLigaCash(tx,{playerId,amount,reason:amount>0?"ADMIN_GRANT":"ADMIN_REMOVE",referenceType:"AdminAdjustment",actorUserId:actor.id,metadata:{description:description.trim()},spentDelta:amount<0?-amount:0});await tx.auditLog.create({data:{actorUserId:actor.id,entityType:"LigaCashWallet",entityId:playerId,action:"ligacash.admin_adjusted",before:{balance:before?.balance??0},after:{balance:balanceAfter,amount,description:description.trim()}}})});const player=await prisma.player.findUnique({where:{id:playerId},select:{userId:true}});revalidatePath("/carteira");if(player?.userId)revalidateTag(`nav-${player.userId}`);return{}}catch(err){return{error:err instanceof Error?err.message:"Erro desconhecido"}}}

/**
 * Envia ZC para todos os jogadores de uma vez (bônus em massa).
 * Só permite valores positivos — não é para descontos em massa.
 * Opcionalmente exclui contas de admin do envio.
 */
export async function adjustCoinsForAll(
  amount: number,
  description: string,
  includeAdmins = false
): Promise<{ error?: string; credited?: number }> {
  try {
    const actor = await requireAdmin();
    if (!Number.isInteger(amount) || amount <= 0) {
      return { error: "Informe um valor positivo de ZC." };
    }

    const players = await prisma.player.findMany({
      where: includeAdmins ? {} : { user: { role: "PLAYER" } },
      select: { id: true, userId: true },
    });
    if (players.length === 0) return { error: "Nenhum jogador encontrado." };

    // Processa em lotes para não estourar o tempo de uma única transação
    const BATCH_SIZE = 25;
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const p of batch) {
          await creditCoins(tx, {
            playerId: p.id,
            type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
            amount,
            description: description || "Bônus da Liga (envio em massa)",
            adminId: actor.id,
          });
        }
      });
    }

    revalidatePath("/carteira");
    revalidatePath("/admin");
    for (const p of players) {
      if (p.userId) revalidateTag(`nav-${p.userId}`);
    }
    return { credited: players.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
