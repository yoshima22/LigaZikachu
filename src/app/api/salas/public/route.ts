import { NextResponse } from "next/server";
import { listPublicQuickRooms } from "@/lib/quick-room";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  if (!rateLimit(`room:public:${clientIp(request.headers)}`, 60, 10 * 60_000)) return NextResponse.json({ error: "Muitas atualizações. Tente novamente em alguns minutos." }, { status: 429 });
  return NextResponse.json({ rooms: await listPublicQuickRooms(12) });
}
