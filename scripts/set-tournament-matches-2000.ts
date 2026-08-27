import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client"; const prisma=new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SLUG = "liga-zikachu-3-edicao-rumo-a-johto";
const brtDay = (d:Date)=> new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d); // YYYY-MM-DD
const brt = (d:Date)=> d.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"});
(async()=>{
  const t = await prisma.tournament.findUnique({ where:{ slug: SLUG }, select:{ id:true, name:true } });
  if(!t){ console.error("Torneio não encontrado:", SLUG); process.exit(1); }
  console.log("Torneio:", t.name);
  const matches = await prisma.match.findMany({
    where: { tournamentWeek: { tournamentId: t.id }, scheduledAt: { not: null } },
    select: { id:true, roundLabel:true, scheduledAt:true, tournamentWeek:{ select:{ weekNumber:true } } },
    orderBy: [{ scheduledAt: "asc" }],
  });
  let changed=0, same=0;
  const rows:any[]=[];
  for (const m of matches){
    const day = brtDay(m.scheduledAt!);
    const target = new Date(`${day}T20:00:00-03:00`);
    const isSame = target.getTime() === m.scheduledAt!.getTime();
    if (isSame) { same++; continue; }
    changed++;
    rows.push({ semana: m.tournamentWeek?.weekNumber, jogo: m.roundLabel, de: brt(m.scheduledAt!), para: brt(target) });
    if (APPLY) await prisma.match.update({ where:{ id:m.id }, data:{ scheduledAt: target } });
  }
  console.table(rows.slice(0,50));
  console.log(`\nTotal com horário: ${matches.length} | a alterar: ${changed} | já em 20:00: ${same}`);
  console.log(APPLY ? ">>> APLICADO." : ">>> SIMULAÇÃO (use --apply).");
})().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
