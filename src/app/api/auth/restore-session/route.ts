import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MANUAL_SESSION_COOKIE,
  manualSessionCookieOptions,
} from "@/lib/manual-session";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      select: { expires: true, user: { select: { id: true, status: true } } },
    });

    if (!session || session.expires <= new Date()) {
      return NextResponse.json({ ok: false, reason: "expired" }, { status: 401 });
    }
    if (session.user.status === "SUSPENDED" || session.user.status === "REJECTED") {
      return NextResponse.json({ ok: false, reason: "blocked" }, { status: 403 });
    }

    const secure = new URL(request.url).protocol === "https:";
    const response = NextResponse.json({ ok: true });
    response.cookies.set(MANUAL_SESSION_COOKIE, token, manualSessionCookieOptions(secure));
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
