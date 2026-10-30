import { resolve } from "node:path";

import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@resurgo/config", "@resurgo/ui"],
  turbopack: {
    root: resolve(import.meta.dirname, "../.."),
  },
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: "/(.*)",
      },
    ];
  },
};

export default nextConfig;
