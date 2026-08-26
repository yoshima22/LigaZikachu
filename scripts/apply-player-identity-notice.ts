/** Aplica a migração 035 (colunas nameChangeCount + lastAckedNoticeVersion). Idempotente. */
import { existsSync, readFileSync } from "node:fs"; import { resolve } from "node:path";
for (const f of [".env",".env.local"]) { const p=resolve(process.cwd(),f); if(!existsSync(p))continue; for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;} }
import { PrismaClient } from "@prisma/client"; const prisma=new PrismaClient();
(async()=>{
  const stmts=readFileSync("prisma/migrations-manual/035_player_identity_notice.sql","utf8").split(/\r?\n/).map(s=>s.trim()).filter(s=>s.startsWith("ALTER")).map(s=>s.replace(/;$/,""));
  for(const stmt of stmts) await prisma.$executeRawUnsafe(stmt);
  console.log("Migração 035 aplicada:",stmts.length,"statements.");
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
