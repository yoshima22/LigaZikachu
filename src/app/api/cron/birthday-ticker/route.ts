import { NextRequest, NextResponse } from "next/server";
import { publishBirthdayTickerPhrases } from "@/lib/birthday-ticker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await publishBirthdayTickerPhrases();
    return NextResponse.json({ ok: true, ...result, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Cron Birthday] Falha ao publicar frases de aniversário.", error);
    return NextResponse.json({ ok: false, error: "Falha ao publicar frases." }, { status: 500 });
  }
}
