// Only replace these exact legacy assets; custom admin backgrounds remain intact.
// Versioned files use the site's existing immutable, one-year CDN cache policy.
const legacyBase = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/Lacos/";
const optimized: Record<string, string> = {
  [`${legacyBase}CampoDeTreinoLacos.png`]: "/refuge/CampoDeTreinoLacos-f91af7f756c4.webp",
  [`${legacyBase}DescansoLacos.png`]: "/refuge/DescansoLacos-e49ca0c9557d.webp",
  [`${legacyBase}HortaLacos.png`]: "/refuge/HortaLacos-de50a185499c.webp",
  [`${legacyBase}PatioLacos.png`]: "/refuge/PatioLacos-02c64cc16bef.webp",
};

export function refugeBackgroundUrl(value: unknown): string {
  return typeof value === "string" ? optimized[value] ?? value : "";
}
