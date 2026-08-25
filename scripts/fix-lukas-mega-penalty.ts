/**
 * Correção pontual (Luiz x Lukas, liga semanal 2026-08-25 slot 3):
 * - Remove 50 pontos totais dos 3 megas do Lukas (17/17/16, dos status mais altos).
 * - Re-roda o combate com os stats novos (mesma lógica do regenerateReplaysAction:
 *   modifier + sabotage, sem itens de batalha).
 * - Recalcula a classificação da liga semanal a partir das partidas.
 * Uso: npx tsx scripts/fix-lukas-mega-penalty.ts --apply   (sem --apply = dry-run)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const f of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), f); if (!existsSync(p)) continue;
  for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue;
    let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] ??= v;
  }
}
import { PrismaClient } from "@prisma/client";
import { runLeagueCombat, toLeagueMascot } from "../src/lib/league-combat";
import { defaultCombatRoleFor, getCombatRoleLabel } from "../src/lib/combat-roles";
import { getActiveWeeklyLeagueSabotage } from "../src/lib/raid-event";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const MATCH_ID = "2fc59511-2186-4141-9589-72e2414414fc";
const LEAGUE_ID = "6d6377d3-614c-4da6-b2d9-a0176e5df18c";
const LUKAS = "cmpzhgzqv0001lb042nzmtr8x";
// megas do Lukas nessa partida -> quanto tirar (total 50)
const PENALTY: Record<string, number> = {
  "cmr0nda6u000dlb04ke8n9avx": 17, // MEGA TYMAMATAR
  "cmqf78ejn000djy04czbrubr0": 17, // LUTADOR DE MASCARA
  "cmrsivj6v002fla04e58dzluh": 16, // MEGA ZANGÃO
};
const STAT_KEYS = ["statForce", "statAgility", "statCharisma", "statInstinct", "statVitality"] as const;
type SK = typeof STAT_KEYS[number];

// remove `amount` do mascote decrementando sempre o status mais alto
function reduceFromHighest(stats: Record<SK, number>, amount: number): Record<SK, number> {
  const s = { ...stats };
  for (let i = 0; i < amount; i++) {
    let top: SK = STAT_KEYS[0];
    for (const k of STAT_KEYS) if (s[k] > s[top]) top = k;
    s[top] = Math.max(0, s[top] - 1);
  }
  return s;
}

function resolveRole(m: any, roles?: Record<string, string>) { return roles?.[m.id] ?? defaultCombatRoleFor(m); }

async function loadTeam(playerId: string, battleDate: string, slot: number) {
  let dailyTeam = await prisma.weeklyMascotLeagueDailyTeam.findUnique({
    where: { leagueId_playerId_battleDate_battleSlot: { leagueId: LEAGUE_ID, playerId, battleDate, battleSlot: slot } },
  });
  if (!dailyTeam) dailyTeam = await prisma.weeklyMascotLeagueDailyTeam.findFirst({ where: { leagueId: LEAGUE_ID, playerId, battleSlot: slot }, orderBy: { battleDate: "desc" } });
  if (!dailyTeam) return [];
  const ids = dailyTeam.mascotIdsJson as string[];
  const roles = (dailyTeam.rolesJson as Record<string, string>) ?? {};
  const mascots = await prisma.mascot.findMany({ where: { id: { in: ids }, playerId } });
  const ordered = ids.map((id) => mascots.find((m) => m.id === id)).filter(Boolean) as any[];
  return ordered.map((m, i) => toLeagueMascot(m, i + 1, resolveRole(m, roles)));
}

async function recomputeWeekly() {
  const [participants, matches] = await Promise.all([
    prisma.weeklyMascotLeagueParticipant.findMany({ where: { leagueId: LEAGUE_ID } }),
    prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId: LEAGUE_ID } }),
  ]);
  const agg = new Map(participants.map((p) => [p.playerId, { points: 0, wins: 0, losses: 0, draws: 0, woLosses: 0, byes: 0, survivorsScore: 0, damageDealt: 0, damageTaken: 0 }]));
  const add = (id: string | null | undefined, f: (a: any) => void) => { if (id && agg.has(id)) f(agg.get(id)!); };
  for (const m of matches) {
    if (m.status === "BYE") { add(m.playerAId, (a) => { a.points += 3; a.byes++; }); continue; }
    if (m.status === "WO") { add(m.winnerId, (a) => { a.points += 3; a.byes++; }); add(m.loserId, (a) => { a.woLosses++; }); continue; }
    if (m.status !== "RESOLVED") continue;
    add(m.playerAId, (a) => { a.survivorsScore += m.playerASurvivors; a.damageDealt += m.playerADamageDealt; a.damageTaken += m.playerADamageTaken; });
    add(m.playerBId, (a) => { a.survivorsScore += m.playerBSurvivors; a.damageDealt += m.playerBDamageDealt; a.damageTaken += m.playerBDamageTaken; });
    if (m.isDraw) { add(m.playerAId, (a) => { a.points += 1; a.draws++; }); add(m.playerBId, (a) => { a.points += 1; a.draws++; }); }
    else { add(m.winnerId, (a) => { a.points += 3; a.wins++; }); add(m.loserId, (a) => { a.losses++; }); }
  }
  await prisma.$transaction([...agg.entries()].map(([playerId, a]) =>
    prisma.weeklyMascotLeagueParticipant.update({ where: { leagueId_playerId: { leagueId: LEAGUE_ID, playerId } }, data: a })));
  return agg;
}

async function main() {
  const match = await prisma.weeklyMascotLeagueMatch.findUnique({ where: { id: MATCH_ID } });
  if (!match) throw new Error("partida não encontrada");
  console.log(`Partida ${match.battleDate} slot${match.battleSlot} | vencedor atual: ${match.winnerId}`);

  // itens de batalha desta partida (só informativo — re-roll roda sem itens, como o app)
  const items = await prisma.weeklyMascotLeagueBattleItem.findMany({ where: { leagueId: LEAGUE_ID, battleDate: match.battleDate, battleSlot: match.battleSlot, playerId: { in: [match.playerAId, match.playerBId!] } } });
  console.log(`Itens de batalha registrados nesta partida: ${items.length}`);

  // 1) penalty
  const megas = await prisma.mascot.findMany({ where: { id: { in: Object.keys(PENALTY) } } });
  let totalRemoved = 0;
  for (const m of megas) {
    const before = Object.fromEntries(STAT_KEYS.map((k) => [k, (m as any)[k]])) as Record<SK, number>;
    const after = reduceFromHighest(before, PENALTY[m.id]);
    const removed = STAT_KEYS.reduce((s, k) => s + (before[k] - after[k]), 0);
    totalRemoved += removed;
    console.log(`${m.nickname ?? m.pokemonId}: -${removed}  ${STAT_KEYS.map((k) => `${k.slice(4, 5)}${before[k]}->${after[k]}`).join(" ")}`);
    if (APPLY) await prisma.mascot.update({ where: { id: m.id }, data: after });
  }
  console.log(`Total removido: ${totalRemoved} (esperado 50)`);

  if (!APPLY) { console.log("\n[dry-run] nada gravado. Rode com --apply para efetivar."); return; }

  // 2) re-roll
  const league = await prisma.weeklyMascotLeague.findUnique({ where: { id: LEAGUE_ID } });
  const modifier = (league?.modifierJson ?? null) as any;
  const weeklySabotage = await getActiveWeeklyLeagueSabotage();
  const [teamA, teamB] = await Promise.all([
    loadTeam(match.playerAId, match.battleDate, match.battleSlot),
    loadTeam(match.playerBId!, match.battleDate, match.battleSlot),
  ]);
  if (teamA.length < 6 || teamB.length < 6) throw new Error(`times incompletos A=${teamA.length} B=${teamB.length}`);
  const result = runLeagueCombat(teamA, teamB, modifier, [], [], { weeklySabotage });
  const winnerId = result.winner === "A" ? match.playerAId : result.winner === "B" ? match.playerBId : null;
  const loserId = result.winner === "A" ? match.playerBId : result.winner === "B" ? match.playerAId : null;
  const lineup = (arr: any[]) => arr.map((mc) => ({ id: mc.id, name: mc.name, pokemonId: mc.pokemonId, level: mc.level, ownerId: mc.ownerId, role: getCombatRoleLabel(mc.combatRole), maxHp: mc.hp }));
  await prisma.weeklyMascotLeagueMatch.update({
    where: { id: MATCH_ID },
    data: {
      winnerId, loserId, isDraw: result.winner === "DRAW",
      playerASurvivors: result.teamASurvivors, playerBSurvivors: result.teamBSurvivors,
      playerADamageDealt: result.teamADamageDealt, playerBDamageDealt: result.teamBDamageDealt,
      playerADamageTaken: result.teamADamageTaken, playerBDamageTaken: result.teamBDamageTaken,
      resultJson: { winner: result.winner, rounds: result.rounds, lineupA: lineup(result.lineupA), lineupB: lineup(result.lineupB) } as any,
      replayJson: result.log as any,
      status: "RESOLVED", resolvedAt: new Date(),
    },
  });
  console.log(`\nNovo resultado: winner=${result.winner} (${winnerId}) | dano A=${result.teamADamageDealt} B=${result.teamBDamageDealt} | sobrev A=${result.teamASurvivors} B=${result.teamBSurvivors}`);

  // 3) recompute standings
  const agg = await recomputeWeekly();
  for (const pid of [match.playerAId, match.playerBId!]) {
    const a = agg.get(pid); const name = pid === LUKAS ? "Lukas" : "Luiz";
    console.log(`${name}: ${a?.points}pts ${a?.wins}V ${a?.draws}E ${a?.losses}D`);
  }
  console.log("\n✅ Concluído.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
