import { NextRequest, NextResponse } from "next/server";
import { finalizeExpiredAuctions } from "@/app/(app)/bazar/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await finalizeExpiredAuctions(25);
    return NextResponse.json({ ok: result.errors.length === 0, ...result, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Cron Bazar] Falha ao encerrar leilões.", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao encerrar leilões.", checkedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}
