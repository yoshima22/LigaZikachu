/**
 * Cron — Ocorrências Misteriosas: ativa as agendadas e encerra as que passaram do prazo.
 * Idempotente (processar duas vezes não libera nem notifica duas vezes).
 */
import { NextRequest, NextResponse } from "next/server";
import { processDueOccurrences } from "@/lib/mascot-occurrences";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await processDueOccurrences();
  return NextResponse.json({ ok: true, ...result });
}
