import { NextRequest, NextResponse } from "next/server";
import { runWeeklyLeagueAutomation } from "@/app/(app)/combates/liga-semanal/actions";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWeeklyLeagueAutomation(secret);
    return NextResponse.json(result, { status: "error" in result ? 500 : 200 });
  } catch (error) {
    console.error("[WeeklyLeagueCron]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
