import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_FILE = /\.(.*)$/;

const DISABLED_REDIRECT_PATH = "/manutencao";
const ADMIN_MAINTENANCE_BYPASS_COOKIE = "lz_admin_maintenance";
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);
const MAINTENANCE_PUBLIC_PATHS = new Set([
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
  "/criar-conta",
]);

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

function parseDateEnv(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function appendMaintenanceParams(
  url: URL,
  state: { until?: Date | null; message?: string | null; reason?: string | null },
) {
  if (state.until) url.searchParams.set("until", state.until.toISOString());
  if (state.message) url.searchParams.set("message", state.message);
  if (state.reason) url.searchParams.set("reason", state.reason);
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function base64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signMaintenanceBypassPayload(payload: string) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64Url(signature);
}

async function hasValidManualAdminBypass(token: string | undefined) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [userId, expiresRaw, signature] = parts;
  if (!userId || !expiresRaw || !signature) return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= Date.now()) return false;

  const expected = await signMaintenanceBypassPayload(`${userId}.${expiresRaw}`);
  return Boolean(expected && constantTimeEqual(signature, expected));
}

function getMaintenanceState(now = new Date()) {
  const message = process.env.MAINTENANCE_MESSAGE?.trim() || null;
  const emergencyUntil = parseDateEnv(process.env.EMERGENCY_MAINTENANCE_UNTIL);

  if (
    process.env.EMERGENCY_MAINTENANCE === "true" &&
    (!emergencyUntil || emergencyUntil.getTime() > now.getTime())
  ) {
    return { active: true, until: emergencyUntil, message, reason: "emergency" };
  }

  const scheduledStart = parseDateEnv(process.env.MAINTENANCE_START_AT);
  const scheduledEnd = parseDateEnv(process.env.MAINTENANCE_END_AT);
  if (scheduledStart && scheduledEnd && now >= scheduledStart && now < scheduledEnd) {
    return { active: true, until: scheduledEnd, message, reason: "scheduled" };
  }

  const windows = (process.env.MAINTENANCE_WINDOWS ?? "")
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const windowSpec of windows) {
    const [startRaw, endRaw, windowMessage] = windowSpec.split("|");
    const start = parseDateEnv(startRaw);
    const end = parseDateEnv(endRaw);
    if (start && end && now >= start && now < end) {
      return {
        active: true,
        until: end,
        message: windowMessage?.trim() || message,
        reason: "window",
      };
    }
  }

  return { active: false, until: null, message: null, reason: null };
}

function shouldSkipMiddleware(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/manifest.webmanifest") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith(DISABLED_REDIRECT_PATH) ||
    PUBLIC_FILE.test(pathname)
  );
}

function isMaintenancePublicPath(pathname: string) {
  return MAINTENANCE_PUBLIC_PATHS.has(pathname) || pathname.startsWith("/recuperar-senha/");
}

export default auth(async (request) => {
  const { pathname } = request.nextUrl;

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  // Manutencao: suporta emergencia, autoabertura e janelas agendadas.
  const maintenance = getMaintenanceState();
  if (maintenance.active) {
    const role = request.auth?.user?.role;
    const isNextAuthAdmin = typeof role === "string" && ADMIN_ROLES.has(role);
    const isManualAdmin = await hasValidManualAdminBypass(
      request.cookies.get(ADMIN_MAINTENANCE_BYPASS_COOKIE)?.value,
    );

    if (isNextAuthAdmin || isManualAdmin || isMaintenancePublicPath(pathname)) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "maintenance",
          message: maintenance.message ?? "A Liga Zikachu esta temporariamente em manutencao.",
          until: maintenance.until?.toISOString() ?? null,
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Retry-After": "300",
          },
        },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = DISABLED_REDIRECT_PATH;
    appendMaintenanceParams(url, maintenance);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return response;
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
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|.*\\..*).*)",
  ],
};
