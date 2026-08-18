// ── Motor de chaveamento suíço compartilhado (Liga Semanal e Liga Rush) ──────
//
// Objetivos:
// - Pareia jogadores próximos na tabela (mesma "área" de classificação).
// - Evita revanches na semana e, com peso máximo, mais de um combate contra o
//   mesmo adversário no mesmo dia.
// - Distribui BYE (folga) com justiça: quem teve menos folgas recebe primeiro,
//   sem deixar sempre o mesmo jogador na folga.
// - É sorteado por semana: o `seed` inclui a liga/dia/slot, então o resultado é
//   determinístico (idempotente ao regerar o mesmo dia) mas diferente a cada
//   semana e a cada dia — os mesmos confrontos não se repetem entre semanas.
// - Dá prioridade à parte de baixo da tabela (pareia de baixo para cima).

export type PairingPlayer = { playerId: string; points: number; wins: number; damageDealt: number; byes?: number; freeWins?: number; woLosses?: number };
export type PairingResult = Array<{ aId: string; bId: string | null }>;

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Escolhe quem fica de folga (número ímpar de jogadores): menos folgas primeiro,
// depois quem está mais embaixo na tabela, com desempate sorteado pelo seed.
function pickByePlayer(players: PairingPlayer[], byeCount: Map<string, number>, seed: string): PairingPlayer | null {
  return [...players].sort((a, b) => {
    // Vitória por W.O. vale como uma folga competitiva para não concentrar
    // BYEs e vitórias gratuitas sempre nas mesmas contas.
    const aByes = (a.byes ?? 0) + (a.freeWins ?? 0) + (byeCount.get(a.playerId) ?? 0);
    const bByes = (b.byes ?? 0) + (b.freeWins ?? 0) + (byeCount.get(b.playerId) ?? 0);
    if (aByes !== bByes) return aByes - bByes;
    const scoreDiff = (a.points - b.points) || (a.wins - b.wins) || (a.damageDealt - b.damageDealt);
    if (scoreDiff !== 0) return scoreDiff;
    return (hashStr(a.playerId + "bye" + seed) & 0xff) - (hashStr(b.playerId + "bye" + seed) & 0xff);
  })[0] ?? null;
}

/**
 * Gera os pares de um round.
 * @param seed String única por (liga, dia, slot) — garante idempotência e variação semanal.
 */
