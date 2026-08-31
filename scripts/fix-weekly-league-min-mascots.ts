/** Remove participantes da liga semanal ativa com <18 mascotes e regenera os
 * confrontos do dia (replica generateDailyMatchupsAction). Só roda se não houver
 * partidas RESOLVED/WO no dia. Idempotente-ish. */
import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client";
import { swissPairSlot, type PairingPlayer } from "../src/lib/league-pairing";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const MIN = 18;
const createId = () => crypto.randomUUID();
const getTodayBrt = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function odds(pA:{points:number;wins:number;damageDealt:number},pB:{points:number;wins:number;damageDealt:number}){const sA=pA.points*10+pA.wins*5+pA.damageDealt/100,sB=pB.points*10+pB.wins*5+pB.damageDealt/100,t=sA+sB;if(t===0)return{oddsA:1.9,oddsB:1.9};const r5=(v:number)=>Math.round(Math.round(v/0.05)*5)/100;const pa=sA/t,pb=sB/t,mg=0.92;return{oddsA:Math.max(1.1,r5(pa>0.02?mg/pa:8)),oddsB:Math.max(1.1,r5(pb>0.02?mg/pb:8))};}
(async()=>{
  const league = await prisma.weeklyMascotLeague.findFirst({ where:{ status:"ACTIVE" }, orderBy:{ createdAt:"desc" } });
  if(!league){ console.log("Sem liga ativa."); return; }
  const today = getTodayBrt();
  const resolved = await prisma.weeklyMascotLeagueMatch.count({ where:{ leagueId:league.id, battleDate:today, status:{ in:["RESOLVED","WO"] } } });
  if(resolved>0){ console.log("A chave de hoje já tem resultados/W.O. — abortando para não alterar a competição."); return; }
  const parts = await prisma.weeklyMascotLeagueParticipant.findMany({ where:{ leagueId:league.id } });
  const counts = new Map<string,number>();
  for(const p of parts) counts.set(p.playerId, await prisma.mascot.count({ where:{ playerId:p.playerId } }));
  const underIds = parts.filter(p => (counts.get(p.playerId)??0) < MIN).map(p=>p.playerId);
  console.log(`Liga ${league.weekKey} · ${parts.length} participantes · remover ${underIds.length} (<${MIN} mascotes):`, underIds);
  if(!APPLY){ console.log(">>> SIMULAÇÃO (use --apply)."); return; }

  await prisma.$transaction(async (tx)=>{
    // 1) Reverter pontos de TODOS os BYEs de hoje (serão deletados na regeneração)
    const byes = await tx.weeklyMascotLeagueMatch.findMany({ where:{ leagueId:league.id, battleDate:today, status:"BYE" } });
    for(const b of byes) if(b.playerAId) await tx.weeklyMascotLeagueParticipant.updateMany({ where:{ leagueId:league.id, playerId:b.playerAId }, data:{ points:{ decrement:3 }, byes:{ decrement:1 }, updatedAt:new Date() } });
    // 2) Deletar todas as partidas não resolvidas de hoje
    await tx.weeklyMascotLeagueMatch.deleteMany({ where:{ leagueId:league.id, battleDate:today, status:{ in:["SCHEDULED","BYE","CANCELLED"] } } });
    // 3) Remover os participantes sub-18 e seus dados
    if(underIds.length){
      await tx.weeklyMascotLeagueMatch.deleteMany({ where:{ leagueId:league.id, OR:[{playerAId:{in:underIds}},{playerBId:{in:underIds}}] } });
      await tx.weeklyMascotLeagueDailyTeam.deleteMany({ where:{ leagueId:league.id, playerId:{in:underIds} } });
      await tx.weeklyMascotLeagueBattleItem.deleteMany({ where:{ leagueId:league.id, playerId:{in:underIds} } });
      await tx.weeklyMascotLeagueMascotStats.deleteMany({ where:{ leagueId:league.id, ownerId:{in:underIds} } });
      await tx.weeklyMascotLeagueParticipant.deleteMany({ where:{ leagueId:league.id, playerId:{in:underIds} } });
    }
    // 4) Regenerar 3 slots de hoje
    const stored = await tx.weeklyMascotLeagueParticipant.findMany({ where:{ leagueId:league.id }, orderBy:[{points:"desc"},{wins:"desc"},{damageDealt:"desc"}] });
    const players: PairingPlayer[] = stored.map(p=>({ playerId:p.playerId, points:p.points, wins:p.wins, damageDealt:p.damageDealt, byes:p.byes, woLosses:p.woLosses, freeWins:0 }));
    const roundBase = await tx.weeklyMascotLeagueMatch.count({ where:{ leagueId:league.id } });
    const faced = new Map<string,Map<string,number>>();
    const todayPaired = new Map<string,Set<string>>(); const byeCount = new Map<string,number>();
    let created=0, byeN=0;
    for(const slot of [1,2,3]){
      const pairings = swissPairSlot(players, faced, todayPaired, byeCount, `${league.id}:${today}:${slot}`);
      for(const pair of pairings){
        if(pair.bId){ const pA=stored.find(p=>p.playerId===pair.aId)!, pB=stored.find(p=>p.playerId===pair.bId)!; const o=odds(pA,pB);
          await tx.weeklyMascotLeagueMatch.create({ data:{ id:createId(), leagueId:league.id, roundNumber:roundBase+slot, battleDate:today, battleSlot:slot, scheduledAt:new Date(), playerAId:pair.aId, playerBId:pair.bId, status:"SCHEDULED", resultJson:o } }); created++; }
        else { await tx.weeklyMascotLeagueMatch.create({ data:{ id:createId(), leagueId:league.id, roundNumber:roundBase+slot, battleDate:today, battleSlot:slot, scheduledAt:new Date(), playerAId:pair.aId, status:"BYE", resolvedAt:new Date() } });
          await tx.weeklyMascotLeagueParticipant.updateMany({ where:{ leagueId:league.id, playerId:pair.aId }, data:{ points:{ increment:3 }, byes:{ increment:1 }, updatedAt:new Date() } }); byeN++; }
      }
    }
    console.log(`Regenerado: ${created} confronto(s) + ${byeN} BYE(s) em 3 slots, com ${players.length} jogadores.`);
  }, { timeout: 60000, maxWait: 30000 });
  console.log(">>> APLICADO.");
})().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
