import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user.id) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ players: [] });

  const players = await prisma.player.findMany({
    where: {
      user: { status: UserStatus.ACTIVE },
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { ptcglNick: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 12,
    select: { id: true, displayName: true, ptcglNick: true },
  });

  return NextResponse.json({ players }, { headers: { "Cache-Control": "private, max-age=15" } });
}
