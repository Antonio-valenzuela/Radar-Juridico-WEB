import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@prisma/client", "prisma"],
  async rewrites() {
    return [
      {
        source: '/documentos',
        destination: '/items',
      },
    ];
  },
};

export default nextConfig;
