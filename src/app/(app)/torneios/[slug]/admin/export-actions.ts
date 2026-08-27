"use server";

import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

function fmt(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function fmtDay(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function statusLabel(status: string) {
  switch (status) {
    case "CONFIRMED": return "Confirmada";
    case "PENDING_CONFIRMATION": return "Pendente de confirmação";
    case "DISPUTED": return "Em disputa";
    case "PENDING": return "Pendente";
    default: return status;
  }
}

/**
 * Gera um relatório .md completo da semana do torneio (resultados, decks,
 * insígnias/pontos, conquistas, contrato Enguiça, top/sorteio). O admin baixa
 * o arquivo no navegador para gerar relatórios em ferramentas externas.
 */
export async function exportTournamentWeekReport(tournamentWeekId: string): Promise<{ filename: string; content: string } | { error: string }> {
  await requireAdmin();

  const week = await prisma.tournamentWeek.findUnique({
    where: { id: tournamentWeekId },
    include: {
      tournament: { select: { id: true, name: true, slug: true, seasonId: true } },
      matches: {
        where: { isBye: false },
        orderBy: [{ scheduledAt: "asc" }, { roundLabel: "asc" }],
        include: { playerA: { select: { id: true, displayName: true, ptcglNick: true } }, playerB: { select: { id: true, displayName: true, ptcglNick: true } } },
      },
      deckSubmissions: {
        orderBy: [{ playerId: "asc" }, { deckNumber: "asc" }],
        include: { player: { select: { displayName: true, ptcglNick: true } }, gymBadge: { select: { name: true } } },
      },
      challenges: {
        where: { badgeId: { not: null } },
        orderBy: { resolvedAt: "asc" },
        include: {
          badge: { select: { name: true } },
          challenger: { select: { displayName: true } },
          challenged: { select: { displayName: true } },
        },
      },
      enguicaCompletions: { include: { player: { select: { displayName: true } } } },
      dayClosures: { include: { rewards: true } },
    },
  });
  if (!week) return { error: "Semana não encontrada." };

  const weekLabel = week.label ?? `Semana ${week.weekNumber}`;
  const nameOf = (p: { displayName: string; ptcglNick: string | null } | null | undefined) =>
    p ? (p.ptcglNick ? `${p.displayName} (${p.ptcglNick})` : p.displayName) : "—";

  // Participantes da semana (a partir das partidas)
  const participants = new Map<string, string>();
  for (const m of week.matches) {
    participants.set(m.playerA.id, nameOf(m.playerA));
    if (m.playerB) participants.set(m.playerB.id, nameOf(m.playerB));
  }
  const participantIds = Array.from(participants.keys());

  // Pontos de insígnia validados nesta semana (via fechamento)
  const badgePointRewards = week.dayClosures.flatMap((c) => c.rewards.filter((r) => r.kind === "GYM_BADGE_POINT"));
  const badgePointsByPlayer = new Map<string, number>();
  for (const r of badgePointRewards) badgePointsByPlayer.set(r.playerId, (badgePointsByPlayer.get(r.playerId) ?? 0) + 1);

  // Progresso total de insígnias do torneio (para contexto)
  const badgeProgress = await prisma.badgeProgress.findMany({
    where: { badge: { tournamentId: week.tournament.id }, playerId: { in: participantIds.length ? participantIds : undefined } },
    include: { badge: { select: { name: true } }, player: { select: { displayName: true } } },
    orderBy: [{ points: "desc" }],
  });

  // Conquistas concedidas durante a janela da semana
  const achievements = await prisma.playerAchievement.findMany({
    where: {
      awardedAt: { gte: week.startDate, lte: week.endDate },
      ...(participantIds.length ? { playerId: { in: participantIds } } : {}),
    },
    orderBy: { awardedAt: "asc" },
    include: { achievement: { select: { name: true, rarity: true } }, player: { select: { displayName: true } } },
  });

  const lines: string[] = [];
  lines.push(`# ${week.tournament.name} — ${weekLabel}`);
  lines.push("");
  lines.push(`- **Período:** ${fmtDay(week.startDate)} a ${fmtDay(week.endDate)}`);
  lines.push(`- **Status da semana:** ${week.status}`);
  lines.push(`- **Partidas:** ${week.matches.length} · **Participantes:** ${participantIds.length}`);
  lines.push(`- **Relatório gerado em:** ${fmt(new Date())}`);
  lines.push("");

  // Top / Sorteio (se a semana já foi fechada)
  const closure = week.dayClosures[0] ?? null;
  if (closure) {
    lines.push(`## Fechamento`);
    lines.push(`- **Top da Semana:** ${(closure.topPlayerId && participants.get(closure.topPlayerId)) ?? "—"}`);
    lines.push(`- **Sorteio:** ${(closure.rafflePlayerId && participants.get(closure.rafflePlayerId)) ?? "—"}`);
    lines.push(`- **Recompensas distribuídas:** ${closure.rewards.length} · em ${fmt(closure.closedAt)}`);
    lines.push("");
  }

  // Resultados
  lines.push(`## Resultados dos jogos`);
  lines.push("");
  lines.push(`| Rodada | Data/Hora | Jogador A | Jogador B | Vencedor | Prêmios def. | Status |`);
  lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const m of week.matches) {
    const winner = m.winnerPlayerId === m.playerA.id ? nameOf(m.playerA) : m.winnerPlayerId === m.playerB?.id ? nameOf(m.playerB) : "—";
    lines.push(`| ${m.roundLabel ?? "—"} | ${fmt(m.scheduledAt)} | ${nameOf(m.playerA)} | ${nameOf(m.playerB)} | ${winner} | ${m.winnerDefendedPrizes ?? 0} | ${statusLabel(m.status)} |`);
  }
  lines.push("");

  // Insígnias / pontos
  lines.push(`## Insígnias e pontos`);
  lines.push("");
  if (badgePointsByPlayer.size > 0) {
    lines.push(`**Pontos de insígnia validados nesta semana:**`);
    lines.push("");
    lines.push(`| Jogador | Pontos na semana |`);
    lines.push(`| --- | --- |`);
    for (const [playerId, pts] of Array.from(badgePointsByPlayer.entries()).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${participants.get(playerId) ?? playerId} | ${pts} |`);
    }
    lines.push("");
  } else {
    lines.push(`_Nenhum ponto de insígnia validado nesta semana (ou semana ainda não fechada)._`);
    lines.push("");
  }
  const resolvedChallenges = week.challenges.filter((c) => c.resolvedAt);
  if (resolvedChallenges.length > 0) {
    lines.push(`**Desafios de insígnia resolvidos:**`);
    lines.push("");
    lines.push(`| Insígnia | Desafiante | Defensor | Status | Resolvido em |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const c of resolvedChallenges) {
      lines.push(`| ${c.badge?.name ?? "—"} | ${c.challenger.displayName} | ${c.challenged.displayName} | ${c.status} | ${fmt(c.resolvedAt)} |`);
    }
    lines.push("");
  }
  if (badgeProgress.length > 0) {
    lines.push(`**Progresso total de insígnias (torneio):**`);
    lines.push("");
    lines.push(`| Insígnia | Jogador | Pontos totais |`);
    lines.push(`| --- | --- | --- |`);
    for (const bp of badgeProgress) {
      lines.push(`| ${bp.badge.name} | ${bp.player.displayName} | ${bp.points} |`);
    }
    lines.push("");
  }

  // Conquistas
  lines.push(`## Conquistas da semana`);
  lines.push("");
  if (achievements.length > 0) {
    lines.push(`| Jogador | Conquista | Raridade | Concedida em |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const a of achievements) {
      lines.push(`| ${a.player.displayName} | ${a.achievement.name} | ${a.achievement.rarity} | ${fmt(a.awardedAt)} |`);
    }
    lines.push("");
  } else {
    lines.push(`_Nenhuma conquista registrada na janela desta semana._`);
    lines.push("");
  }

  // Contrato Enguiça
  if (week.enguicaContractTitle || week.enguicaCompletions.length > 0) {
    lines.push(`## Contrato do Professor Enguiça`);
    lines.push("");
    if (week.enguicaContractTitle) lines.push(`- **Contrato:** ${week.enguicaContractTitle}`);
    if (week.enguicaContractDescription) lines.push(`- **Descrição:** ${week.enguicaContractDescription}`);
    const completers = week.enguicaCompletions.map((c) => c.player.displayName);
    lines.push(`- **Concluíram:** ${completers.length > 0 ? completers.join(", ") : "—"}`);
    lines.push("");
  }

  // Decks
  lines.push(`## Decks da semana`);
  lines.push("");
  if (week.deckSubmissions.length > 0) {
    for (const d of week.deckSubmissions) {
      lines.push(`### ${nameOf(d.player)} — ${d.deckName}${d.deckNumber > 1 ? ` (deck ${d.deckNumber})` : ""}`);
      lines.push("");
      lines.push(`- **Arquétipo:** ${d.archetype ?? "—"}`);
      lines.push(`- **Status:** ${d.status}${d.isLate ? " · (enviado com atraso)" : ""}`);
      if (d.mascotMissionMascotName) lines.push(`- **Missão de Mascote:** ${d.mascotMissionMascotName} — ${d.mascotMissionValid ? "válida ✅" : "inválida ❌"}`);
      if (d.gymBadge) lines.push(`- **Insígnia de ginásio:** ${d.gymBadge.name} — ${d.gymBadgeValid ? "válida ✅" : "inválida ❌"}`);
      lines.push("");
      lines.push("```");
      lines.push(d.deckList.trim());
      lines.push("```");
      lines.push("");
    }
  } else {
    lines.push(`_Nenhum deck registrado nesta semana._`);
    lines.push("");
  }

  const safeSlug = week.tournament.slug.replace(/[^a-z0-9-]/gi, "-");
  const filename = `${safeSlug}-semana-${week.weekNumber}.md`;
  return { filename, content: lines.join("\n") };
}
