/**
 * Narrativa automática da Liga Zikachu via Groq (gratuito).
 * - narrativa semanal (seções JSON, gerada ao confirmar/encerrar semana)
 * - narrativa de campeonato (visão completa, gerada ao encerrar semana/torneio)
 *
 * Requer: GROQ_API_KEY em Vercel → Environment Variables
 */

import Groq from "groq-sdk";
import { prisma } from "@/lib/prisma";
import { computeTournamentRanking } from "@/lib/ranking";

// ── Tipos de seção ────────────────────────────────────────────────────────────

export interface WeekNarrativeSections {
  intro:      string; // abertura
  highlights: string; // destaques
  challenges: string; // desafios & insígnias
  rankings:   string; // tabela com variações
  players:    string; // análise individual
  title:      string; // corrida pelo título
  closing:    string; // próxima semana
}

export interface TournamentNarrativeSections {
  overview:  string; // visão geral
  badges:    string; // insígnias & patrimônio
  players:   string; // análise individual
  title:     string; // corrida pelo título / matemática
  champion?: string; // apenas quando torneio encerrado
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error(
    "GROQ_API_KEY não configurada. Crie em console.groq.com e adicione no Vercel."
  );
  return new Groq({ apiKey });
}

function parseSections<T extends Record<string, string | undefined>>(
  raw: string,
  keys: string[]
): T {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (keys.some(k => typeof parsed[k] === "string")) return parsed as T;
    }
  } catch { /* fallback */ }
  const result = Object.fromEntries(keys.map((k, i) => [k, i === 0 ? raw : ""]));
  return result as T;
}

// ── Cálculo matemático de eliminação ─────────────────────────────────────────

interface PlayerMath {
  displayName:    string;
  currentPoints:  number;
  remainingWins:  number;
  pointsPerWin:   number;
  maxPossible:    number;
  canWin:         boolean;
}

async function computeMathElimination(
  tournamentId: string,
  weekId: string
): Promise<PlayerMath[]> {
  const [ranking, week] = await Promise.all([
    computeTournamentRanking(tournamentId),
    prisma.tournamentWeek.findUnique({
      where: { id: weekId },
      select: {
        multiplier: true,
        mode: true,
        bonusRule: true,
        matches: {
          where: { status: { notIn: ["CONFIRMED", "CANCELED"] }, isBye: false, playerBId: { not: null } },
          select: { playerAId: true, playerBId: true },
        },
      },
    }),
  ]);

  if (!week || ranking.length === 0) return [];

  const multiplier = Number(week.multiplier ?? 1);
  const basePerWin = 3 * multiplier;

  // Bônus posicional (BATALHA_FINAL)
  const positionBonus: Array<{ positions: number[]; bonusPerWin: number }> = [];
  if (week.bonusRule && typeof week.bonusRule === "object" && !Array.isArray(week.bonusRule)) {
    const br = week.bonusRule as Record<string, unknown>;
    if (Array.isArray(br.positionBonus)) {
      for (const pb of br.positionBonus) {
        if (pb && typeof pb === "object") {
          const positions = Array.isArray((pb as Record<string,unknown>).positions)
            ? ((pb as Record<string,unknown>).positions as number[])
            : [];
          const bonus = typeof (pb as Record<string,unknown>).bonusPerWin === "number"
            ? (pb as Record<string,unknown>).bonusPerWin as number
            : 0;
          positionBonus.push({ positions, bonusPerWin: bonus });
        }
      }
    }
  }

  // Contagem de jogos restantes por jogador
  const remaining = new Map<string, number>();
  for (const m of week.matches) {
    remaining.set(m.playerAId, (remaining.get(m.playerAId) ?? 0) + 1);
    if (m.playerBId) remaining.set(m.playerBId, (remaining.get(m.playerBId) ?? 0) + 1);
  }

  const leaderPoints = ranking[0]?.points ?? 0;

  return ranking.map(entry => {
    const pos = entry.position;
    const posBonus = positionBonus.find(pb => pb.positions.includes(pos))?.bonusPerWin ?? 0;
    const ppw = basePerWin + posBonus;
    const remWins = remaining.get(entry.playerId) ?? 0;
    const maxPossible = entry.points + remWins * ppw;
    return {
      displayName:   entry.displayName,
      currentPoints: entry.points,
      remainingWins: remWins,
      pointsPerWin:  ppw,
      maxPossible,
      canWin: maxPossible >= leaderPoints,
    };
  });
}

