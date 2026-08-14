import { NextRequest, NextResponse } from "next/server";
import { runPushAutomation } from "@/lib/push-automation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runPushAutomation()); }
  catch (error) { console.error("[PushAutomation]", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 }); }
}
