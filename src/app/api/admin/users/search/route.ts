import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { player: { displayName: { contains: query, mode: "insensitive" } } },
        { player: { ptcglNick: { contains: query, mode: "insensitive" } } },
      ],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 12,
    select: { id: true, name: true, email: true, status: true },
  });

  return NextResponse.json({ users }, { headers: { "Cache-Control": "private, max-age=10" } });
}
