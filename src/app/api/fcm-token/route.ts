import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as { token?: string };
    const token = body?.token;
    if (!token || typeof token !== "string" || token.length < 10) {
      return NextResponse.json({ error: "Token inválido ou vazio" }, { status: 400 });
    }

    await prisma.userFcmToken.upsert({
      where: { token },
      update: { userId: session.user.id },
      create: { userId: session.user.id, token }
    });

    return NextResponse.json({ ok: true, userId: session.user.id });
  } catch (err) {
    console.error("[FCM token registration error]", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}

export async function GET() {
  // Endpoint de diagnóstico — apenas para desenvolvimento/admin
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tokens = await prisma.userFcmToken.findMany({
      where: { userId: session.user.id },
      select: { token: true, createdAt: true, updatedAt: true }
    });

    return NextResponse.json({
      userId: session.user.id,
      tokenCount: tokens.length,
      tokens: tokens.map((t) => ({
        prefix: t.token.substring(0, 20) + "...",
        updatedAt: t.updatedAt
      })),
      fcmConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
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
