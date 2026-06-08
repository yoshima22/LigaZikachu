/**
 * Cron job — limpeza/retenção de dados (doc05: "Tabelas que podem crescer rápido"
 * + "Retenção recomendada").
 *
 * Em vez de deixar zikaCoin_transactions, mascot_events, arena_battles, sessões,
 * shell_game_sessions, audit_logs e presentes resgatados crescerem para sempre
 * (estourando o limite de 500MB do Supabase Free), este job apaga periodicamente
 * apenas registros antigos e já "consumidos" — nunca dados ativos/recentes.
 *
 * Disparado pelo Vercel Cron Jobs (vercel.json).
 * Também pode ser chamado manualmente via admin com o header Authorization correto.
 *
 * Janelas de retenção (conservadoras, alinhadas ao doc05 §16):
 *   - Sessões NextAuth expiradas:       expires < agora - 30 dias
 *   - Shell game sessions:              createdAt < agora - 30 dias
 *   - Eventos de mascote:               createdAt < agora - 90 dias
 *   - Batalhas da Arena (resolvidas):   createdAt < agora - 180 dias
 *   - Presentes já resgatados:          claimedAt < agora - 90 dias
 *   - Audit logs:                       createdAt < agora - 180 dias
 *
 * Segurança: verifica Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // bloqueia se não configurado
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number | string> = {};

  const tasks: Array<[string, () => Promise<{ count: number }>]> = [
    ["expiredSessions", () =>
      prisma.session.deleteMany({ where: { expires: { lt: daysAgo(30) } } })],
    ["shellGameSessions", () =>
      prisma.shellGameSession.deleteMany({ where: { createdAt: { lt: daysAgo(30) } } })],
    ["mascotEvents", () =>
      prisma.mascotEvent.deleteMany({ where: { createdAt: { lt: daysAgo(90) } } })],
    ["arenaBattles", () =>
      prisma.arenaBattle.deleteMany({ where: { createdAt: { lt: daysAgo(180) } } })],
    ["claimedGifts", () =>
      prisma.playerGift.deleteMany({
        where: { status: "CLAIMED", claimedAt: { lt: daysAgo(90) } },
      })],
    ["auditLogs", () =>
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: daysAgo(180) } } })],
  ];

  for (const [key, run] of tasks) {
    try {
      const { count } = await run();
      results[key] = count;
    } catch (e) {
      results[key] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({ ok: true, deleted: results });
}
