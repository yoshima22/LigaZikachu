import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;

function shouldSkipMiddleware(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/manutencao") ||
    pathname.startsWith("/api/auth") ||
    PUBLIC_FILE.test(pathname)
  );
}

function getDisabledPages() {
  return (process.env.DISABLED_PAGES ?? "")
    .split(",")
    .map((page) => page.trim().replace(/^\//, ""))
    .filter(Boolean);
}

function getRootSlug(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  if (process.env.EMERGENCY_MAINTENANCE === "true") {
    const url = request.nextUrl.clone();
    url.pathname = "/manutencao";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const disabledPages = getDisabledPages();
  const currentSlug = getRootSlug(pathname);

  if (currentSlug && disabledPages.includes(currentSlug)) {
    const url = request.nextUrl.clone();
    url.pathname = "/manutencao";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};