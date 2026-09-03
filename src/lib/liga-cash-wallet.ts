import type {Prisma} from "@prisma/client";

type Tx=Prisma.TransactionClient;

export async function changeLigaCash(tx:Tx,input:{playerId:string;amount:number;reason:string;referenceType?:string;referenceId?:string;actorUserId?:string;metadata?:Prisma.InputJsonValue;purchasedDelta?:number;spentDelta?:number;allowDebt?:boolean}){
  if(!Number.isInteger(input.amount)||input.amount===0)throw new Error("Movimentação de LigaCash inválida.");
  const wallet=await tx.ligaCoinWallet.upsert({where:{playerId:input.playerId},create:{playerId:input.playerId},update:{}});
  const balanceAfter=wallet.balance+input.amount;if(balanceAfter<0&&!input.allowDebt)throw new Error("Saldo insuficiente de LigaCash.");
  await tx.ligaCoinWallet.update({where:{playerId:input.playerId},data:{balance:{increment:input.amount},purchased:{increment:input.purchasedDelta??0},spent:{increment:input.spentDelta??0}}});
  await tx.ligaCashLedger.create({data:{playerId:input.playerId,amount:input.amount,balanceAfter,reason:input.reason,referenceType:input.referenceType,referenceId:input.referenceId,actorUserId:input.actorUserId,metadata:input.metadata}});
  return balanceAfter;
}

export function suggestedLigaCashPrice(zcPrice:number,multiplier=1.1,zcPerLc=10){
  const raw=zcPrice/(zcPerLc*multiplier);if(raw<100)return Math.max(1,Math.round(raw));if(raw<500)return Math.max(5,Math.round(raw/5)*5);return Math.max(10,Math.round(raw/10)*10);
}
