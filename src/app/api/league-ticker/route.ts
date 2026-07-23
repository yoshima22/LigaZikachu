import { NextResponse } from "next/server";
import { getActiveLeagueTickerEvents } from "@/lib/league-ticker";

export async function GET() {
  const events = await getActiveLeagueTickerEvents().catch(() => []);
  return NextResponse.json(
    { events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })) },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
