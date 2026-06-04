import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware((request) => {
  const protectedPath =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/jogadores") ||
    request.nextUrl.pathname.startsWith("/perfil") ||
    request.nextUrl.pathname.startsWith("/temporadas") ||
    request.nextUrl.pathname.startsWith("/torneios") ||
    request.nextUrl.pathname.startsWith("/admin");

  if (protectedPath && request.cookies.has("lz_session")) {
    return NextResponse.next();
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|.*\\..*).*)"]
};
