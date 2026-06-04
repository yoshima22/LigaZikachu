import { NextRequest, NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user) return NextResponse.json({ playerId: null });
  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return NextResponse.json({ playerId: player?.id ?? null });
}
