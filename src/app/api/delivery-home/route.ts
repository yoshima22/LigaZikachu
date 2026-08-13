import { NextRequest, NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

async function currentPlayer() {
  const session = await getAppSession().catch(() => null);
  if (!session?.user?.id) return null;
  return prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
}

export async function PUT(request: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json().catch(() => null) as { label?: string; lat?: number; lng?: number } | null;
  const label = body?.label?.trim().slice(0, 60) || "Minha casa";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Localização inválida." }, { status: 400 });
  }
  await prisma.player.update({
    where: { id: player.id },
    data: { deliveryHomeLabel: label, deliveryHomeLatitude: lat, deliveryHomeLongitude: lng },
  });
  return NextResponse.json({ ok: true, home: { label, lat, lng } });
}
