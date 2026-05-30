import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await request.json() as { token: string };
    if (!token || typeof token !== "string") return NextResponse.json({ error: "Invalid token" }, { status: 400 });

    await prisma.userFcmToken.upsert({
      where: { token },
      update: { userId: session.user.id },
      create: { userId: session.user.id, token }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { token } = await request.json() as { token: string };
    if (token) await prisma.userFcmToken.deleteMany({ where: { token } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