// ── System prompts ────────────────────────────────────────────────────────────

const WEEK_SYSTEM_PROMPT = `Você é o narrador oficial da Liga Zikachu.
Retorne APENAS um JSON válido (sem markdown, sem código) com EXATAMENTE estas 7 chaves:
{
  "intro":      "Abertura forte — 2-4 linhas de impacto sobre a semana. Use 📢 no início.",
  "highlights": "Destaques da rodada. Use ⭐ e 📌. Liste vitórias marcantes, prêmios defendidos, conquistas com contexto narrativo.",
  "challenges": "Todos os desafios de ginásio. Use 🎯. Quem desafiou, quem defendeu, patrimônio em jogo. Se não houve, diga isso brevemente.",
  "rankings":   "Tabela numerada com pts e variação (+N/-N). Use 📊. Leitura rápida do que mudou.",
  "players":    "3-6 linhas por jogador. Use 🧠 e nomes como subtítulos. Momento atual + o que aconteceu + rivalidades. NUNCA diga que alguém 'foi mal' sem dar contexto positivo.",
  "title":      "Corrida pelo título. Use 🏁. Liste APENAS quem pode matematicamente ganhar (use os dados fornecidos). Para eliminados matematicamente, explique brevemente o máximo que ainda podem fazer. Inclua percentuais estimados para os candidatos reais.",
  "closing":    "1-2 linhas de suspense e expectativa para a próxima semana ou encerramento."
}

REGRAS:
- Tom empolgante, narrativo, como locutor de campeonato
- Respeitoso com todos — fim da tabela = "resistência", "crescimento", "papel importante"
- Use os dados de eliminação matemática fornecidos. Se o dado diz ELIMINADO, coloque na seção title como eliminado
- Máximo 120 palavras por seção (exceto players que pode ter 200)`;

const TOURNAMENT_SYSTEM_PROMPT = `Você é o narrador oficial da Liga Zikachu.
Retorne APENAS um JSON válido (sem markdown, sem código) com EXATAMENTE estas chaves:
{
  "overview":  "Visão geral da temporada — 4-6 linhas descrevendo o arco narrativo do campeonato inteiro. Use 📋.",
  "badges":    "Mapa completo das insígnias: quem controla o quê, histórico de desafios, patrimônio acumulado. Use 🏅.",
  "players":   "Análise individual completa de cada jogador. Use 🧠. 4-8 linhas por jogador: trajetória, melhores momentos, baixas, rivalidades, insígnias conquistadas.",
  "title":     "Corrida pelo título com cálculo matemático explícito. Use 🏁. Mostre pontos atuais, máximo possível de cada um, quem está vivo e percentuais estimados. Eliminados matematicamente devem ser listados como tal.",
  "champion":  "Se o torneio está encerrado: celebração do campeão com análise da campanha vitoriosa. Se não: deixe como string vazia."
}

REGRAS:
- Use os dados matemáticos fornecidos para ser preciso
- Quando um jogador tem max_possible < líder atual → ELIMINADO MATEMATICAMENTE
- Champion só preenche se o torneio estiver com status FINISHED
- Máximo 200 palavras por seção (exceto players: 350)`;

// ── Coleta de dados semanal ───────────────────────────────────────────────────