export function swissPairSlot(
  players: PairingPlayer[],
  faced: Map<string, Set<string>>,
  todayPaired: Map<string, Set<string>>,
  byeCount: Map<string, number>,
  seed: string,
): PairingResult {
  const result: PairingResult = [];
  const paired = new Set<string>();
  const pool = [...players];

  if (pool.length % 2 === 1) {
    const byePlayer = pickByePlayer(pool, byeCount, seed);
    if (byePlayer) {
      result.push({ aId: byePlayer.playerId, bId: null });
      byeCount.set(byePlayer.playerId, (byeCount.get(byePlayer.playerId) ?? 0) + 1);
      paired.add(byePlayer.playerId);
    }
  }

  // Ordena por pontuação (desc); empates sorteados pelo seed (varia por semana/dia/slot).
  const sorted = pool.sort((a, b) => {
    const scoreDiff = (b.points - a.points) || (b.wins - a.wins);
    if (scoreDiff !== 0) return scoreDiff;
    return (hashStr(a.playerId + seed) & 0xff) - (hashStr(b.playerId + seed) & 0xff);
  });

  // Prioridade para a parte de baixo: pareia de baixo para cima, para que os
  // jogadores abaixo na tabela escolham primeiro seu adversário de mesma área.
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    if (paired.has(p.playerId)) continue;

    const prevOpps = faced.get(p.playerId) ?? new Set<string>();
    const todayOpps = todayPaired.get(p.playerId) ?? new Set<string>();

    const candidates: Array<{ player: PairingPlayer; score: number }> = [];
    for (let j = 0; j < sorted.length; j++) {
      if (j === i || paired.has(sorted[j].playerId)) continue;
      const c = sorted[j];
      let score = Math.abs(p.points - c.points) * 1000 + Math.abs(p.wins - c.wins) * 100;
      if (todayOpps.has(c.playerId)) score += 100000000; // evita a qualquer custo repetir no dia
      if (prevOpps.has(c.playerId)) score += 100000;     // evita revanche na semana
      // Um provável W.O. beneficia primeiro quem recebeu menos vitórias gratuitas.
      if ((p.woLosses ?? 0) > 0) score += (c.freeWins ?? 0) * 5000;
      if ((c.woLosses ?? 0) > 0) score += (p.freeWins ?? 0) * 5000;
      score += hashStr(p.playerId + c.playerId + seed) % 20; // sorteio leve para desempate
      candidates.push({ player: c, score });
    }

    candidates.sort((a, b) => a.score - b.score);
    const opp = candidates[0]?.player ?? null;

    if (opp) {
      // Não grava em todayPaired/faced aqui: o passe de reparo abaixo pode
      // trocar parceiros. Só marcamos como pareados neste slot.
      result.push({ aId: p.playerId, bId: opp.playerId });
      paired.add(p.playerId);
      paired.add(opp.playerId);
    } else {
      // Defensivo: só ocorre se todos os candidatos estiverem indisponíveis.
      result.push({ aId: p.playerId, bId: null });
      byeCount.set(p.playerId, (byeCount.get(p.playerId) ?? 0) + 1);
      paired.add(p.playerId);
    }
  }

  // ── Passe de reparo: elimina repetições do MESMO dia ────────────────────
  // O pareamento guloso (de baixo para cima) pode forçar o último par restante
  // a ser uma revanche do dia (ex.: os dois melhores da tabela sobram juntos em
  // todo slot). Aqui trocamos parceiros com outro par para desfazer isso, desde
  // que exista uma troca sem criar outra repetição do dia.
  const isTodayRepeat = (x: string, y: string) => todayPaired.get(x)?.has(y) ?? false;
  const isWeekRepeat = (x: string, y: string) => faced.get(x)?.has(y) ?? false;
  const realPairs = result.filter((r): r is { aId: string; bId: string } => Boolean(r.bId));
  for (let i = 0; i < realPairs.length; i++) {
    const A = realPairs[i];
    if (!isTodayRepeat(A.aId, A.bId)) continue;
    // Procura um par B para trocar; prefere trocas que também evitem revanche da semana.
    let best: { j: number; mode: 1 | 2; weekClean: boolean } | null = null;
    for (let j = 0; j < realPairs.length; j++) {
      if (j === i) continue;
      const B = realPairs[j];
      // Modo 1: A=(A.a, B.b) e B=(B.a, A.b)
      if (!isTodayRepeat(A.aId, B.bId) && !isTodayRepeat(B.aId, A.bId)) {
        const weekClean = !isWeekRepeat(A.aId, B.bId) && !isWeekRepeat(B.aId, A.bId);
        if (!best || (weekClean && !best.weekClean)) best = { j, mode: 1, weekClean };
      }
      // Modo 2: A=(A.a, B.a) e B=(A.b, B.b)
      if (!isTodayRepeat(A.aId, B.aId) && !isTodayRepeat(A.bId, B.bId)) {
        const weekClean = !isWeekRepeat(A.aId, B.aId) && !isWeekRepeat(A.bId, B.bId);
        if (!best || (weekClean && !best.weekClean)) best = { j, mode: 2, weekClean };
      }
      if (best?.weekClean) break;
    }
    if (best) {
      const B = realPairs[best.j];
      if (best.mode === 1) { const t = A.bId; A.bId = B.bId; B.bId = t; }
      else { const t = A.bId; A.bId = B.aId; B.aId = t; }
    }
  }

  // Registra os pares finais (pós-reparo) em todayPaired e faced.
  for (const r of realPairs) {
    if (!todayPaired.has(r.aId)) todayPaired.set(r.aId, new Set());
    if (!todayPaired.has(r.bId)) todayPaired.set(r.bId, new Set());
    todayPaired.get(r.aId)!.add(r.bId);
    todayPaired.get(r.bId)!.add(r.aId);
    if (!faced.has(r.aId)) faced.set(r.aId, new Set());
    if (!faced.has(r.bId)) faced.set(r.bId, new Set());
    faced.get(r.aId)!.add(r.bId);
    faced.get(r.bId)!.add(r.aId);
  }
  return result;
}
