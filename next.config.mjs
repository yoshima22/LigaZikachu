// Fuso horário do Brasil — afeta todas as datas server-side (new Date(), toLocaleString, etc.)
process.env.TZ = "America/Sao_Paulo";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TZ: "America/Sao_Paulo",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/PokeAPI/sprites/**"
      },
      {
        // Supabase Storage — avatars, itens de shop, badges, sticker packs
        // Vercel baixa 1x, otimiza e serve via CDN próprio, reduzindo egress do Supabase
        protocol: "https",
        hostname: "fwxqywivezsixamietps.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  experimental: {
    serverActions: {
      // Aumenta de 1MB (padrão) para 12MB para suportar imagens de alta resolução
      bodySizeLimit: "12mb",
    }
  }
};

export default nextConfig;
