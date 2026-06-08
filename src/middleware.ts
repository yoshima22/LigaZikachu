import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_FILE = /\.(.*)$/;

const DISABLED_REDIRECT_PATH = "/manutencao";

const PROTECTED_PATHS = [
  "/dashboard",
  "/jogadores",
  "/perfil",
  "/temporadas",
  "/torneios",
  "/admin",
  "/arena-z",
  "/bazar",
  "/mascotes",
  "/album",
  "/zikaloot",
];

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function getDisabledPages() {
  return (process.env.DISABLED_PAGES ?? "")
    .split(",")
    .map(normalizePath)
    .filter(Boolean);
}

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function shouldSkipMiddleware(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/manifest.webmanifest") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith(DISABLED_REDIRECT_PATH) ||
    PUBLIC_FILE.test(pathname)
  );
}

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  const disabledPages = getDisabledPages();
  const isDisabledPage = disabledPages.some((disabledPath) =>
    matchesPath(pathname, disabledPath)
  );

  if (isDisabledPage) {
    const url = request.nextUrl.clone();
    url.pathname = DISABLED_REDIRECT_PATH;
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const protectedPath = PROTECTED_PATHS.some((path) =>
    matchesPath(pathname, path)
  );

  if (protectedPath && request.cookies.has("lz_session")) {
    return NextResponse.next();
  }

  return undefined;
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|.*\\..*).*)",
  ],
};