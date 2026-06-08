import { auth as middleware } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/manutencao",
  "/api/auth",
  "/api/site-config",
  "/api/cron",
  "/_next",
  "/static",
  "/favicon.ico",
  "/manifest.json",
];

function isPublic(path: string) {
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return true;
  if (/\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/.test(path)) return true;
  return false;
}

export default middleware(async (request) => {
  const { pathname } = request.nextUrl;

  // ── Site config block (runs before auth, skips public assets) ──
  if (!isPublic(pathname)) {
    const isAdmin =
      request.auth?.user?.role === "ADMIN" ||
      request.auth?.user?.role === "SUPER_ADMIN";
    if (!isAdmin) {
      try {
        const res = await fetch(`${request.nextUrl.origin}/api/site-config`, {
          headers: { "x-internal": "1" },
          // Short revalidation window: avoids hitting the DB on every single
          // protected navigation while still picking up config changes quickly
          // (the route itself also caches in-memory for 30s).
          next: { revalidate: 30 },
        });
        if (res.ok) {
          const config = (await res.json()) as {
            maintenanceMode?: boolean;
            disabledPages?: string[];
          };

          if (config.maintenanceMode) {
            return NextResponse.redirect(new URL("/manutencao", request.url));
          }

          const slug = pathname.split("/")[1] || "";
          if (config.disabledPages?.includes(slug)) {
            return NextResponse.redirect(new URL("/manutencao", request.url));
          }
        }
      } catch {
        // fail open on error
      }
    }
  }

  // ── Preserve: manual session fallback for protected routes ──
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

  // Return undefined so NextAuth `authorized` callback handles the rest
  return undefined;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
