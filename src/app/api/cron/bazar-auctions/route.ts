import { NextRequest, NextResponse } from "next/server";
import { finalizeExpiredAuctions, finalizeExpiredListings } from "@/app/(app)/bazar/actions";
import { publishDuePremiumBazarTicker } from "@/lib/bazar-premium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [auctions, listings, premiumTicker] = await Promise.all([
      finalizeExpiredAuctions(25),
      finalizeExpiredListings(25),
      publishDuePremiumBazarTicker(),
    ]);
    return NextResponse.json({
      ok: auctions.errors.length === 0 && listings.errors.length === 0,
      auctions,
      listings,
      premiumTicker,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron Bazar] Falha ao encerrar leilões.", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao encerrar leilões.", checkedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}
