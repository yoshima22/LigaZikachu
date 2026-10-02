import assert from "node:assert/strict";
import { buildTeamWarBracket } from "../src/lib/team-war-bracket";
for (const n of [4, 5, 6, 7, 8, 10, 11, 12]) {
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  const { teams, games } = buildTeamWarBracket(ids);
  const count = new Map<string, number>(); const pairs = new Set<string>();
  for (const g of games) {
    for (const id of [g.a, g.b]) count.set(id, (count.get(id) ?? 0) + 1);
    const k = [g.a, g.b].sort().join("|"); assert.ok(!pairs.has(k), `repetido n=${n}`); pairs.add(k);
  }
  assert.ok(ids.every((id) => count.get(id) === 2), `2 jogos n=${n}`);
  assert.equal(games.length, n);
  const internal = games.filter((g) => g.internal).length;
  assert.equal(internal, n % 2 === 0 ? 0 : 1, `internos n=${n}`);
  assert.equal(teams[0].playerIds.length - teams[1].playerIds.length, n % 2);
}
console.log("PASS team-war-bracket");
