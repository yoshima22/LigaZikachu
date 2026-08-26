/**
 * Habilita a ZikaBet no torneio Liga Zikachu — 3ª Edição:
 * - betConfig com teto SEMANAL de 1500 ZC por jogador (limite geral do campeonato).
 * - betsEnabled=true nas partidas agendadas (DRAFT/PENDING_CONFIRMATION, não-bye),
 *   para que os jogos de cada semana apareçam na ZikaBet.
 * Uso: npx tsx scripts/enable-lz3-zikabet.ts [--apply]
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
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const TOURNAMENT_ID = "cmsdn3vz80003o6v4rge87ap5"; // Liga Zikachu — 3ª Edição

const betConfig = {
  enabled: true,
  allowBetOnSelf: false,
  minBet: 10,
  maxBet: 1500,
  maxDailyBet: 1500,
  maxWeeklyBet: 1500, // teto geral da semana para este campeonato
};

async function main() {
  const t = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_ID }, select: { name: true, betConfig: true } });
  if (!t) throw new Error("Torneio não encontrado.");
  console.log("Torneio:", t.name);
  console.log("betConfig atual:", JSON.stringify(t.betConfig));
  console.log("betConfig novo :", JSON.stringify(betConfig));
  const toEnable = await prisma.match.count({
    where: {
      tournamentWeek: { tournamentId: TOURNAMENT_ID },
      isBye: false,
      betsEnabled: false,
      status: { in: ["DRAFT", "PENDING_CONFIRMATION"] },
    },
  });
  console.log(`Partidas a habilitar (betsEnabled): ${toEnable}`);
  if (!APPLY) { console.log("\n[dry-run] use --apply para efetivar."); return; }

  await prisma.tournament.update({ where: { id: TOURNAMENT_ID }, data: { betConfig } });
  const res = await prisma.match.updateMany({
    where: { tournamentWeek: { tournamentId: TOURNAMENT_ID }, isBye: false, status: { in: ["DRAFT", "PENDING_CONFIRMATION"] } },
    data: { betsEnabled: true },
  });
  console.log(`\n✅ betConfig atualizado. betsEnabled aplicado em ${res.count} partidas.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
