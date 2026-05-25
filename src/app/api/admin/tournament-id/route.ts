import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true }
  });

  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: tournament.id });
}
