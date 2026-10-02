import assert from "node:assert/strict";
import { resolveTeamWar, isParticipationRateWeek } from "../src/lib/team-war-scoring";
const V = ["v1","v2","v3","v4","v5","v6"], D = ["d1","d2","d3","d4","d5"];
const asg = [...V.map((playerId) => ({ playerId, teamName: "V" })), ...D.map((playerId) => ({ playerId, teamName: "D" }))];
// vitórias do time por jogador: distribui w vitórias entre os jogadores (cada um joga 2)
const mk = (ids: string[], wins: number, prizes: number) => ids.map((playerId, i) => ({ playerId, matchesPlayed: 2, wins: i < wins ? 1 : 0, defendedPrizes: i === 0 ? prizes : 0 }));
// D vence 5 de 10 cruzadas => V = 5 cruzadas + 1 interna = 6/12 vs 5/10 => empate; prêmios decidem
let r = resolveTeamWar(asg, [...mk(V, 6, 12), ...mk(D, 5, 20)]);
assert.equal(r.ranked[0].winRate, 0.5); assert.equal(r.ranked[1].winRate, 0.5);
assert.equal(r.winners[0].teamName, "D"); assert.equal(r.tied, false); // 20/10=2 > 12/12=1
// empate total
r = resolveTeamWar(asg, [...mk(V, 6, 12), ...mk(D, 5, 10)]);
assert.ok(r.tied); assert.equal(r.winners.length, 2);
// D 6 vitórias => D vence; D 4 => V vence
assert.equal(resolveTeamWar(asg, [...mk(V, 5, 0), ...mk(D, 6, 0)]).winners[0].teamName, "D");
assert.equal(resolveTeamWar(asg, [...mk(V, 7, 0), ...mk(D, 4, 0)]).winners[0].teamName, "V");
assert.equal(isParticipationRateWeek("PADRAO", { teamScoring: "PARTICIPATION_RATE" }), false);
assert.equal(isParticipationRateWeek("GUERRA_DE_TIMES", {}), false);
assert.equal(isParticipationRateWeek("GUERRA_DE_TIMES", { teamScoring: "PARTICIPATION_RATE" }), true);
console.log("PASS team-war-scoring");
