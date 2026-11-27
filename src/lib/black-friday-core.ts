// Parte pura (sem prisma) do evento Black Friday: janela, percentuais e regras de preço. Seguro para componentes de cliente.

export const BF_KEY = "BLACK_FRIDAY_2026";
export const BF_PROMO_ID = "black-friday-2026";
export const BF_STARTS_AT = new Date("2026-11-27T00:00:00-03:00");
/** Fim: segunda 30/11 às 23:59 BRT (= 01/12 00:00). */
export const BF_ENDS_AT = new Date("2026-12-01T00:00:00-03:00");
export const BF_PACKAGE_DISCOUNT_PCT = 15;
export const BF_PACKAGE_BONUS_PCT = 10;
export const BF_MIAUVADAO_EXTRA_PCT = 5;
export const BF_PRIZE_LC = 1000;
export const BF_INVITE_IMAGE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/events/black-friday/convite.webp";

export const bfActive = (now = new Date()) => now >= BF_STARTS_AT && now < BF_ENDS_AT;

/** Preço de um pacote de LC no evento: Pix com 15% off, +10% de LC de bônus; cupons = LC do pacote (sem o bônus do evento). */
export function bfPackage(p: { base: number; bonus: number; cents: number }, now = new Date()) {
  if (!bfActive(now)) return { cents: p.cents, eventBonus: 0, savedCents: 0, tickets: p.base + p.bonus };
  const cents = Math.round(p.cents * (1 - BF_PACKAGE_DISCOUNT_PCT / 100));
  return { cents, eventBonus: Math.floor(((p.base + p.bonus) * BF_PACKAGE_BONUS_PCT) / 100), savedCents: p.cents - cents, tickets: p.base + p.bonus };
}

type OfferLike = { originalPrice: number; discountPct: number; finalPrice: number };
/** Slots do Miauvadão: +5 pontos de desconto durante o evento. */
export function bfOffer<T extends OfferLike>(offer: T, now = new Date()): T {
  if (!bfActive(now)) return offer;
  const discountPct = Math.min(95, offer.discountPct + BF_MIAUVADAO_EXTRA_PCT);
  return { ...offer, discountPct, finalPrice: Math.max(1, Math.round(offer.originalPrice * (1 - discountPct / 100))) };
}

