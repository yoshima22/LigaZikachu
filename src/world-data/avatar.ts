export const WORLD_AVATAR_STORAGE_BASE =
  "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/world-mode/avatars/chibi-v2";

export const WORLD_AVATAR_CATEGORIES = ["body", "hair", "top", "bottom", "shoes"] as const;

export type WorldAvatarCategory = (typeof WORLD_AVATAR_CATEGORIES)[number];
export type WorldAvatarSelection = Record<WorldAvatarCategory, string>;

export type WorldAvatarOption = {
  id: string;
  label: string;
  category: WorldAvatarCategory;
  color: string;
  assetFiles: string[];
};

const option = (
  category: WorldAvatarCategory,
  id: string,
  label: string,
  assetFile: string,
): WorldAvatarOption => ({ category, id, label, color: "transparent", assetFiles: [assetFile] });

export const WORLD_AVATAR_OPTIONS: WorldAvatarOption[] = [
  option("body", "body-chibi", "Corpo chibi", "wm-avatar-chibi-body-chibi.png"),
  option("hair", "hair-brown", "Espetado castanho", "wm-avatar-chibi-hair-brown.png"),
  option("hair", "hair-blue", "Espetado azul", "wm-avatar-chibi-hair-blue.png"),
  option("hair", "hair-blond", "Espetado loiro", "wm-avatar-chibi-hair-blond.png"),
  option("top", "top-red", "Jaqueta vermelha", "wm-avatar-chibi-top-red.png"),
  option("top", "top-white", "Jaqueta branca", "wm-avatar-chibi-top-white.png"),
  option("top", "top-black", "Jaqueta preta", "wm-avatar-chibi-top-black.png"),
  option("bottom", "bottom-cargo", "Calça cargo", "wm-avatar-chibi-bottom-cargo.png"),
  option("bottom", "bottom-jeans", "Calça jeans", "wm-avatar-chibi-bottom-jeans.png"),
  option("shoes", "shoes-red-black", "Tênis vermelho e preto", "wm-avatar-chibi-shoes-red-black.png"),
];

export const DEFAULT_WORLD_AVATAR: WorldAvatarSelection = {
  body: "body-chibi",
  hair: "hair-brown",
  top: "top-red",
  bottom: "bottom-cargo",
  shoes: "shoes-red-black",
};

export function normalizeWorldAvatar(value: unknown): WorldAvatarSelection {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(WORLD_AVATAR_CATEGORIES.map((category) => {
    const candidate = String(record[category] ?? "");
    const valid = WORLD_AVATAR_OPTIONS.some((entry) => entry.category === category && entry.id === candidate);
    return [category, valid ? candidate : DEFAULT_WORLD_AVATAR[category]];
  })) as WorldAvatarSelection;
}

export function worldAvatarAssetUrl(file: string) {
  return `${WORLD_AVATAR_STORAGE_BASE}/${file}`;
}
