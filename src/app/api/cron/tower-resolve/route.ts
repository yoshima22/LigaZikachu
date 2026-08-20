import { NextRequest, NextResponse } from "next/server";
import { sweepTowerDeadlines } from "@/lib/tower/turn";

export const runtime = "nodejs";

// Resolve janelas de turno expiradas da Torre dos Rebeldes (Online 120s / Lento 4h).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const resolved = await sweepTowerDeadlines();
    return NextResponse.json({ resolved }, { status: 200 });
  } catch (error) {
    console.error("[TowerResolveCron]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
