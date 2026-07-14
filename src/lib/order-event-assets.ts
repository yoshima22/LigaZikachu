const ORDER_EVENT_ASSET_BASE = (process.env.NEXT_PUBLIC_ORDER_EVENT_ASSET_BASE_URL ?? "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/events/order")
  .replace(/\/$/, "");

export const ORDER_EVENT_IMAGES = {
  intro: `${ORDER_EVENT_ASSET_BASE}/ordem-da-trapaca-intro.png`,
  reward: `${ORDER_EVENT_ASSET_BASE}/ordem-da-trapaca-reward.png`,
  captain: `${ORDER_EVENT_ASSET_BASE}/ordem-da-trapaca-capitao.png`,
  captainMega: "/events/ordem-da-trapaca-capitao-mega.png",
};
