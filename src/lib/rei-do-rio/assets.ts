// Imagens do evento publicadas no bucket público "assets" do Supabase (scripts/rei-do-rio-upload-assets.ts).
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/assets/events/rei-do-rio`;

export const REI_ASSETS = {
  banner: `${BASE}/banner.webp`, // 2000x667
  cover: `${BASE}/cover.webp`, // 1122x1402 (apresentação)
  background: `${BASE}/background.webp`, // 1536x1024
  ornaments: {
    crown: `${BASE}/ornaments/crown.webp`,
    lantern: `${BASE}/ornaments/lantern.webp`,
    gift: `${BASE}/ornaments/gift.webp`,
    baubleBall: `${BASE}/ornaments/bauble-ball.webp`,
    snowflake: `${BASE}/ornaments/snowflake.webp`, // 1254x1254, fundo transparente
  },
} as const;
