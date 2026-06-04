import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token"
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || password.length < 8) {
      return NextResponse.json({ error: "Email ou senha invalidos.", code: "INVALID_INPUT" }, { status: 401 });
    }

    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[ManualLogin] AUTH_SECRET/NEXTAUTH_SECRET ausente.");
      return NextResponse.json({ error: "Configuracao de autenticacao ausente.", code: "MISSING_SECRET" }, { status: 500 });
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
      console.warn("[ManualLogin] usuario nao encontrado", { identifier });
      return NextResponse.json({ error: "Usuario nao encontrado para este email ou nick.", code: "USER_NOT_FOUND" }, { status: 401 });
    }

    if (!user.passwordHash) {
      console.warn("[ManualLogin] usuario sem passwordHash", { identifier, userId: user.id, status: user.status });
      return NextResponse.json({ error: "Esta conta esta sem senha cadastrada. Redefina a senha pelo admin.", code: "MISSING_PASSWORD" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      console.warn("[ManualLogin] senha invalida", { identifier, userId: user.id, status: user.status });
      return NextResponse.json({ error: "Senha invalida para esta conta.", code: "INVALID_PASSWORD" }, { status: 401 });
    }

    if (user.status === UserStatus.REJECTED || user.status === UserStatus.SUSPENDED) {
      return NextResponse.json({ error: "Acesso negado. Sua conta pode estar suspensa.", code: "BLOCKED_STATUS" }, { status: 403 });
    }

    const secure = new URL(request.url).protocol === "https:";
    const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
    const response = NextResponse.json({ success: true });

    for (const cookieName of COOKIE_NAMES) {
      const shouldSetSecureCookie = cookieName.startsWith("__Secure-");
      if (shouldSetSecureCookie && !secure) continue;

      const token = await encode({
        token: {
          sub: user.id,
          name: user.name,
          email: user.email,
          picture: user.image,
          role: user.role as Role,
          status: user.status as UserStatus
        },
        secret,
        salt: cookieName,
        maxAge: SESSION_MAX_AGE
      });

      response.cookies.set(cookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: shouldSetSecureCookie || secure,
        path: "/",
        expires
      });
    }

    return response;
  } catch (error) {
    console.error("[ManualLogin] erro inesperado", error);
    return NextResponse.json({ error: "Erro interno no login manual.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