export async function buildWeekDataPayload(weekId: string): Promise<{ text: string; tournamentId: string; slug: string; weekNumber: number }> {
  const week = await prisma.tournamentWeek.findUnique({
    where: { id: weekId },
    include: {
      tournament: { select: { id: true, name: true, slug: true, seasonId: true } },
      matches: {
        select: {
          id: true, status: true,
          playerAId: true, playerBId: true,
          playerADeckSubmissionId: true, playerBDeckSubmissionId: true,
          winnerDefendedPrizes: true, winnerPlayerId: true,
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
        },
        where: { isBye: false, playerBId: { not: null } },
        orderBy: { createdAt: "asc" },
      },
      challenges: {
        select: {
          id: true, challengerId: true, challengedId: true, status: true,
          challenger: { select: { id: true, displayName: true } },
          challenged: { select: { id: true, displayName: true } },
          match: { select: { winnerPlayerId: true } },
        },
      },
      deckSubmissions: {
        select: { id: true, deckName: true, archetype: true, playerId: true, player: { select: { displayName: true } } },
      },
    },
  });

  if (!week) throw new Error("Semana não encontrada");

  const weekStart = week.startDate;
  const weekEnd   = new Date(Math.max(week.endDate.getTime(), Date.now()));

  const newAchievements = await prisma.playerAchievement.findMany({
    where: { awardedAt: { gte: weekStart, lte: weekEnd } },
    include: {
      player: { select: { displayName: true } },
      achievement: { select: { name: true, rarity: true } },
    },
  });

  const ranking = await computeTournamentRanking(week.tournament.id);
  const math    = await computeMathElimination(week.tournament.id, weekId);
  const subById = new Map(week.deckSubmissions.map(s => [s.id, s]));

  const lines: string[] = [];

  lines.push(`=== SEMANA ${week.weekNumber}: ${week.label ?? `Semana ${week.weekNumber}`} ===`);
  lines.push(`Torneio: ${week.tournament.name} | Formato: ${week.mode} | Status: ${week.status}`);
  if (week.notes) lines.push(`Regras especiais desta semana: ${week.notes}`);
  lines.push("");

  // Partidas confirmadas
  const confirmed = week.matches.filter(m => m.status === "CONFIRMED");
  const pending   = week.matches.filter(m => m.status !== "CONFIRMED" && m.status !== "CANCELED");

  lines.push("--- RESULTADOS CONFIRMADOS ---");
  if (confirmed.length === 0) {
    lines.push("Nenhum resultado confirmado ainda.");
  } else {
    for (const m of confirmed) {
      const deckA = m.playerADeckSubmissionId ? (subById.get(m.playerADeckSubmissionId)?.deckName ?? "?") : "?";
      const deckB = m.playerBDeckSubmissionId ? (subById.get(m.playerBDeckSubmissionId)?.deckName ?? "?") : "?";
      const winner = m.winnerPlayerId === m.playerAId ? m.playerA.displayName : (m.playerB?.displayName ?? "?");
      const loser  = m.winnerPlayerId === m.playerAId ? (m.playerB?.displayName ?? "?") : m.playerA.displayName;
      lines.push(
        `✓ ${winner} (${deckA}) venceu ${loser} (${deckB})` +
        (m.winnerDefendedPrizes > 0 ? ` | ${m.winnerDefendedPrizes} prêmios defendidos` : "")
      );
    }
  }

  if (pending.length > 0) {
    lines.push(`\nPartidas ainda pendentes: ${pending.map(m => `${m.playerA.displayName} vs ${m.playerB?.displayName}`).join(", ")}`);
  }
  lines.push("");

  // Desafios
  lines.push("--- DESAFIOS DE GINÁSIO ---");
  if (week.challenges.length === 0) {
    lines.push("Nenhum desafio nesta semana.");
  } else {
    for (const c of week.challenges) {
      let result = "Pendente";
      if (c.match?.winnerPlayerId) {
        result = c.match.winnerPlayerId === c.challengerId
          ? "DESAFIANTE VENCEU → roubou a insígnia"
          : "DEFENSOR VENCEU → manteve a insígnia";
      } else if (c.status === "RESOLVED") { result = "Resolvido"; }
      lines.push(`${c.challenger.displayName} desafiou ${c.challenged.displayName} → ${result}`);
    }
  }
  lines.push("");

  // Conquistas
  if (newAchievements.length > 0) {
    lines.push("--- CONQUISTAS NOVAS ---");
    for (const a of newAchievements) {
      lines.push(`${a.player.displayName}: ${a.achievement.name} (${a.achievement.rarity})`);
    }
    lines.push("");
  }

  // Ranking com variação
  lines.push("--- RANKING ATUAL ---");
  for (const entry of ranking.slice(0, 12)) {
    lines.push(
      `${entry.position}. ${entry.displayName} — ${entry.points} pts` +
      ` (${entry.wins}V ${entry.losses}D | ${entry.defendedPrizes} prêmios | ${entry.badgePoints} pts insígnias)`
    );
  }
  lines.push("");

  // Análise matemática
  lines.push("--- ANÁLISE MATEMÁTICA (quem ainda pode ser campeão) ---");
  for (const m of math) {
    const status = m.canWin ? "AINDA PODE SER CAMPEÃO" : "MATEMATICAMENTE ELIMINADO DO TÍTULO";
    lines.push(
      `${m.displayName}: ${m.currentPoints} pts atuais | ` +
      `${m.remainingWins} jogos restantes × ${m.pointsPerWin} pts/vitória = ` +
      `máx. ${m.maxPossible} pts | ${status}`
    );
  }
  lines.push("");

  // Decks
  const deckSet = new Map<string, string>();
  for (const sub of week.deckSubmissions) {
    const key = `${sub.deckName}${sub.archetype ? ` (${sub.archetype})` : ""}`;
    if (!deckSet.has(key)) deckSet.set(key, sub.player.displayName);
  }
  if (deckSet.size > 0) {
    lines.push("--- DECKS DA SEMANA ---");
    for (const [deck, player] of deckSet) lines.push(`${player}: ${deck}`);
    lines.push("");
  }

  return {
    text: lines.join("\n"),
    tournamentId: week.tournament.id,
    slug: week.tournament.slug,
    weekNumber: week.weekNumber,
  };
}

