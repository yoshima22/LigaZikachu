/**
 * Limpa equipes da Liga Semanal que violam a divisão LIMITADO (>2 megas).
 * Zera mascotIdsJson/rolesJson (equipe "limpa" -> auto-fill / precisa remontar),
 * impedindo que times inválidos montados no modo ilimitado sejam herdados.
 * Uso: npx tsx scripts/clear-invalid-weekly-teams.ts [--apply]
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
import { BATTLE_DIVISIONS, isMegaEvolvedMascot } from "../src/lib/battle-divisions";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const MAX = BATTLE_DIVISIONS.LIMITED.maxMegas; // 2

async function main() {
  const leagues = await prisma.weeklyMascotLeague.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  if (!leagues.length) { console.log("Nenhuma liga semanal ATIVA."); return; }
  const nameById = new Map((await prisma.player.findMany({ select: { id: true, displayName: true } })).map((p) => [p.id, p.displayName]));

  let invalid = 0, cleared = 0;
  for (const lg of leagues) {
    const teams = await prisma.weeklyMascotLeagueDailyTeam.findMany({ where: { leagueId: lg.id } });
    // carrega todos os mascotes referenciados de uma vez
    const allIds = [...new Set(teams.flatMap((t) => (t.mascotIdsJson as string[]) ?? []))];
    const mons = await prisma.mascot.findMany({ where: { id: { in: allIds } }, select: { id: true, megaEvolvedAt: true, megaEvolvedFromPokemonId: true, nickname: true, pokemonId: true } });
    const byId = new Map(mons.map((m) => [m.id, m]));

    for (const t of teams) {
      const ids = (t.mascotIdsJson as string[]) ?? [];
      if (ids.length === 0) continue;
      const teamMons = ids.map((id) => byId.get(id)).filter(Boolean) as typeof mons;
      const megaCount = teamMons.filter(isMegaEvolvedMascot).length;
      if (megaCount <= MAX) continue;
      invalid++;
      const megaNames = teamMons.filter(isMegaEvolvedMascot).map((m) => m.nickname ?? String(m.pokemonId)).join(", ");
      console.log(`INVÁLIDA: ${nameById.get(t.playerId) ?? t.playerId} | ${t.battleDate} slot${t.battleSlot} | ${megaCount} megas [${megaNames}]`);
      if (APPLY) {
        await prisma.weeklyMascotLeagueDailyTeam.update({ where: { id: t.id }, data: { mascotIdsJson: [], rolesJson: {} } });
        cleared++;
      }
    }
  }
  console.log(`\nEquipes inválidas (>2 megas): ${invalid}` + (APPLY ? ` | limpas: ${cleared}` : " | [dry-run] use --apply para limpar"));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
