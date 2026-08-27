import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client"; const prisma=new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SLUG = "liga-zikachu-3-edicao-rumo-a-johto";
const brtDay = (d:Date)=> new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const brt = (d:Date|null)=> d? d.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}) : "—";
(async()=>{
  const t = await prisma.tournament.findUnique({ where:{ slug: SLUG }, select:{ id:true, name:true } });
  if(!t){ console.error("Torneio não encontrado"); process.exit(1); }
  console.log("Torneio:", t.name);
  const weeks = await prisma.tournamentWeek.findMany({ where:{ tournamentId:t.id }, orderBy:{ weekNumber:"asc" }, select:{ id:true, weekNumber:true, deckLockAt:true } });
  const rows:any[]=[]; let changed=0;
  for (const w of weeks){
    if(!w.deckLockAt){ rows.push({ semana:w.weekNumber, de:"—", para:"(sem deckLockAt — pulado)" }); continue; }
    const day = brtDay(w.deckLockAt);
    const target = new Date(`${day}T19:30:00-03:00`);
    const isSame = target.getTime() === w.deckLockAt.getTime();
    rows.push({ semana:w.weekNumber, de: brt(w.deckLockAt), para: brt(target) + (isSame?" (igual)":"") });
    if(!isSame){ changed++; if(APPLY) await prisma.tournamentWeek.update({ where:{ id:w.id }, data:{ deckLockAt: target } }); }
  }
  console.table(rows);
  console.log(`\nSemanas a alterar: ${changed}`);
  console.log(APPLY? ">>> APLICADO.":">>> SIMULAÇÃO (use --apply).");
})().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
