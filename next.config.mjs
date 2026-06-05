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
