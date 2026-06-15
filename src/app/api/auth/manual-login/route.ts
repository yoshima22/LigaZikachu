import { NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  ADMIN_MAINTENANCE_BYPASS_COOKIE,
  MANUAL_SESSION_COOKIE,
  MANUAL_SESSION_MAX_AGE_SECONDS,
  manualSessionCookieOptions
} from "@/lib/manual-session";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

function base64Url(bytes: ArrayBuffer) {
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function signAdminMaintenanceBypass(userId: string, expires: Date) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const payload = `${userId}.${expires.getTime()}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64Url(signature)}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || password.length < 8) {
      return NextResponse.json({ error: "Email ou senha invalidos.", code: "INVALID_INPUT" }, { status: 401 });
    }

    let user = await prisma.user.findFirst({
      where: { email: identifier.toLowerCase() },
      select: { id: true, email: true, name: true, image: true, role: true, status: true, passwordHash: true }
    });

    if (!user) {
      const player = await prisma.player.findFirst({
        where: { ptcglNick: { equals: identifier, mode: "insensitive" } },
        select: {
          user: {
            select: { id: true, email: true, name: true, image: true, role: true, status: true, passwordHash: true }
          }
        }
      });
      user = player?.user ?? null;
    }

    if (!user) {
      return NextResponse.json({ error: "Usuario nao encontrado.", code: "USER_NOT_FOUND" }, { status: 401 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Conta sem senha cadastrada.", code: "MISSING_PASSWORD" }, { status: 401 });
    }
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.REJECTED) {
      return NextResponse.json({ error: "Acesso negado. Conta suspensa ou rejeitada.", code: "BLOCKED_STATUS" }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Senha invalida.", code: "INVALID_PASSWORD" }, { status: 401 });
    }

    const expires = new Date(Date.now() + MANUAL_SESSION_MAX_AGE_SECONDS * 1000);
    const sessionToken = crypto.randomUUID();
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires
      }
    });

    const response = NextResponse.json({ success: true });
    const secure = new URL(request.url).protocol === "https:";
    response.cookies.set(
      MANUAL_SESSION_COOKIE,
      sessionToken,
      manualSessionCookieOptions(secure)
    );

    if (ADMIN_ROLES.has(user.role)) {
      const bypassToken = await signAdminMaintenanceBypass(user.id, expires);
      if (bypassToken) {
        response.cookies.set(ADMIN_MAINTENANCE_BYPASS_COOKIE, bypassToken, {
          ...manualSessionCookieOptions(secure),
          maxAge: MANUAL_SESSION_MAX_AGE_SECONDS,
        });
      }
    }

    return response;
  } catch (error) {
    console.error("[ManualLogin] erro inesperado", error);
    return NextResponse.json({ error: "Erro interno no login manual.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
