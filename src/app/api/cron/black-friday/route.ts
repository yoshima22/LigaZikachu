import { NextRequest, NextResponse } from "next/server";
import { bfDrawIfDue } from "@/lib/black-friday";

export const runtime = "nodejs";

// Sorteia o cupom da Black Friday assim que o evento acaba (idempotente).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, drawn: await bfDrawIfDue() });
  } catch (error) {
    console.error("[BlackFridayCron]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
