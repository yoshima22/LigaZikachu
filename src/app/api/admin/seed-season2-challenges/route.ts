/**
 * Importa registros de desafios de ginásio da 2a Edicao.
 * GET /api/admin/seed-season2-challenges
 *
 * Cria 5 Challenge records (REJECTED = desafiante perdeu):
 *   Cristian: 3 derrotas → -6pts (Semanas 5, 6, 7)
 *   Erick: 2 derrotas → -4pts (Semanas 5, 7)
 *
 * IMPORTANTE: Remove os bônus manuais de penalidade de ginásio
 * do bonusRule da Semana 1 (foram inseridos pelo seed principal
 * como medida temporária antes dos records de Challenge existirem).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser) return NextResponse.json({ error: "Admin not found" }, { status: 400 });

    const log: string[] = [];

    // ── Torneio ──────────────────────────────────────────────────────────────

    const tournament = await prisma.tournament.findUnique({
      where: { slug: "segunda-edicao" },
      select: { id: true }
    });
    if (!tournament) return NextResponse.json({ error: "Torneio segunda-edicao não encontrado. Rode seed-season2 primeiro." }, { status: 400 });

    // ── Mapa de jogadores ─────────────────────────────────────────────────────

    const allPlayers = await prisma.player.findMany({ select: { id: true, displayName: true } });
    const playerMap = new Map<string, string>();
    for (const p of allPlayers) {
      playerMap.set(norm(p.displayName), p.id);
    }

    const pid = (name: string) => playerMap.get(norm(name)) ?? null;
    const cristianId = pid("Cristian");
    const erickId    = pid("Erick");
    const rodrigoId  = pid("Rodrigo");
    const moisesId   = pid("Moises");
    const nakaimaId  = pid("Nakaima");

    if (!cristianId || !erickId || !rodrigoId || !moisesId || !nakaimaId) {
      return NextResponse.json({ error: "Jogadores não encontrados. Verifique os nomes." }, { status: 400 });
    }

    // ── Mapa de semanas ────────────────────────────────────────────────────────

    const weeks = await prisma.tournamentWeek.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, weekNumber: true }
    });
    const weekMap = new Map(weeks.map(w => [w.weekNumber, w.id]));
    const wid = (n: number) => weekMap.get(n) ?? null;

    // ── Badges do torneio (para vincular ao desafio) ──────────────────────────
    // Se não houver badges criados, badgeId fica null (desafio sem badge específica)

    const badges = await prisma.leagueBadge.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, name: true, owners: { select: { playerId: true } } }
    });

    // Função para achar o badge de um defensor pelo playerId do dono
    const badgeOf = (defenderPlayerId: string): string | null => {
      const badge = badges.find(b => b.owners.some(o => o.playerId === defenderPlayerId));
      return badge?.id ?? null;
    };

    // ── Limpar todos os desafios existentes do torneio antes de recriar ─────────
    // Garante que rodar o seed múltiplas vezes não cria duplicatas.
    const deleted = await prisma.challenge.deleteMany({ where: { tournamentId: tournament.id } });
    log.push(`✓ ${deleted.count} desafios anteriores removidos`);

    // ── Desafios confirmados ───────────────────────────────────────────────────
    // status REJECTED = desafiante perdeu (-2pts para o desafiante)
    // status ACCEPTED = desafiante venceu (ganhou a insígnia do defensor)
    //
    // Resumo final:
    //   Cristian: 3 derrotas (S5, S6, S7 vs Rodrigo) = -6pts
    //   Erick: 2 derrotas (S5 vs Rodrigo, S7 vs Moises) = -4pts
    //   Rodrigo: 1 vitória (S8 desafiou Erick pela insígnia de Pedra e venceu)

    const CHALLENGES: Array<{
      challengerId: string;
      challengedId: string;
      tournamentWeekId: string | null;
      badgeId: string | null;
      playedAt: string;
      status: "REJECTED" | "ACCEPTED";
      notes: string;
    }> = [
      // Cristian 3x derrotas
      { challengerId: cristianId, challengedId: rodrigoId, tournamentWeekId: wid(5),
        badgeId: badgeOf(rodrigoId), playedAt: "2026-02-04",
        status: "REJECTED", notes: "Cristian desafiou Rodrigo — Rodrigo defendeu" },
      { challengerId: cristianId, challengedId: rodrigoId, tournamentWeekId: wid(6),
        badgeId: badgeOf(rodrigoId), playedAt: "2026-03-16",
        status: "REJECTED", notes: "Cristian desafiou Rodrigo — Rodrigo defendeu" },
      { challengerId: cristianId, challengedId: rodrigoId, tournamentWeekId: wid(7),
        badgeId: badgeOf(rodrigoId), playedAt: "2026-05-20",
        status: "REJECTED", notes: "Cristian desafiou Rodrigo — Rodrigo defendeu" },
      // Erick 2x derrotas
      // Erick desafiou Nakaima na Semana 3 (1ª derrota)
      { challengerId: erickId, challengedId: nakaimaId, tournamentWeekId: wid(3),
        badgeId: badgeOf(nakaimaId), playedAt: "2026-01-12",
        status: "REJECTED", notes: "Erick desafiou Nakaima — Nakaima defendeu" },
      // Erick desafiou Moises na Semana 7 (2ª derrota)
      { challengerId: erickId, challengedId: moisesId, tournamentWeekId: wid(7),
        badgeId: badgeOf(moisesId), playedAt: "2026-05-20",
        status: "REJECTED", notes: "Erick desafiou Moises — Moises defendeu" },
      // Rodrigo 1x vitória (Semana 8 — desafiou Erick pela Insígnia de Pedra)
      { challengerId: rodrigoId, challengedId: erickId, tournamentWeekId: wid(8),
        badgeId: badgeOf(erickId), playedAt: "2026-06-03",
        status: "ACCEPTED", notes: "Rodrigo desafiou Erick (Pedra) — Rodrigo venceu e conquistou a insígnia" },
    ];

    let created = 0;

    for (const ch of CHALLENGES) {
      if (!ch.tournamentWeekId) {
        log.push(`  ⚠ Semana não encontrada — ignorado`);
        continue;
      }

      await prisma.challenge.create({
        data: {
          type: "BADGE",
          tournamentId: tournament.id,
          tournamentWeekId: ch.tournamentWeekId,
          challengerId: ch.challengerId,
          challengedId: ch.challengedId,
          badgeId: ch.badgeId,
          openedById: adminUser.id,
          resolvedById: adminUser.id,
          status: ch.status,
          openedAt: new Date(ch.playedAt),
          resolvedAt: new Date(ch.playedAt),
          resolutionNotes: ch.notes
        }
      });
      created++;
      log.push(`  ✓ ${ch.status === "ACCEPTED" ? "⚔️ Vitória" : "🛡️ Derrota"}: ${ch.notes}`);
    }

    log.push(`✓ ${created} desafios criados`);

    // ── Remover penalidades manuais de ginásio da Semana 1 ───────────────────
    // Essas entradas foram adicionadas como medida temporária pelo seed principal.
    // Agora que os Challenge records existem (status REJECTED = -2pts cada),
    // as penalidades vêm automaticamente do sistema de ranking.

    const week1Id = wid(1);
    if (week1Id) {
      const week1 = await prisma.tournamentWeek.findUnique({
        where: { id: week1Id }, select: { bonusRule: true }
      });
      if (week1?.bonusRule && typeof week1.bonusRule === "object" && !Array.isArray(week1.bonusRule)) {
        const rule = week1.bonusRule as Record<string, unknown>;
        const bonuses = Array.isArray(rule.manualBonuses)
          ? (rule.manualBonuses as Array<Record<string, unknown>>)
          : [];

        // Remove apenas as entradas de penalidade de ginásio
        const filtered = bonuses.filter(b =>
          typeof b.reason !== "string" ||
          !b.reason.toLowerCase().includes("penalidade ginasio")
        );

        if (filtered.length !== bonuses.length) {
          await prisma.tournamentWeek.update({
            where: { id: week1Id },
            data: { bonusRule: { ...rule, manualBonuses: filtered } as Parameters<typeof prisma.tournamentWeek.update>[0]["data"]["bonusRule"] }
          });
          log.push(`✓ Removidas ${bonuses.length - filtered.length} entradas de penalidade manual da Semana 1`);
          log.push(`  (substituídas pelos registros de Challenge REJECTED)`);
        } else {
          log.push(`- Nenhuma penalidade manual de ginásio encontrada na Semana 1`);
        }
      }
    }

    log.push(`\n📊 Resultado esperado no ranking:`);
    log.push(`  Cristian: 3 desafios, 3 derrotas = -6pts`);
    log.push(`  Erick:    2 desafios, 2 derrotas = -4pts`);
    log.push(`  Rodrigo:  1 desafio, 1 vitória (Pedra S8) | 3+ defesas bem-sucedidas`);
    log.push(`  Moises:   1 defesa bem-sucedida`);
    log.push(`\n🎉 Desafios importados com sucesso!`);

    return NextResponse.json({ success: true, log }, { status: 200 });
  } catch (err) {
    console.error("[seed-season2-challenges]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
