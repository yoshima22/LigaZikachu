/**
 * Audita os combates da Liga Semanal de uma data pela lista autoritativa de
 * formas Mega, salva backup e limpa todas as escalações da liga ativa.
 * Uso: npx tsx scripts/audit-and-clear-weekly-mega-teams.ts [--apply] [YYYY-MM-DD]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] ??= value;
  }
}

import { PrismaClient } from "@prisma/client";
import { isMegaEvolvedMascot } from "../src/lib/battle-divisions";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const dateArg = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
const battleDate = dateArg ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

type StoredLineup = Array<{
  id?: string;
  pokemonId?: number;
  name?: string;
  megaEvolvedAt?: string | null;
  megaEvolvedFromPokemonId?: number | null;
}>;

async function main() {
  const league = await prisma.weeklyMascotLeague.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { weekStart: "desc" },
  });
  if (!league) throw new Error("Nenhuma Liga Semanal ativa.");

  const [teams, matches, presets] = await Promise.all([
    prisma.weeklyMascotLeagueDailyTeam.findMany({ where: { leagueId: league.id }, orderBy: [{ battleDate: "asc" }, { playerId: "asc" }, { battleSlot: "asc" }] }),
    prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId: league.id, battleDate }, orderBy: [{ battleSlot: "asc" }, { createdAt: "asc" }] }),
    prisma.weeklyLeagueTeamPreset.findMany({ orderBy: [{ playerId: "asc" }, { createdAt: "asc" }] }),
  ]);

  const ids = new Set<string>();
  for (const team of teams) for (const id of (team.mascotIdsJson as string[] | null) ?? []) ids.add(id);
  for (const preset of presets) for (const id of (preset.mascotIdsJson as string[] | null) ?? []) ids.add(id);
  for (const match of matches) {
    const result = (match.resultJson ?? {}) as Record<string, unknown>;
    for (const side of ["lineupA", "lineupB"] as const) {
      for (const mascot of ((result[side] as StoredLineup | undefined) ?? [])) if (mascot.id) ids.add(mascot.id);
    }
  }

  const mascots = await prisma.mascot.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, pokemonId: true, nickname: true, megaEvolvedAt: true, megaEvolvedFromPokemonId: true },
  });
  const mascotById = new Map(mascots.map((mascot) => [mascot.id, mascot]));

  const violations: Array<Record<string, unknown>> = [];
  for (const match of matches) {
    const result = (match.resultJson ?? {}) as Record<string, unknown>;
    for (const [side, playerId] of [["lineupA", match.playerAId], ["lineupB", match.playerBId]] as const) {
      const stored = (result[side] as StoredLineup | undefined) ?? [];
      const resolved = stored.map((entry) => (entry.id && mascotById.get(entry.id)) || entry);
      const megas = resolved.filter((mascot) => isMegaEvolvedMascot({
        id: String(mascot.id ?? "stored"),
        pokemonId: mascot.pokemonId,
        megaEvolvedAt: mascot.megaEvolvedAt,
        megaEvolvedFromPokemonId: mascot.megaEvolvedFromPokemonId,
      }));
      if (megas.length > 2) {
        violations.push({
          matchId: match.id,
          battleSlot: match.battleSlot,
          playerId,
          megaCount: megas.length,
          extraMegas: megas.length - 2,
          totalPenalty: (megas.length - 2) * 50,
          megaIds: megas.map((mascot) => mascot.id),
        });
      }
    }
  }

  const invalidPresets = presets.flatMap((preset) => {
    const members = ((preset.mascotIdsJson as string[] | null) ?? []).flatMap((id) => mascotById.get(id) ?? []);
    const megaCount = members.filter(isMegaEvolvedMascot).length;
    return megaCount > 2 ? [{ id: preset.id, playerId: preset.playerId, name: preset.name, megaCount }] : [];
  });

  const backup = {
    generatedAt: new Date().toISOString(),
    battleDate,
    league,
    audit: { matches: matches.length, violations, invalidPresets },
    teams,
    matches,
  };
  mkdirSync(resolve(process.cwd(), "backups"), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = resolve(process.cwd(), "backups", `weekly-mega-audit-${battleDate}-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");

  console.log(JSON.stringify({ battleDate, leagueId: league.id, matches: matches.length, violations, invalidPresets, teamsToClear: teams.length, backupPath, apply }, null, 2));
  if (!apply) return;
  if (violations.length) throw new Error("Há combates com violação real. O script não altera resultados automaticamente; aplique a penalidade e a ressimulação antes de limpar.");
  const deleted = await prisma.weeklyMascotLeagueDailyTeam.deleteMany({ where: { leagueId: league.id } });
  console.log(`Escalações removidas da liga ativa: ${deleted.count}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
