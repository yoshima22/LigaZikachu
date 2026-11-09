import { NextRequest, NextResponse } from "next/server";
import { tickAutoEditions } from "@/lib/rei-do-rio/service";

export const runtime = "nodejs";
export const maxDuration = 120;

// Avança só edições com relógio real (autoRun). Idempotente: rodadas são reivindicadas por token.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, editions: await tickAutoEditions() });
  } catch (error) {
    console.error("[ReiDoRioCron]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
