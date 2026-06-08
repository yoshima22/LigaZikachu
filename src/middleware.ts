import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

function getDisabledPages() {
  return (process.env.DISABLED_PAGES ?? "")
    .split(",")
    .map((page) => page.trim().replace(/^\//, ""))
    .filter(Boolean);
}

function shouldSkipPageBlock(pathname: string) {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/manutencao") ||
    /\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/.test(pathname)
  );
}

function getRootSlug(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

export default middleware((request) => {
  const { pathname } = request.nextUrl;

  // Block selected pages without consulting Supabase/Prisma.
  if (!shouldSkipPageBlock(pathname)) {
    const disabledPages = getDisabledPages();
    const currentSlug = getRootSlug(pathname);

    if (currentSlug && disabledPages.includes(currentSlug)) {
      const url = request.nextUrl.clone();
      url.pathname = "/manutencao";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Preserve: manual session fallback for protected routes.
  const protectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/jogadores") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/temporadas") ||
    pathname.startsWith("/torneios") ||
    pathname.startsWith("/admin");

  if (protectedPath && request.cookies.has("lz_session")) {
    return NextResponse.next();
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|.*\\..*).*)"],
};