import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient, ZikaBetStatus, ZikaCoinTxType } from "@prisma/client";
import { creditCoins } from "../src/lib/zikacoins";
const prisma = new PrismaClient();
const WEEK_ID = "cmsdn48nw001do6v4r7zzdqwu";
const APPLY = process.argv.includes("--apply");

(async () => {
  const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN","SUPER_ADMIN"] } }, select: { id: true, email: true } });
  if (!admin) throw new Error("Sem admin");
  const bets = await prisma.zikaBet.findMany({
    where: { match: { tournamentWeekId: WEEK_ID }, status: { in: [ZikaBetStatus.OPEN, ZikaBetStatus.CLOSED] } },
    include: { match: true, player: { select: { displayName: true } } },
  });
  let won=0, lost=0, refunded=0, payout=0;
  const rows:any[]=[];
  for (const bet of bets) {
    const m = bet.match;
    let outcome:string;
    if (m.status === "CANCELED" || !m.winnerPlayerId) { outcome="REFUND"; refunded++; }
    else if (bet.betOnPlayerId === m.winnerPlayerId) { outcome="WON"; won++; payout += bet.potentialReturn; }
    else { outcome="LOST"; lost++; }
    rows.push({ jogador: bet.player.displayName, aposta: bet.amount, retorno: bet.potentialReturn, resultado: outcome });

    if (APPLY) {
      if (outcome==="REFUND") {
        await prisma.$transaction(async (tx)=>{ await tx.zikaBet.update({where:{id:bet.id},data:{status:ZikaBetStatus.REFUNDED,settledAt:new Date()}}); await creditCoins(tx,{playerId:bet.playerId,type:ZikaCoinTxType.BET_REFUNDED,amount:bet.amount,description:"Reembolso — partida sem resultado",matchId:bet.matchId,adminId:admin.id}); });
      } else if (outcome==="WON") {
        await prisma.$transaction(async (tx)=>{ await tx.zikaBet.update({where:{id:bet.id},data:{status:ZikaBetStatus.WON,settledAt:new Date()}}); await creditCoins(tx,{playerId:bet.playerId,type:ZikaCoinTxType.BET_WON,amount:bet.potentialReturn,description:`Aposta vencida (${Number(bet.odds)}x)`,matchId:bet.matchId,adminId:admin.id}); });
      } else {
        await prisma.zikaBet.update({where:{id:bet.id},data:{status:ZikaBetStatus.LOST,settledAt:new Date()}});
      }
    }
  }
  console.table(rows);
  console.log(`\nTotal apostas: ${bets.length} | WON: ${won} | LOST: ${lost} | REFUND: ${refunded} | Payout total (WON): ${payout} ZC`);
  console.log(APPLY ? "\n>>> APLICADO." : "\n>>> SIMULAÇÃO (use --apply para liquidar).");
})().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
