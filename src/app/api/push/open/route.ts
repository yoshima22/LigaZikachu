import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("to") ?? "/dashboard";
  const destination = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/dashboard";
  const response = NextResponse.redirect(new URL(destination, request.nextUrl.origin), 307);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
