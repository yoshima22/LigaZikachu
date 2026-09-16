export const WORLD_AVATAR_STORAGE_BASE =
  "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/world-mode/avatars/test-kit-v1";

export const WORLD_AVATAR_CATEGORIES = [
  "body", "skin", "face", "hair", "top", "bottom", "shoes", "backpack", "headwear", "accessory",
] as const;

export type WorldAvatarCategory = (typeof WORLD_AVATAR_CATEGORIES)[number];
export type WorldAvatarSelection = Record<WorldAvatarCategory, string>;

export type WorldAvatarOption = {
  id: string;
  label: string;
  category: WorldAvatarCategory;
  color: string;
  assetFiles?: string[];
};

const option = (category: WorldAvatarCategory, id: string, label: string, color: string, assetFiles?: string[]): WorldAvatarOption => ({ category, id, label, color, assetFiles });

// Os placeholders mantêm os IDs e nomes finais. Quando o pacote oficial chegar,
// basta preencher assetFiles com os arquivos enviados ao Storage.
export const WORLD_AVATAR_OPTIONS: WorldAvatarOption[] = [
  option("body", "body-male-a", "Corpo A · kit de teste", "#ca8f63", ["wm-avatar-full-body-base-male-a-skin-03.png"]),
  option("body", "body-a", "Estrutura A", "#67e8f9"),
  option("body", "body-b", "Estrutura B", "#a78bfa"),
  option("body", "body-c", "Estrutura C", "#34d399"),
  option("body", "body-d", "Estrutura D", "#fb7185"),
  option("skin", "skin-01", "Pele 01", "#f8d3b2"),
  option("skin", "skin-02", "Pele 02", "#e6b98d"),
  option("skin", "skin-03", "Pele 03", "#ca8f63"),
  option("skin", "skin-04", "Pele 04", "#a96f48"),
  option("skin", "skin-05", "Pele 05", "#7b4d36"),
  option("skin", "skin-06", "Pele 06", "#503326"),
  option("face", "face-determined", "Determinado", "#f8fafc"),
  option("face", "face-friendly", "Amigável", "#fef3c7"),
  option("face", "face-focused", "Concentrado", "#dbeafe"),
  option("face", "face-confident", "Confiante", "#fce7f3"),
  option("hair", "hair-spiky", "Curto espetado", "#172033"),
  option("hair", "hair-wavy", "Curto ondulado", "#5b3428"),
  option("hair", "hair-parted", "Médio repartido", "#d6a84f"),
  option("hair", "hair-messy", "Médio bagunçado", "#334155"),
  option("hair", "hair-long", "Longo liso", "#111827"),
  option("hair", "hair-ponytail", "Rabo de cavalo", "#7c3aed"),
  option("hair", "hair-braids", "Tranças", "#3f2a20"),
  option("hair", "hair-curly", "Crespo volumoso", "#292524"),
  option("hair", "hair-short-brown", "Curto espetado castanho · teste", "#5b3428", ["wm-avatar-full-hair-front-short-spiky-male-brown.png"]),
  option("hair", "hair-messy-black", "Bagunçado preto · teste", "#111827", ["wm-avatar-full-hair-front-messy-male-black.png"]),
  option("hair", "hair-side-blond", "Lateral loiro · teste", "#d6a84f", ["wm-avatar-full-hair-front-side-swept-male-blond.png"]),
  option("top", "top-starter", "Camiseta iniciante", "#22d3ee"),
  option("top", "top-sport", "Camisa esportiva", "#f43f5e"),
  option("top", "top-hoodie", "Moletom de viagem", "#8b5cf6"),
  option("top", "top-jacket", "Jaqueta leve", "#0f766e"),
  option("top", "top-explorer", "Camisa explorador", "#a16207"),
  option("top", "top-veteran", "Uniforme veterano", "#1d4ed8"),
  option("top", "top-trainer-red", "Jaqueta vermelha · teste", "#dc2626", ["wm-avatar-full-top-trainer-jacket-male-red.png"]),
  option("top", "top-hoodie-white", "Moletom branco · teste", "#f8fafc", ["wm-avatar-full-top-travel-hoodie-male-white.png"]),
  option("top", "top-explorer-blue", "Explorador azul · teste", "#2563eb", ["wm-avatar-full-top-explorer-shirt-male-blue.png"]),
  option("bottom", "bottom-travel", "Calça de viagem", "#334155"),
  option("bottom", "bottom-sport", "Calça esportiva", "#1e293b"),
  option("bottom", "bottom-shorts", "Short de exploração", "#65a30d"),
  option("bottom", "bottom-cargo", "Calça cargo", "#57534e"),
  option("bottom", "bottom-cargo-black", "Cargo preta · teste", "#171717", ["wm-avatar-full-bottom-cargo-pants-male-black.png"]),
  option("bottom", "bottom-cargo-shorts", "Short cargo cáqui · teste", "#a16207", ["wm-avatar-full-bottom-cargo-shorts-male-khaki.png"]),
  option("bottom", "bottom-jeans-blue", "Jeans azul · teste", "#1d4ed8", ["wm-avatar-full-bottom-jeans-male-blue.png"]),
  option("shoes", "shoes-basic", "Tênis básico", "#f8fafc"),
  option("shoes", "shoes-sport", "Tênis esportivo", "#ef4444"),
  option("shoes", "shoes-hiking", "Botas de trilha", "#78350f"),
  option("shoes", "shoes-high-red", "Tênis alto vermelho · teste", "#dc2626", ["wm-avatar-full-shoes-high-sneakers-male-red.png"]),
  option("shoes", "shoes-sport-blue", "Tênis esportivo azul · teste", "#2563eb", ["wm-avatar-full-shoes-sport-sneakers-male-blue.png"]),
  option("shoes", "shoes-hiking-brown", "Bota marrom · teste", "#78350f", ["wm-avatar-full-shoes-hiking-boots-male-brown.png"]),
  option("backpack", "backpack-small", "Mochila pequena", "#ef4444"),
  option("backpack", "backpack-medium", "Mochila média", "#2563eb"),
  option("backpack", "backpack-expedition", "Mochila expedição", "#4d7c0f"),
  option("headwear", "headwear-none", "Sem acessório", "transparent"),
  option("headwear", "headwear-cap", "Boné", "#dc2626"),
  option("headwear", "headwear-beanie", "Gorro", "#7c3aed"),
  option("headwear", "headwear-explorer", "Chapéu explorador", "#a16207"),
  option("accessory", "accessory-none", "Sem acessório", "transparent"),
  option("accessory", "accessory-glasses", "Óculos", "#93c5fd"),
  option("accessory", "accessory-communicator", "Comunicador", "#22d3ee"),
  option("accessory", "accessory-scarf", "Cachecol", "#f97316"),
  option("accessory", "accessory-badge", "Broche da Liga", "#facc15"),
];

export const DEFAULT_WORLD_AVATAR: WorldAvatarSelection = {
  body: "body-male-a", skin: "skin-03", face: "face-determined", hair: "hair-short-brown",
  top: "top-trainer-red", bottom: "bottom-cargo-black", shoes: "shoes-high-red",
  backpack: "backpack-small", headwear: "headwear-none", accessory: "accessory-none",
};

export function normalizeWorldAvatar(value: unknown): WorldAvatarSelection {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(WORLD_AVATAR_CATEGORIES.map((category) => {
    const candidate = String(record[category] ?? "");
    const valid = WORLD_AVATAR_OPTIONS.some((entry) => entry.category === category && entry.id === candidate);
    return [category, valid ? candidate : DEFAULT_WORLD_AVATAR[category]];
  })) as WorldAvatarSelection;
}

export function worldAvatarAssetUrl(file: string) {
  return `${WORLD_AVATAR_STORAGE_BASE}/${file}`;
}
