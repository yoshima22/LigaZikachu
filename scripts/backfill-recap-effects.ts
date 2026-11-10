/**
 * Backfill de buffsApplied/debuffsApplied (player_recap_counters) pelo TEXTO dos
 * replays. Critérios idênticos a countEffectText() em src/lib/player-recap.ts.
 *
 *   npx tsx scripts/backfill-recap-effects.ts           -> dry-run
 *   npx tsx scripts/backfill-recap-effects.ts --apply   -> grava (set só dessas colunas)
 *
 * Rode ANTES de subir o gancho que soma buffs/debuffs; depois dele o script se
 * recusa a rodar de novo (effectsBackfilledAt). Ligas: só edições FINISHED.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const YEAR = 2026;
const YEAR_START = new Date(Date.UTC(YEAR, 0, 1, 3, 0, 0));
const CUTOFF = new Date();

const EXPR = `
  coalesce(t->>'effect', '') as e, t->>'actorOwnerId' as pid`;
const BUF = `(strpos(e,'Encorajador: +')>0)::int + (strpos(e,'Batedor: +')>0)::int + (strpos(e,'Leal')>0 and strpos(e,'(+5%)')>0)::int`;
const DEB = `(strpos(e,'Oportunista reduziu')>0)::int + (strpos(e,'Travessura de')>0)::int`;
const wrap = (inner: string) => `select pid, sum(${BUF})::int buffs, sum(${DEB})::int debuffs from (${inner}) x where pid is not null group by pid`;

async function main() {
  const totals = new Map<string, { buffs: number; debuffs: number }>();
  const sum = (rows: { pid: string; buffs: number; debuffs: number }[], label: string) => {
    let b = 0, d = 0;
    for (const r of rows) {
      const cur = totals.get(r.pid) ?? { buffs: 0, debuffs: 0 };
      totals.set(r.pid, { buffs: cur.buffs + r.buffs, debuffs: cur.debuffs + r.debuffs });
      b += r.buffs; d += r.debuffs;
    }
    console.log(label, { buffs: b, debuffs: d });
  };

  sum(await prisma.$queryRawUnsafe(wrap(`select ${EXPR} from arena_battles b, jsonb_array_elements(b."turnLog") t
    where b."createdAt" >= $1 and b."createdAt" < $2 and b.type in ('BOT','PVP')`), YEAR_START, CUTOFF), "arena");
  sum(await prisma.$queryRawUnsafe(wrap(`select ${EXPR} from weekly_mascot_league_matches m, jsonb_array_elements(m."replayJson") t
    where jsonb_typeof(m."replayJson") = 'array' and m."leagueId" in (select id from weekly_mascot_leagues where status = 'FINISHED')`)), "weekly");
  sum(await prisma.$queryRawUnsafe(wrap(`select ${EXPR} from rush_league_matches m, jsonb_array_elements(m."replayJson") t
    where jsonb_typeof(m."replayJson") = 'array' and m."leagueId" in (select id from rush_leagues where status = 'FINISHED')`)), "rush");

  console.log("jogadores:", totals.size);
  if (!APPLY) { console.log("dry-run: nada gravado (use --apply)."); return; }
  const done = await prisma.playerRecapCounter.count({ where: { year: YEAR, effectsBackfilledAt: { not: null } } });
  if (done > 0 && !process.argv.includes("--rerun-before-deploy")) { console.log(`ABORTADO: ${done} linhas já têm effectsBackfilledAt.`); return; }
  const now = new Date();
  for (const [playerId, v] of totals) {
    await prisma.playerRecapCounter.upsert({
      where: { playerId_year: { playerId, year: YEAR } },
      create: { playerId, year: YEAR, buffsApplied: v.buffs, debuffsApplied: v.debuffs, effectsBackfilledAt: now },
      update: { buffsApplied: v.buffs, debuffsApplied: v.debuffs, effectsBackfilledAt: now },
    });
  }
  console.log(`gravadas ${totals.size} linhas.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
