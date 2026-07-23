import { NextRequest, NextResponse } from "next/server";
import { autoRefreshMiauvadaoIfNeeded } from "@/app/(app)/bazar/actions";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await autoRefreshMiauvadaoIfNeeded();
  return NextResponse.json({ ok: true, rotated: Boolean(result), checkedAt: new Date().toISOString() });
}
