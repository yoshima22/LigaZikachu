import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user.id) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const playerId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (playerId && !query) {
    const player = await prisma.player.findFirst({
      where: { id: playerId, user: { status: UserStatus.ACTIVE } },
      select: { id: true, displayName: true, ptcglNick: true },
    });
    return NextResponse.json({ players: player ? [player] : [] }, { headers: { "Cache-Control": "private, max-age=30" } });
  }
  if (query.length < 1) return NextResponse.json({ players: [] });

  const players = await prisma.player.findMany({
    where: {
      user: { status: UserStatus.ACTIVE },
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { ptcglNick: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 24,
    select: { id: true, displayName: true, ptcglNick: true },
  });

  const normalized = query.toLocaleLowerCase("pt-BR");
  const ordered = players
    .sort((a, b) => {
      const aStarts = a.displayName.toLocaleLowerCase("pt-BR").startsWith(normalized) || a.ptcglNick?.toLocaleLowerCase("pt-BR").startsWith(normalized) ? 0 : 1;
      const bStarts = b.displayName.toLocaleLowerCase("pt-BR").startsWith(normalized) || b.ptcglNick?.toLocaleLowerCase("pt-BR").startsWith(normalized) ? 0 : 1;
      return aStarts - bStarts || a.displayName.localeCompare(b.displayName, "pt-BR");
    })
    .slice(0, 12);

  return NextResponse.json({ players: ordered }, { headers: { "Cache-Control": "private, max-age=15" } });
}
