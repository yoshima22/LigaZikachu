/** @type {import('next').NextConfig} */
const nextConfig = {
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
