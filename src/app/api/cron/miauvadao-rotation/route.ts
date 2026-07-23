import { NextRequest, NextResponse } from "next/server";
import { autoRefreshMiauvadaoIfNeeded } from "@/app/(app)/bazar/actions";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await autoRefreshMiauvadaoIfNeeded({ throwOnError: true });
    return NextResponse.json({ ok: true, rotated: Boolean(result), checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Cron Miauvadao] A rotacao falhou.", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao executar a rotação do Miauvadão.", checkedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}