// ── Coleta de dados do torneio ────────────────────────────────────────────────

export async function buildTournamentDataPayload(tournamentId: string): Promise<{ text: string; isFinished: boolean; champion: string | null }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      weeks: {
        where: { status: { in: ["CLOSED", "OPEN", "LOCKED"] } },
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
  const isFinished = tournament.status === "FINISHED";
  const champion = isFinished && ranking.length > 0 ? ranking[0].displayName : null;

  // Cálculo matemático usando a última semana aberta/fechada
  const lastWeek = [...tournament.weeks].reverse().find(w => w.status === "OPEN" || w.status === "CLOSED");
  let mathLines: string[] = [];
  if (lastWeek) {
    const math = await computeMathElimination(tournamentId, lastWeek.id);
    mathLines = math.map(m =>
      `${m.displayName}: ${m.currentPoints} pts | máx. ${m.maxPossible} pts | ` +
      (m.canWin ? "AINDA PODE SER CAMPEÃO" : "MATEMATICAMENTE ELIMINADO")
    );
  }

  const lines: string[] = [];
  lines.push(`=== ANÁLISE GERAL: ${tournament.name} ===`);
  lines.push(`Status: ${tournament.status} | Semanas: ${tournament.weeks.length}`);
  if (champion) lines.push(`🏆 CAMPEÃO: ${champion}`);
  lines.push("");

  lines.push("--- RANKING FINAL ---");
  for (const e of ranking.slice(0, 12)) {
    lines.push(
      `${e.position}. ${e.displayName} — ${e.points} pts` +
      ` (${e.wins}V ${e.losses}D | ${e.defendedPrizes} prêmios | ${e.badgePoints} pts insígnias | ${e.gymChallenges} desafios)`
    );
  }
  lines.push("");

  if (mathLines.length > 0) {
    lines.push("--- ANÁLISE MATEMÁTICA ---");
    lines.push(...mathLines);
    lines.push("");
  }

  lines.push("--- HISTÓRICO POR SEMANA ---");
  for (const w of tournament.weeks) {
    lines.push(`\nSemana ${w.weekNumber}: ${w.label ?? ""} [${w.mode}]`);
    if (w.notes) lines.push(`  Regras: ${w.notes}`);

    const wByPlayer = new Map<string, { wins: number; losses: number; prizes: number }>();
    for (const m of w.matches) {
      if (!m.winnerPlayerId) continue;
      const loserId = m.winnerPlayerId === m.playerAId ? m.playerBId : m.playerAId;
      const wp = wByPlayer.get(m.winnerPlayerId) ?? { wins:0, losses:0, prizes:0 };
      wp.wins++;
      wp.prizes += m.winnerDefendedPrizes;
      wByPlayer.set(m.winnerPlayerId, wp);
      if (loserId) {
        const lp = wByPlayer.get(loserId) ?? { wins:0, losses:0, prizes:0 };
        lp.losses++;
        wByPlayer.set(loserId, lp);
      }
    }
    for (const [pid, stats] of wByPlayer) {
      const name = ranking.find(r => r.playerId === pid)?.displayName ?? pid;
      lines.push(`  ${name}: ${stats.wins}V ${stats.losses}D, ${stats.prizes} prêmios`);
    }

    if (w.challenges.length > 0) {
      for (const c of w.challenges) {
        const result = c.match?.winnerPlayerId
          ? (c.match.winnerPlayerId === c.challengerId ? "roubou insígnia" : "defendeu insígnia")
          : c.status;
        lines.push(`  Desafio: ${c.challenger.displayName} vs ${c.challenged.displayName} → ${result}`);
      }
    }
  }
  lines.push("");

  // Conquistas totais
  const achievements = await prisma.playerAchievement.findMany({
    where: { player: { matchesAsPlayerA: { some: { tournamentWeek: { tournamentId } } } } },
    include: {
      player: { select: { displayName: true } },
      achievement: { select: { name: true, rarity: true } },
    },
    orderBy: { awardedAt: "asc" },
  }).catch(() => []);

  if (achievements.length > 0) {
    lines.push("--- CONQUISTAS DA TEMPORADA ---");
    for (const a of achievements) lines.push(`${a.player.displayName}: ${a.achievement.name}`);
    lines.push("");
  }

  return { text: lines.join("\n"), isFinished, champion };
}

