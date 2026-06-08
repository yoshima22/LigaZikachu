import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In-memory cache so middleware doesn't hit the DB on every protected
// navigation. Short TTL keeps config changes responsive while removing
// most of the load (doc05 priority: "Tirar site-config sem cache do middleware").
const CACHE_TTL_MS = 30_000;
let cached: {
  result: { maintenanceMode: boolean; maintenanceMessage: string | null; disabledPages: string[] };
  expiresAt: number;
} | null = null;

async function getSettings() {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const settings = await prisma.siteSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const result = {
    maintenanceMode: settings?.maintenanceMode ?? false,
    maintenanceMessage: settings?.maintenanceMessage ?? null,
    disabledPages: settings?.disabledPages ?? [],
  };

  cached = { result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}

export async function GET(request: Request) {
  // Validate internal call from middleware
  const internalHeader = request.headers.get("x-internal");
  const isInternal = internalHeader === "1";

  const result = await getSettings();

  if (isInternal) {
    return NextResponse.json(result, {
      headers: { "cache-control": "private, max-age=30" },
    });
  }

  // Public call to check status — minimal info
  return NextResponse.json({
    maintenanceMode: result.maintenanceMode,
    disabledPages: result.disabledPages,
  });
}
