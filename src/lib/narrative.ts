/**
 * Geração de narrativa via Groq (grátis, llama-3.3-70b).
 * - narrativa semanal (por semana)
 * - narrativa de campeonato (visão geral de todas as semanas)
 *
 * Requer: GROQ_API_KEY no Vercel Environment Variables
 */

import Groq from "groq-sdk";
import { prisma } from "@/lib/prisma";
import { computeTournamentRanking } from "@/lib/ranking";

// ── System prompt — narrador oficial da Liga Zikachu ─────────────────────────
const SYSTEM_PROMPT = `Você é o narrador e analista oficial da Liga Zikachu — um campeonato de Pokémon TCG entre amigos.

Seu trabalho é transformar os dados da rodada em um texto vivo, empolgante, respeitoso e narrativo, com cara de comentário oficial de campeonato para uso no app, site e WhatsApp do grupo.

## Tom e estilo
- Português natural, com ritmo de locução esportiva
- Narrador empolgado + analista que entende a liga + comentarista de campeonato
- Dramático na medida certa — com fundamento nos dados, nunca artificial
- Respeitoso com TODOS os jogadores
- NUNCA pareça resumo de planilha

## Formato de saída OBRIGATÓRIO
Use exatamente esta estrutura com emojis de seção:

📢 [Título da semana ou campeonato]

[Abertura forte — 2-3 linhas de impacto sobre o que aconteceu]

⚔️ [Nome da semana / formato]
[Leitura do formato e contexto da rodada]

🌟 Destaques da rodada
[Os momentos mais marcantes, vitórias, prêmios defendidos, conquistas]

🎯 O peso dos desafios
[Desafios de ginásio com resultados, patrimônio em jogo, quem defendeu, quem roubou]

📊 Tabela atualizada
[Ranking numerado com pontuação e variação em relação à semana anterior]

🧠 Leitura jogador por jogador
[Para cada jogador: análise de 3-5 linhas com resultados, momento e projeção]

🏁 Corrida pelo título
[Quem ainda pode ser campeão e por quê, com percentuais estimados quando relevante]

[Fechamento com projeção da próxima semana — frase de impacto]

## Regras narrativas
- Desafios de ginásio: insígnia vale 3 pts; derrota do desafiante custa 2 pts
- Nunca diga que alguém "foi mal" — use "semana de resistência", "pagou o preço", "ainda pode reagir"
- Valorize sempre: crescimento, recuperação, rivalidades, patrimônio de insígnias
- Jogadores do fim da tabela têm papel na liga: "pode mudar o destino do topo", "termina em alta"

## Perfis narrativos dos jogadores
- **Rodrigo**: rei do patrimônio, cresce na pressão, forte em ginásios, referência da liga
- **Erick**: jogador mais completo, une vitórias/insígnias/conquistas/constância, perseguidor imediato
- **Luiz**: nome mais quente da reta final, campanha de curva ascendente, melhor win rate
- **Moises**: competidor subestimado, crescimento silencioso, perigoso contra o topo
- **Alan**: jogador dos picos — oscila, mas quando encaixa faz semanas ótimas
- **Nakaima**: história de resistência, crescimento visível, mais sortudo dos sorteios
- **Cristian**: teto altíssimo, agressivo, gosta de desafiar, maior bônus por vitória na reta final

## Rivalidades marcantes
- Erick vs Cristian | Cristian vs Nakaima | Luiz vs Moises
- Moises vs Rodrigo | Erick vs Rodrigo | Rodrigo vs Cristian (Grama)

## Comprimento
Semana individual: 500-700 palavras.
Análise geral de campeonato: 700-900 palavras.`;

// ── Funções de coleta de dados ────────────────────────────────────────────────

