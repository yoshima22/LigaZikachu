import type { Prisma, ShopItemType } from "@prisma/client";

export type MegaStoneConfig = {
  type: ShopItemType;
  stoneName: string;
  compatiblePokemonId: number;
  compatiblePokemonName: string;
  megaPokemonId: number;
  megaPokemonName: string;
  minLevel: number;
  price: number;
  statBonus?: number;
};

export const MEGA_STAT_BONUS = 10;
export const MEGA_MIN_LEVEL_DEFAULT = 50;
export const MEGA_STONE_PRICE = 15000;

export const MEGA_STONES: readonly MegaStoneConfig[] = [
  { type: "MEGA_STONE_ABOMASITE", stoneName: "Abomasite", compatiblePokemonId: 460, compatiblePokemonName: "Abomasnow", megaPokemonId: 10060, megaPokemonName: "Mega Abomasnow", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_ABSOLITE", stoneName: "Absolite", compatiblePokemonId: 359, compatiblePokemonName: "Absol", megaPokemonId: 10057, megaPokemonName: "Mega Absol", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_AERODACTYLITE", stoneName: "Aerodactylite", compatiblePokemonId: 142, compatiblePokemonName: "Aerodactyl", megaPokemonId: 10042, megaPokemonName: "Mega Aerodactyl", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_AGGRONITE", stoneName: "Aggronite", compatiblePokemonId: 306, compatiblePokemonName: "Aggron", megaPokemonId: 10053, megaPokemonName: "Mega Aggron", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_ALAKAZITE", stoneName: "Alakazite", compatiblePokemonId: 65, compatiblePokemonName: "Alakazam", megaPokemonId: 10037, megaPokemonName: "Mega Alakazam", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_ALTARIANITE", stoneName: "Altarianite", compatiblePokemonId: 334, compatiblePokemonName: "Altaria", megaPokemonId: 10067, megaPokemonName: "Mega Altaria", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_AMPHAROSITE", stoneName: "Ampharosite", compatiblePokemonId: 181, compatiblePokemonName: "Ampharos", megaPokemonId: 10045, megaPokemonName: "Mega Ampharos", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_AUDINITE", stoneName: "Audinite", compatiblePokemonId: 531, compatiblePokemonName: "Audino", megaPokemonId: 10069, megaPokemonName: "Mega Audino", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_BANETTITE", stoneName: "Banettite", compatiblePokemonId: 354, compatiblePokemonName: "Banette", megaPokemonId: 10056, megaPokemonName: "Mega Banette", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_BEEDRILLITE", stoneName: "Beedrillite", compatiblePokemonId: 15, compatiblePokemonName: "Beedrill", megaPokemonId: 10090, megaPokemonName: "Mega Beedrill", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_BLASTOISINITE", stoneName: "Blastoisinite", compatiblePokemonId: 9, compatiblePokemonName: "Blastoise", megaPokemonId: 10036, megaPokemonName: "Mega Blastoise", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_BLAZIKENITE", stoneName: "Blazikenite", compatiblePokemonId: 257, compatiblePokemonName: "Blaziken", megaPokemonId: 10050, megaPokemonName: "Mega Blaziken", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_CAMERUPTITE", stoneName: "Cameruptite", compatiblePokemonId: 323, compatiblePokemonName: "Camerupt", megaPokemonId: 10087, megaPokemonName: "Mega Camerupt", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_CHARIZARDITE_X", stoneName: "Charizardite X", compatiblePokemonId: 6, compatiblePokemonName: "Charizard", megaPokemonId: 10034, megaPokemonName: "Mega Charizard X", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_CHARIZARDITE_Y", stoneName: "Charizardite Y", compatiblePokemonId: 6, compatiblePokemonName: "Charizard", megaPokemonId: 10035, megaPokemonName: "Mega Charizard Y", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_DIANCITE", stoneName: "Diancite", compatiblePokemonId: 719, compatiblePokemonName: "Diancie", megaPokemonId: 10075, megaPokemonName: "Mega Diancie", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_GALLADITE", stoneName: "Galladite", compatiblePokemonId: 475, compatiblePokemonName: "Gallade", megaPokemonId: 10068, megaPokemonName: "Mega Gallade", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_GARCHOMPITE", stoneName: "Garchompite", compatiblePokemonId: 445, compatiblePokemonName: "Garchomp", megaPokemonId: 10058, megaPokemonName: "Mega Garchomp", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_GARDEVOIRITE", stoneName: "Gardevoirite", compatiblePokemonId: 282, compatiblePokemonName: "Gardevoir", megaPokemonId: 10051, megaPokemonName: "Mega Gardevoir", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_GENGARITE", stoneName: "Gengarite", compatiblePokemonId: 94, compatiblePokemonName: "Gengar", megaPokemonId: 10038, megaPokemonName: "Mega Gengar", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_GLALITITE", stoneName: "Glalitite", compatiblePokemonId: 362, compatiblePokemonName: "Glalie", megaPokemonId: 10074, megaPokemonName: "Mega Glalie", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_GYARADOSITE", stoneName: "Gyaradosite", compatiblePokemonId: 130, compatiblePokemonName: "Gyarados", megaPokemonId: 10041, megaPokemonName: "Mega Gyarados", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_HERACRONITE", stoneName: "Heracronite", compatiblePokemonId: 214, compatiblePokemonName: "Heracross", megaPokemonId: 10047, megaPokemonName: "Mega Heracross", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_HOUNDOOMINITE", stoneName: "Houndoominite", compatiblePokemonId: 229, compatiblePokemonName: "Houndoom", megaPokemonId: 10048, megaPokemonName: "Mega Houndoom", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_KANGASKHANITE", stoneName: "Kangaskhanite", compatiblePokemonId: 115, compatiblePokemonName: "Kangaskhan", megaPokemonId: 10039, megaPokemonName: "Mega Kangaskhan", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_LATIASITE", stoneName: "Latiasite", compatiblePokemonId: 380, compatiblePokemonName: "Latias", megaPokemonId: 10062, megaPokemonName: "Mega Latias", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_LATIOSITE", stoneName: "Latiosite", compatiblePokemonId: 381, compatiblePokemonName: "Latios", megaPokemonId: 10063, megaPokemonName: "Mega Latios", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_LOPUNNITE", stoneName: "Lopunnite", compatiblePokemonId: 428, compatiblePokemonName: "Lopunny", megaPokemonId: 10088, megaPokemonName: "Mega Lopunny", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_LUCARIONITE", stoneName: "Lucarionite", compatiblePokemonId: 448, compatiblePokemonName: "Lucario", megaPokemonId: 10059, megaPokemonName: "Mega Lucario", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_MANECTITE", stoneName: "Manectite", compatiblePokemonId: 310, compatiblePokemonName: "Manectric", megaPokemonId: 10055, megaPokemonName: "Mega Manectric", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_MAWILITE", stoneName: "Mawilite", compatiblePokemonId: 303, compatiblePokemonName: "Mawile", megaPokemonId: 10052, megaPokemonName: "Mega Mawile", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_MEDICHAMITE", stoneName: "Medichamite", compatiblePokemonId: 308, compatiblePokemonName: "Medicham", megaPokemonId: 10054, megaPokemonName: "Mega Medicham", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_METAGROSSITE", stoneName: "Metagrossite", compatiblePokemonId: 376, compatiblePokemonName: "Metagross", megaPokemonId: 10076, megaPokemonName: "Mega Metagross", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_MEWTWONITE_X", stoneName: "Mewtwonite X", compatiblePokemonId: 150, compatiblePokemonName: "Mewtwo", megaPokemonId: 10043, megaPokemonName: "Mega Mewtwo X", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_MEWTWONITE_Y", stoneName: "Mewtwonite Y", compatiblePokemonId: 150, compatiblePokemonName: "Mewtwo", megaPokemonId: 10044, megaPokemonName: "Mega Mewtwo Y", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_PIDGEOTITE", stoneName: "Pidgeotite", compatiblePokemonId: 18, compatiblePokemonName: "Pidgeot", megaPokemonId: 10073, megaPokemonName: "Mega Pidgeot", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_PINSIRITE", stoneName: "Pinsirite", compatiblePokemonId: 127, compatiblePokemonName: "Pinsir", megaPokemonId: 10040, megaPokemonName: "Mega Pinsir", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_RAYQUAZITE", stoneName: "Meteorito de Rayquaza", compatiblePokemonId: 384, compatiblePokemonName: "Rayquaza", megaPokemonId: 10079, megaPokemonName: "Mega Rayquaza", minLevel: 70, price: 22000, statBonus: 13 },
  { type: "MEGA_STONE_SABLENITE", stoneName: "Sablenite", compatiblePokemonId: 302, compatiblePokemonName: "Sableye", megaPokemonId: 10066, megaPokemonName: "Mega Sableye", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_SALAMENCITE", stoneName: "Salamencite", compatiblePokemonId: 373, compatiblePokemonName: "Salamence", megaPokemonId: 10089, megaPokemonName: "Mega Salamence", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_SCEPTILITE", stoneName: "Sceptilite", compatiblePokemonId: 254, compatiblePokemonName: "Sceptile", megaPokemonId: 10065, megaPokemonName: "Mega Sceptile", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_SCIZORITE", stoneName: "Scizorite", compatiblePokemonId: 212, compatiblePokemonName: "Scizor", megaPokemonId: 10046, megaPokemonName: "Mega Scizor", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_SHARPEDONITE", stoneName: "Sharpedonite", compatiblePokemonId: 319, compatiblePokemonName: "Sharpedo", megaPokemonId: 10070, megaPokemonName: "Mega Sharpedo", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_SLOWBRONITE", stoneName: "Slowbronite", compatiblePokemonId: 80, compatiblePokemonName: "Slowbro", megaPokemonId: 10071, megaPokemonName: "Mega Slowbro", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_STEELIXITE", stoneName: "Steelixite", compatiblePokemonId: 208, compatiblePokemonName: "Steelix", megaPokemonId: 10072, megaPokemonName: "Mega Steelix", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_SWAMPERTITE", stoneName: "Swampertite", compatiblePokemonId: 260, compatiblePokemonName: "Swampert", megaPokemonId: 10064, megaPokemonName: "Mega Swampert", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_TYRANITARITE", stoneName: "Tyranitarite", compatiblePokemonId: 248, compatiblePokemonName: "Tyranitar", megaPokemonId: 10049, megaPokemonName: "Mega Tyranitar", minLevel: 50, price: MEGA_STONE_PRICE },
  { type: "MEGA_STONE_VENUSAURITE", stoneName: "Venusaurite", compatiblePokemonId: 3, compatiblePokemonName: "Venusaur", megaPokemonId: 10033, megaPokemonName: "Mega Venusaur", minLevel: 50, price: MEGA_STONE_PRICE },
] as const;

export const MEGA_STONE_SHOP_ITEM_TYPES = MEGA_STONES.map((stone) => stone.type);
export const MEGA_FORM_IDS = new Set(MEGA_STONES.map((stone) => stone.megaPokemonId));

export function isMegaStoneType(type: string): type is ShopItemType {
  return MEGA_STONES.some((stone) => stone.type === type);
}

export function getMegaStoneByType(type: string) {
  return MEGA_STONES.find((stone) => stone.type === type) ?? null;
}

export function getMegaStoneForMegaPokemon(pokemonId: number) {
  return MEGA_STONES.find((stone) => stone.megaPokemonId === pokemonId) ?? null;
}

export function getMegaStoneDescription(stone: MegaStoneConfig) {
  const statBonus = stone.statBonus ?? MEGA_STAT_BONUS;
  return `${stone.stoneName}: permite que ${stone.compatiblePokemonName} Nv.${stone.minLevel}+ desperte ${stone.megaPokemonName}. Consome a pedra e concede +${statBonus} em todos os atributos.`;
}

export function buildMegaStoneMetadata(stone: MegaStoneConfig): Prisma.InputJsonObject {
  return {
    kind: "MEGA_STONE",
    compatiblePokemonId: stone.compatiblePokemonId,
    compatiblePokemonName: stone.compatiblePokemonName,
    megaPokemonId: stone.megaPokemonId,
    megaPokemonName: stone.megaPokemonName,
    minLevel: stone.minLevel,
    statBonus: stone.statBonus ?? MEGA_STAT_BONUS,
    hiddenUntilOrderEventEnds: true,
  };
}
