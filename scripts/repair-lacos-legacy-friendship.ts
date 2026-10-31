/** Repara amizades que "perderam pontos" entre o score legado (derivado de
 * interactionCount) e o score real de Laços.
 *
 * 1) RESTORE: devolve os pontos a quem ja perdeu —
 *    a) Bala de Mel que reescreveu o score para 40 (score==40, n>=6, sem batalhas);
 *    b) Laços que escreveu por cima de um score legado 0 (score == soma dos logs,
 *       relação existia antes e nunca teve batalha) — soma o legado que era exibido.
 * 2) BACKFILL: grava o score legado em toda amizade ativa com score 0, para a tela
 *    e o banco passarem a concordar (ninguem perde pontos no proximo evento).
 *
 * Dry-run por padrao. Rode: npx tsx scripts/repair-lacos-legacy-friendship.ts [--apply]
 * Backup (JSON) das linhas afetadas e gravado em scripts/.backup-lacos-*.json antes de aplicar.
 */
import { existsSync, readFileSync, writeFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client";
import { clampScore, legacyRelationScore, relationTypeFromScore } from "../src/lib/mascot-bonds-shared";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
type Change = { id: string; player: string; reason: string; before: number; after: number };

async function main() {
  const changes = new Map<string, Change>();

  // logs -> soma esperada por direcao
  const logs = await prisma.mascotSocialDecisionLog.findMany({ where: { mascotBId: { not: null } }, select: { mascotAId: true, mascotBId: true, resultJson: true } });
  const exp = new Map<string, { sum: number; cnt: number }>();
  const add = (a: string, b: string, d: number) => { const k = `${a}>${b}`; const e = exp.get(k) ?? { sum: 0, cnt: 0 }; e.sum += d; e.cnt++; exp.set(k, e); };
  for (const l of logs) {
    const r = (l.resultJson ?? {}) as { scoreDelta?: number; scoreDeltaB?: number };
    add(l.mascotAId, l.mascotBId!, Number(r.scoreDelta ?? 0));
    add(l.mascotBId!, l.mascotAId, Number(r.scoreDeltaB ?? r.scoreDelta ?? 0));
  }

  const active = await prisma.mascotRelation.findMany({
    where: { isActive: true },
    select: { id: true, mascotAId: true, mascotBId: true, type: true, relationshipScore: true, interactionCount: true, wins: true, losses: true, mascotA: { select: { player: { select: { displayName: true } } } } },
  });

  for (const r of active) {
    const player = r.mascotA.player.displayName;
    if (r.wins + r.losses > 0) continue;
    if (r.relationshipScore === 40 && r.interactionCount >= 6) {
      const after = Math.max(40, legacyRelationScore("FRIEND", r.interactionCount));
      if (after > 40) changes.set(r.id, { id: r.id, player, reason: "bala-overwrite", before: r.relationshipScore, after });
      continue;
    }
    const e = exp.get(`${r.mascotAId}>${r.mascotBId}`);
    // So score > 0: com score negativo nao da pra afirmar que a origem era amizade.
    if (e && r.relationshipScore > 0 && e.sum === r.relationshipScore) {
      const n0 = r.interactionCount - e.cnt;
      if (n0 >= 1) changes.set(r.id, { id: r.id, player, reason: "lacos-over-legacy", before: r.relationshipScore, after: clampScore(r.relationshipScore + legacyRelationScore("FRIEND", n0)) });
    }
  }
  for (const r of active) {
    if (r.relationshipScore === 0 && r.type === "FRIEND" && !changes.has(r.id)) {
      changes.set(r.id, { id: r.id, player: r.mascotA.player.displayName, reason: "backfill-legacy", before: 0, after: legacyRelationScore("FRIEND", r.interactionCount) });
    }
  }

  const list = [...changes.values()];
  const byReason: Record<string, number> = {}; for (const c of list) byReason[c.reason] = (byReason[c.reason] ?? 0) + 1;
  console.log({ total: list.length, byReason });
  console.log(list.filter((c) => c.reason !== "backfill-legacy"));
  const byPlayer: Record<string, number> = {}; for (const c of list) byPlayer[c.player] = (byPlayer[c.player] ?? 0) + 1;
  console.log("por jogador", Object.entries(byPlayer).sort((a, b) => b[1] - a[1]).slice(0, 12));
  if (!APPLY) return console.log("dry-run — use --apply para gravar");

  const rows = await prisma.mascotRelation.findMany({ where: { id: { in: list.map((c) => c.id) } } });
  const backup = resolve(process.cwd(), `scripts/.backup-lacos-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(rows));
  console.log("backup:", backup, rows.length);

  for (const c of list) {
    // Guarda de idempotencia: so grava se o score ainda e o que lemos.
    await prisma.mascotRelation.updateMany({
      where: { id: c.id, relationshipScore: c.before },
      data: { relationshipScore: c.after, type: relationTypeFromScore(c.after) },
    });
  }
  console.log("aplicado");
}
main().finally(() => prisma.$disconnect());