// ── Geração de texto ──────────────────────────────────────────────────────────

export async function generateWeekNarrativeSections(weekId: string): Promise<WeekNarrativeSections> {
  const groq = groqClient();
  const { text } = await buildWeekDataPayload(weekId);

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2000,
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: WEEK_SYSTEM_PROMPT },
      { role: "user",   content: `Gere o recap desta semana da Liga Zikachu:\n\n${text}` },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  return parseSections(raw, ["intro","highlights","challenges","rankings","players","title","closing"]) as WeekNarrativeSections;
}

export async function generateTournamentNarrativeSections(tournamentId: string): Promise<TournamentNarrativeSections> {
  const groq = groqClient();
  const { text, isFinished, champion } = await buildTournamentDataPayload(tournamentId);

  const userMsg = champion
    ? `Gere a análise geral do campeonato. O CAMPEÃO É ${champion} — destaque isso com entusiasmo na seção champion.\n\n${text}`
    : `Gere a análise geral do campeonato em andamento:\n\n${text}`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2500,
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: TOURNAMENT_SYSTEM_PROMPT },
      { role: "user",   content: userMsg },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  return parseSections(raw, ["overview","badges","players","title","champion"]) as TournamentNarrativeSections;
}

// ── Save helpers (usados pelos auto-triggers) ─────────────────────────────────

export async function autoSaveWeekNarrative(weekId: string): Promise<void> {
  const sections = await generateWeekNarrativeSections(weekId);
  await prisma.tournamentWeek.update({
    where: { id: weekId },
    data: { narrativeText: JSON.stringify(sections), narrativeGeneratedAt: new Date() },
  });
}

export async function autoSaveTournamentNarrative(tournamentId: string, slug: string): Promise<void> {
  const sections = await generateTournamentNarrativeSections(tournamentId);
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { narrativeText: JSON.stringify(sections), narrativeGeneratedAt: new Date() },
  });
}

// ── Funções legadas (mantidas para compatibilidade com actions existentes) ────

export async function generateNarrativeText(weekId: string): Promise<string> {
  const sections = await generateWeekNarrativeSections(weekId);
  return JSON.stringify(sections);
}

export async function generateTournamentNarrativeText(tournamentId: string): Promise<string> {
  const sections = await generateTournamentNarrativeSections(tournamentId);
  return JSON.stringify(sections);
}
