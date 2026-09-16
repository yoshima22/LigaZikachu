export const WORLD_MODE_ASSET_BASE = (
  process.env.NEXT_PUBLIC_WORLD_MODE_ASSET_BASE_URL ??
  "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/world-mode/kanto"
).replace(/\/$/, "");

export function worldModeAsset(file: string) {
  return `${WORLD_MODE_ASSET_BASE}/${file}`;
}
