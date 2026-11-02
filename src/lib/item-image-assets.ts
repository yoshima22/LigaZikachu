const ITEM_ASSET_BASE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/render/image/public/assets/items";
// Os dois limites e `contain` preservam a proporção de artes transparentes.
const ITEM_TRANSFORM = "?width=256&height=256&resize=contain&quality=85&format=webp";

export const ABILITY_TM_IMAGE = `${ITEM_ASSET_BASE}/ability-tm-v1.webp${ITEM_TRANSFORM}`;
export const LAB_EGG_IMAGE = `${ITEM_ASSET_BASE}/lab-egg-v1.webp${ITEM_TRANSFORM}`;
export const EVENT_EGG_IMAGE = `${ITEM_ASSET_BASE}/event-egg-v1.webp${ITEM_TRANSFORM}`;
export const RAINBOW_FEATHER_POTENT_IMAGE = `${ITEM_ASSET_BASE}/rainbow-feather-potent-v1.webp${ITEM_TRANSFORM}`;
export const RAINBOW_FEATHER_IMAGE = `${ITEM_ASSET_BASE}/rainbow-feather-v1.webp${ITEM_TRANSFORM}`;
export const LUCK_CHARM_IMAGE = `${ITEM_ASSET_BASE}/luck-charm-v1.webp${ITEM_TRANSFORM}`;
export const FRESH_WATER_IMAGE = `${ITEM_ASSET_BASE}/fresh-water-v1.webp${ITEM_TRANSFORM}`;
