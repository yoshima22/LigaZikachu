// Content-addressed public Storage URLs. Never overwrite these objects.
const BASE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/site-themes/";
export const SITE_LOGO_URL = `${BASE}logo-logo-12b7c35d5be9.webp`;
export const THEME_ART = {
  alakazam: { thumbnail: `${BASE}alakazam-thumbnail-daf4f5f4b35d.webp` },
  mewtwo: { thumbnail: `${BASE}mewtwo-thumbnail-340533d627ce.webp` },
  sudowoodo: { thumbnail: `${BASE}sudowoodo-thumbnail-de157a1b4194.webp` },
} as const;
