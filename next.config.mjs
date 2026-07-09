// Fuso horário do Brasil — afeta todas as datas server-side (new Date(), toLocaleString, etc.)
process.env.TZ = "America/Sao_Paulo";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TZ: "America/Sao_Paulo",
  },
  async headers() {
    return [
      {
        source: "/:path*\\.(png|jpg|jpeg|gif|webp|svg|ico|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    // Desliga o Image Optimizer do Vercel. As imagens já estão em CDNs
    // (Supabase Storage, Limitless e /sprites no CDN estático do Vercel), então
    // otimizar só somava Fast Origin Transfer + cobrança de Image Optimization.
    // Com unoptimized, o next/image carrega direto da fonte, sem passar pela origem.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/PokeAPI/sprites/**"
      },
      {
        // Supabase Storage — avatars, itens de shop, badges, sticker packs
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
