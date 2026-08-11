import { prisma } from "@/lib/prisma";
import { getMascotRarity, RARITY_LABEL } from "@/lib/mascot-data";
import { getHatchedEggLabel } from "@/lib/egg-origin";
import { publishLeagueTicker } from "@/lib/league-ticker";

export const PREMIUM_LISTING_FEE = 100;
export const PREMIUM_LISTING_HOURS = 6;
export const MAX_ACTIVE_PREMIUM_LISTINGS = 6;

type Payload = Record<string, unknown>;

function listingName(payload: Payload) {
  const original = String(payload.pokemonName ?? payload.displayName ?? payload.itemType ?? "oferta").trim();
  const nickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  return nickname && nickname.localeCompare(original, "pt-BR", { sensitivity: "base" }) !== 0
    ? `${original} (${nickname})`
    : original;
}

function sameProduct(a: Payload, b: Payload, category: string) {
  return category === "MASCOT"
    ? Number(a.pokemonId) === Number(b.pokemonId)
    : String(a.shopItemId ?? a.itemType) === String(b.shopItemId ?? b.itemType);
}

const STAT_LABELS: Array<[string, string]> = [
  ["force", "Força"],
  ["agility", "Agilidade"],
  ["charisma", "Carisma"],
  ["instinct", "Instinto"],
  ["vitality", "Vitalidade"],
];

async function buildPremiumMessage(listing: {
  id: string;
  category: string;
  payload: unknown;
  priceCoins: number | null;
  player: { displayName: string };
}) {
  const payload = (listing.payload ?? {}) as Payload;
  const name = listingName(payload);
  const activePeers = await prisma.bazarListing.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: new Date() }, id: { not: listing.id }, category: listing.category as never },
    select: { payload: true, priceCoins: true },
  });
  const same = activePeers.filter((peer) => sameProduct(payload, peer.payload as Payload, listing.category));
  const messages: string[] = [];
  const owner = listing.player.displayName;

  if (listing.priceCoins && same.every((peer) => !peer.priceCoins || listing.priceCoins! <= peer.priceCoins)) {
    messages.push(`${owner} colocou ${name} em destaque: é o menor preço entre as ofertas ativas desse produto. Vale conferir antes que suma!`);
  }

  if (listing.category === "MASCOT") {
    const stats = (payload.stats ?? {}) as Record<string, unknown>;
    const peerStats = activePeers.map((peer) => ((peer.payload as Payload).stats ?? {}) as Record<string, unknown>);
    for (const [key, label] of STAT_LABELS) {
      const value = Number(stats[key] ?? 0);
      if (value > 0 && peerStats.length > 0 && peerStats.every((candidate) => value >= Number(candidate[key] ?? 0))) {
        messages.push(`${name}, de ${owner}, tem a maior ${label} entre os mascotes anunciados agora. O Miauvadão separou essa oferta nos destaques!`);
        break;
      }
    }

    const pokemonId = Number(payload.pokemonId);
    const rarity = getMascotRarity(pokemonId);
    const rarityLabel = RARITY_LABEL[rarity] ?? "Comum";
    if (rarity !== "COMMON") {
      messages.push(`${owner} destacou ${name}, um mascote ${rarityLabel.toLowerCase()} e bem menos comum de aparecer nos ovos. Dê uma olhada no anúncio!`);
    }
    const origin = getHatchedEggLabel(
      payload.hatchedFromEggType as string | null,
      payload.hatchedFromEggOrigin as string | null,
    );
    if (origin) messages.push(`${name}, de ${owner}, nasceu de ${origin}. O anúncio premium está brilhando no Bazar para quem quiser analisar a oferta.`);
    if (payload.isShiny === true) messages.push(`Alerta brilhante: ${owner} colocou o shiny ${name} nos destaques do Miauvadão. Essa oferta merece uma visita!`);
  } else {
    const quantity = Math.max(1, Number(payload.quantity ?? 1));
    messages.push(`${owner} reservou uma vitrine premium para ${quantity > 1 ? `${quantity}x ` : ""}${name}. Passe no Bazar e confira os detalhes da oferta!`);
  }

  messages.push(
    `${owner} fez negócio com o Miauvadão e colocou ${name} na vitrine premium. A oferta fica em destaque por tempo limitado!`,
    `O Professor Enguiça avisa: ${name}, anunciado por ${owner}, está entre os destaques atuais do Bazar. Confira preço, origem e detalhes!`,
  );
  return messages[Math.floor(Math.random() * messages.length)];
}

/** Publica no máximo um chamariz global a cada janela aleatória de 30–55 minutos. */
export async function publishDuePremiumBazarTicker() {
  const now = new Date();
  await prisma.miauvadaoConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  const config = await prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } });
  if (config?.premiumTickerNextAt && config.premiumTickerNextAt > now) return { published: false, reason: "waiting" as const };

  const listings = await prisma.bazarListing.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now }, premiumUntil: { gt: now } },
    include: { player: { select: { displayName: true } } },
    orderBy: { premiumUntil: "asc" },
    take: MAX_ACTIVE_PREMIUM_LISTINGS,
  });
  if (!listings.length) {
    await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: { premiumTickerNextAt: null, premiumTickerLastListingId: null },
    });
    return { published: false, reason: "empty" as const };
  }

  const delayMinutes = 30 + Math.floor(Math.random() * 26);
  const nextAt = new Date(now.getTime() + delayMinutes * 60_000);
  const claim = await prisma.miauvadaoConfig.updateMany({
    where: { id: "singleton", OR: [{ premiumTickerNextAt: null }, { premiumTickerNextAt: { lte: now } }] },
    data: { premiumTickerNextAt: nextAt },
  });
  if (!claim.count) return { published: false, reason: "claimed" as const };

  const alternatives = listings.filter((item) => item.id !== config?.premiumTickerLastListingId);
  const pool = alternatives.length ? alternatives : listings;
  const listing = pool[Math.floor(Math.random() * pool.length)];
  const message = await buildPremiumMessage(listing);
  const published = await publishLeagueTicker({
    type: "BAZAR_PREMIUM_LISTING",
    message,
    href: `/bazar/${listing.id}`,
    eventKey: `bazar-premium:${listing.id}:${now.toISOString().slice(0, 16)}`,
    priority: 9,
    ttlHours: 2,
  });
  await prisma.miauvadaoConfig.update({
    where: { id: "singleton" },
    data: { premiumTickerLastListingId: listing.id },
  });
  return { published, nextAt };
}
