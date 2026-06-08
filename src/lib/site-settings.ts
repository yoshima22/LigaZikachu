import { prisma } from "./prisma";

const SITE_SETTINGS_CACHE_KEY = "site-settings";
let cache: { data: SiteSettings | null; at: number } | null = null;
const CACHE_TTL_MS = 5_000; // 5s in-memory cache para evitar N+1

export interface SiteSettings {
  id: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  disabledPages: string[];
  mascotBulkActionScope: "ALL" | "FAVORITES";
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS && cache.data) {
    return cache.data;
  }

  const row = await prisma.siteSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!row) {
    cache = { data: null, at: now };
    return { id: "", maintenanceMode: false, maintenanceMessage: null, disabledPages: [], mascotBulkActionScope: "ALL" };
  }

  const data: SiteSettings = {
    id: row.id,
    maintenanceMode: row.maintenanceMode,
    maintenanceMessage: row.maintenanceMessage,
    disabledPages: row.disabledPages ?? [],
    mascotBulkActionScope: (row.mascotBulkActionScope as "ALL" | "FAVORITES") ?? "ALL",
  };
  cache = { data, at: now };
  return data;
}

// Invalida cache (chamar após update)
export function invalidateSiteSettingsCache() {
  cache = null;
}

export async function checkPageEnabled(pathname: string): Promise<{
  enabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}> {
  const settings = await getSiteSettings();
  if (settings.maintenanceMode) {
    return { enabled: false, maintenanceMode: true, maintenanceMessage: settings.maintenanceMessage };
  }

  const pageSlug = pathname.split("/")[1] || "";
  if (settings.disabledPages.includes(pageSlug)) {
    return { enabled: false, maintenanceMode: false, maintenanceMessage: settings.maintenanceMessage };
  }

  return { enabled: true, maintenanceMode: false, maintenanceMessage: settings.maintenanceMessage };
}
