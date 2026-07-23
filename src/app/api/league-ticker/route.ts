import { NextResponse } from "next/server";
import { getPendingLeagueTickerEvents, markLeagueTickerEventSeen } from "@/lib/league-ticker";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ events: [] }, { status: 401 });
  const player = await getSessionPlayer(user.id);
  if (!player) return NextResponse.json({ events: [] });
  const events = await getPendingLeagueTickerEvents(player.id).catch(() => []);
  return NextResponse.json(
    { events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })) },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const player = await getSessionPlayer(user.id);
  if (!player) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => null) as { eventId?: string } | null;
  if (!body?.eventId) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  await markLeagueTickerEventSeen(player.id, body.eventId);
  return NextResponse.json({ success: true });
}