export async function buildWeekDataPayload(weekId: string): Promise<string> {
  const week = await prisma.tournamentWeek.findUnique({
    where: { id: weekId },
    include: {
      tournament: { select: { id: true, name: true, slug: true, seasonId: true } },
      matches: {
        select: {
          id: true, status: true,
          playerAId: true, playerBId: true,
          playerADeckSubmissionId: true, playerBDeckSubmissionId: true,
          winnerDefendedPrizes: true,
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
          winnerPlayer: { select: { id: true, displayName: true } },
        },
        where: { isBye: false, playerBId: { not: null } },
        orderBy: { createdAt: "asc" },
      },
      challenges: {
        select: {
          id: true, challengerId: true, challengedId: true, status: true,
          challenger: { select: { id: true, displayName: true } },
          challenged: { select: { id: true, displayName: true } },
          match: { select: { winnerPlayerId: true, playerAId: true, playerBId: true, winnerDefendedPrizes: true } },
        },
      },
      deckSubmissions: {
        select: { id: true, deckName: true, archetype: true, playerId: true, player: { select: { displayName: true } } },
      },
    },
  });

  if (!week) throw new Error("Semana não encontrada");

  // Conquistas da semana
  const weekStart = week.startDate;
  const weekEnd   = week.endDate ?? new Date();
  const newAchievements = await prisma.playerAchievement.findMany({
    where: { awardedAt: { gte: weekStart, lte: weekEnd } },
    include: {
      player: { select: { displayName: true } },
      achievement: { select: { name: true, description: true, rarity: true } },
    },
  });

  // Ranking atual
  const ranking = await computeTournamentRanking(week.tournament.id);

  // ── Monta o payload textual ──────────────────────────────────────────────────
  const lines: string[] = [];

  lines.push(`=== SEMANA ${week.weekNumber}: ${week.label ?? `Semana ${week.weekNumber}`} ===`);
  lines.push(`Torneio: ${week.tournament.name}`);
  lines.push(`Formato: ${week.mode}`);
  lines.push(`Status: ${week.status}`);
  lines.push("");

  // Mapa de deck submissions por ID para lookup rápido
  const subById = new Map(week.deckSubmissions.map(s => [s.id, s]));

  // Partidas
  lines.push("--- PARTIDAS DA SEMANA ---");
  if (week.matches.length === 0) {
    lines.push("Nenhuma partida registrada.");
  } else {
    for (const m of week.matches) {
      const winner = m.winnerPlayer?.displayName ?? "Sem resultado";
      const deckA  = m.playerADeckSubmissionId ? (subById.get(m.playerADeckSubmissionId)?.deckName ?? "?") : "?";
      const deckB  = m.playerBDeckSubmissionId ? (subById.get(m.playerBDeckSubmissionId)?.deckName ?? "?") : "?";
      lines.push(
        `${m.playerA.displayName} (${deckA}) vs ${m.playerB?.displayName ?? "Bye"} (${deckB})` +
        ` → Vencedor: ${winner}` +
        (m.winnerDefendedPrizes > 0 ? ` | Prêmios defendidos: ${m.winnerDefendedPrizes}` : "") +
        ` [${m.status}]`
      );
    }
  }
  lines.push("");

  // Desafios de ginásio
  lines.push("--- DESAFIOS DE GINÁSIO ---");
  if (week.challenges.length === 0) {
    lines.push("Nenhum desafio nesta semana.");
  } else {
    for (const c of week.challenges) {
      let result = "Pendente";
      if (c.match?.winnerPlayerId) {
        result = c.match.winnerPlayerId === c.challengerId
          ? "Desafiante venceu → roubou a insígnia"
          : "Defensor venceu → manteve a insígnia";
      } else if (c.status === "RESOLVED") {
        result = "Resolvido";
      }
      lines.push(`${c.challenger.displayName} desafiou ${c.challenged.displayName} → ${result}`);
    }
  }
  lines.push("");

  // Conquistas
  lines.push("--- CONQUISTAS NOVAS ---");
  if (newAchievements.length === 0) {
    lines.push("Nenhuma conquista nova nesta semana.");
  } else {
    for (const a of newAchievements) {
      lines.push(`${a.player.displayName}: ${a.achievement.name} (${a.achievement.rarity})`);
    }
  }
  lines.push("");

  // Ranking atual
  lines.push("--- RANKING ATUAL ---");
  for (const entry of ranking.slice(0, 15)) {
    lines.push(
      `${entry.position}. ${entry.displayName} — ${entry.points} pts` +
      ` (${entry.wins}V ${entry.losses}D, ${entry.defendedPrizes} prêmios defendidos, ${entry.badgePoints} pts insígnias)`
    );
  }
  lines.push("");

  // Decks usados na semana (sem duplicatas)
  const deckSet = new Map<string, string>();
  for (const sub of week.deckSubmissions) {
    const key = `${sub.deckName}${sub.archetype ? ` (${sub.archetype})` : ""}`;
    deckSet.set(key, sub.player.displayName);
  }
  if (deckSet.size > 0) {
    lines.push("--- DECKS DA SEMANA ---");
    for (const [deck, player] of deckSet) {
      lines.push(`${player}: ${deck}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Chamada ao Claude ─────────────────────────────────────────────────────────

export async function generateNarrativeText(weekId: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error(
    "GROQ_API_KEY não configurada. " +
    "Crie uma chave grátis em console.groq.com → API Keys → Create API Key " +
    "e adicione no Vercel → Environment Variables."
  );

  const groq = new Groq({ apiKey });
  const dataPayload = await buildWeekDataPayload(weekId);

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1200,
    temperature: 0.85,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `Gere o recap narrativo desta semana da Liga Zikachu com base nos dados abaixo.\n\n${dataPayload}` },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Resposta vazia da API.");
  return text;
}

// ── Narrativa de campeonato geral ─────────────────────────────────────────────

export async function buildTournamentDataPayload(tournamentId: string): Promise<string> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      weeks: {
        where: { status: { in: ["CLOSED", "OPEN"] } },
        orderBy: { weekNumber: "asc" },
        include: {
          matches: {
            where: { isBye: false, playerBId: { not: null }, status: "CONFIRMED" },
            select: {
              playerAId: true, playerBId: true, winnerPlayerId: true, winnerDefendedPrizes: true,
              playerA: { select: { displayName: true } },
              playerB: { select: { displayName: true } },
            },
          },
          challenges: {
            select: {
              challengerId: true, challengedId: true, status: true,
              challenger: { select: { displayName: true } },
              challenged: { select: { displayName: true } },
              match: { select: { winnerPlayerId: true } },
            },
          },
        },
      },
    },
  });
  if (!tournament) throw new Error("Torneio não encontrado");

  const ranking = await computeTournamentRanking(tournamentId);

  const lines: string[] = [];
  lines.push(`=== ANÁLISE GERAL: ${tournament.name} ===`);
  lines.push(`Semanas concluídas: ${tournament.weeks.length}`);
  lines.push("");

  // Ranking geral
  lines.push("--- RANKING ATUAL ---");
  for (const e of ranking.slice(0, 15)) {
    lines.push(
      `${e.position}. ${e.displayName} — ${e.points} pts ` +
      `(${e.wins}V ${e.losses}D, ${e.defendedPrizes} prêmios, ${e.badgePoints} pts insígnias)`
    );
  }
  lines.push("");

  // Resumo por semana
  lines.push("--- HISTÓRICO POR SEMANA ---");
  for (const w of tournament.weeks) {
    lines.push(`\nSemana ${w.weekNumber}: ${w.label ?? ""} [${w.mode}] [${w.status}]`);

    for (const m of w.matches) {
      const won = m.winnerPlayerId;
      const winner = won === m.playerAId ? m.playerA.displayName : (m.playerB?.displayName ?? "?");
      const loser  = won === m.playerAId ? (m.playerB?.displayName ?? "?") : m.playerA.displayName;
      lines.push(
        `  ${winner} venceu ${loser}` +
        (m.winnerDefendedPrizes > 0 ? ` (${m.winnerDefendedPrizes} prêmios defendidos)` : "")
      );
    }

    if (w.challenges.length > 0) {
      lines.push(`  Desafios:`);
      for (const c of w.challenges) {
        const result = c.match?.winnerPlayerId
          ? (c.match.winnerPlayerId === c.challengerId ? "Desafiante venceu" : "Defensor venceu")
          : c.status;
        lines.push(`    ${c.challenger.displayName} vs ${c.challenged.displayName} → ${result}`);
      }
    }
  }
  lines.push("");

  // Conquistas de toda a temporada
  const allAchievements = await prisma.playerAchievement.findMany({
    where: {
      player: {
        matchesAsPlayerA: { some: { tournamentWeek: { tournamentId } } }
      }
    },
    include: {
      player: { select: { displayName: true } },
      achievement: { select: { name: true, rarity: true } },
    },
    orderBy: { awardedAt: "asc" },
  });

  if (allAchievements.length > 0) {
    lines.push("--- CONQUISTAS DA TEMPORADA ---");
    for (const a of allAchievements) {
      lines.push(`${a.player.displayName}: ${a.achievement.name} (${a.achievement.rarity})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function generateTournamentNarrativeText(tournamentId: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada.");

  const groq = new Groq({ apiKey });
  const dataPayload = await buildTournamentDataPayload(tournamentId);

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1600,
    temperature: 0.85,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Gere a ANÁLISE GERAL DO CAMPEONATO da Liga Zikachu com base nos dados abaixo.
Inclua: visão geral da temporada, destaques de cada semana, situação das insígnias, corrida pelo título (com chance % de cada candidato), análise jogador por jogador e projeção da rodada final.

${dataPayload}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Resposta vazia da API.");
  return text;
}
