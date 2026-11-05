import { NextResponse } from "next/server";
import { resolvePublicQuickRoom } from "@/lib/quick-room";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Um cartão público só revela o convite ao visitante que escolheu entrar nele. */
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  if (!rateLimit(`room:public-enter:${clientIp(request.headers)}`, 20, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 });
  const { publicId } = await params;
  const code = await resolvePublicQuickRoom(publicId);
  if (!code) return NextResponse.json({ error: "Esta mesa não está mais ao vivo." }, { status: 404 });
  return NextResponse.json({ href: "/salas/" + code });
}
