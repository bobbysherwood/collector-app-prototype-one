import type { NextConfig } from "next";

function productionAssetPrefix(): string | undefined {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl) return undefined;
  if (vercelUrl.startsWith("http://") || vercelUrl.startsWith("https://")) {
    return vercelUrl.replace(/\/$/, "");
  }
  return `https://${vercelUrl}`;
}

const nextConfig: NextConfig = {
  // Serve hashed assets from the unique deployment host so a poisoned
  // production-alias cache/WAF rule cannot 403 `/_next/static` chunks.
  generateBuildId: async () => "20260907-js403",
  assetPrefix: productionAssetPrefix(),
  experimental: {
    serverActions: {
      bodySizeLimit: "300mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "cdn.nba.com",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
};

export default nextConfig;
