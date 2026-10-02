/**
 * Chave da Guerra de Times: equipes por posição do ranking (ímpares x pares), cada jogador com
 * exatamente 2 jogos, sem repetir confronto.
 * - Equipes iguais (nº par de jogadores): só jogos entre as equipes.
 * - Uma equipe com 1 jogador a mais (nº ímpar): 1 jogo interno da equipe maior, entre os dois
 *   jogadores do meio dela; os demais jogos são entre as equipes.
 * O aproveitamento (vitórias / participações) em team-war-scoring compensa a diferença de tamanho.
 */
export const VANGUARD_TEAM = "Vanguarda Psíquica";
export const DISTRICT_TEAM = "Distrito Dracônico";

export type TeamWarGame = { a: string; b: string; internal: boolean };

export function buildTeamWarBracket(rankedPlayerIds: string[]) {
  const A = rankedPlayerIds.filter((_, i) => i % 2 === 0); // ranks 1,3,5... (maior ou igual)
  const B = rankedPlayerIds.filter((_, i) => i % 2 === 1);
  if (B.length < 2) throw new Error("Guerra de Times precisa de pelo menos 4 jogadores.");
  const games: TeamWarGame[] = [];
  const slotsA = A.map(() => 2);
  if (A.length > B.length) {
    const mid = Math.floor(A.length / 2);
    games.push({ a: A[mid - 1], b: A[mid], internal: true });
    slotsA[mid - 1] -= 1; slotsA[mid] -= 1;
  }
  const slotsB = B.map(() => 2);
  const used = new Set<string>();
  // ponytail: busca em profundidade com vizinhos mais próximos no ranking; sem otimização global.
  const assign = (i: number): boolean => {
    if (i === A.length) return slotsB.every((s) => s === 0);
    const need = slotsA[i];
    const candidates = B.map((_, j) => j).sort((x, y) => Math.abs(x - i) - Math.abs(y - i) || x - y);
    const pick = (start: number, chosen: number[]): boolean => {
      if (chosen.length === need) {
        chosen.forEach((j) => { slotsB[j]--; used.add(`${i}:${j}`); });
        if (assign(i + 1)) return true;
        chosen.forEach((j) => { slotsB[j]++; used.delete(`${i}:${j}`); });
        return false;
      }
      for (let k = start; k < candidates.length; k++) {
        if (slotsB[candidates[k]] > 0 && pick(k + 1, [...chosen, candidates[k]])) return true;
      }
      return false;
    };
    return pick(0, []);
  };
  if (!assign(0)) throw new Error("Não foi possível montar a chave com este número de jogadores.");
  for (const key of used) { const [i, j] = key.split(":").map(Number); games.push({ a: A[i], b: B[j], internal: false }); }
  return { teams: [{ name: VANGUARD_TEAM, playerIds: A }, { name: DISTRICT_TEAM, playerIds: B }], games };
}
