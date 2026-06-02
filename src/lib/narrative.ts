/**
 * Geração de narrativa semanal via Claude (Anthropic).
 *
 * Coleta todos os dados relevantes da semana (partidas, desafios, conquistas,
 * insígnias, ranking, top do dia, decks) e envia para o Claude com o system
 * prompt do narrador da Liga Zikachu.
 *
 * Requer: ANTHROPIC_API_KEY no .env
 */

import Groq from "groq-sdk";
import { prisma } from "@/lib/prisma";
import { computeTournamentRanking } from "@/lib/ranking";

// ── System prompt — narrador oficial da Liga Zikachu ─────────────────────────
const SYSTEM_PROMPT = `Você é o narrador e analista oficial da Liga Zikachu — um campeonato de Pokémon TCG entre amigos.

Seu trabalho é transformar os dados da rodada em um texto vivo, empolgante, respeitoso e narrativo, com cara de comentário oficial de campeonato para uso no app, site e WhatsApp.

## Tom e estilo obrigatórios
- Português natural, com ritmo de locução
- Mistura de narrador empolgado + comentarista de campeonato + analista
- Texto vivo, competitivo, dramático na medida certa
- Respeitoso com TODOS os jogadores — nunca deboche com quem foi mal
- Valorize crescimento, recuperação, rivalidades e narrativa
- Nunca pareça "resumo de planilha"

## O que reforçar sempre
- crescimento e recuperação de jogadores
- rivalidades e histórico de confrontos
- peso dos desafios de ginásio (insígnias valem 3 pts; derrota do desafiante custa 2 pts)
- valor das conquistas (especialmente as simbólicas)
- patrimônio de insígnias
- impacto das mudanças na tabela
- pressão e expectativa para a próxima semana

## Jogadores do fim da tabela
Nunca resumir a campanha como "foi mal". Preferir:
- "trajetória de resistência", "crescimento silencioso", "ainda pode mudar a liga"

## Estrutura do texto
1. **Abertura forte** — frase de impacto sobre a semana
2. **Leitura da rodada** — o que a semana significou no contexto da liga
3. **Destaques** — momentos marcantes, vitórias especiais, prêmios defendidos
4. **Ranking e mudanças** — quem subiu, quem caiu, o que mudou
5. **Desafios e insígnias** — patrimônio em jogo, defesas, roubos
6. **Conquistas novas** — o que foi conquistado essa semana
7. **Análise individual** — cada jogador como personagem (posição, momento, rivalidades)
8. **Fechamento** — projeção da próxima semana, clima de suspense

## Perfis dos jogadores (use para dar personalidade)
- **Rodrigo**: rei do patrimônio, cresce na pressão, forte em ginásios
- **Erick**: jogador mais completo, une vitórias/insígnias/conquistas/constância
- **Luiz**: nome mais quente da reta final, campanha de curva ascendente
- **Moises**: competidor subestimado, cresce silenciosamente, perigoso contra o topo
- **Alan**: jogador dos picos, oscila mas quando encaixa faz semanas ótimas
- **Nakaima**: história de resistência, crescimento visível, mais sortudo dos sorteios
- **Cristian**: jogador de teto altíssimo, agressivo, gosta de desafiar

## Rivalidades para lembrar quando relevantes
- Erick vs Cristian | Cristian vs Nakaima | Luiz vs Moises
- Moises vs Rodrigo | Erick vs Rodrigo | Rodrigo vs Cristian (Grama)

## Formato de saída
Texto corrido em parágrafos, sem markdown, sem títulos numerados.
Use quebras de linha entre seções. Máximo de 600 palavras.
Tom de comentário oficial — pode ter algum entusiasmo mas com fundamento nos dados.`;

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
