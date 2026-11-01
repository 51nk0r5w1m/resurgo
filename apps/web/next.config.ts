import { resolve } from "node:path";

import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@resurgo/config", "@resurgo/ui"],
  experimental: {
    // Next's CLI capture is unreliable under the local sandboxed Node runtime.
    // TypeScript 5.9 exposes the compiler API, so Next can read the same strict
    // project configuration without spawning and scraping a second CLI process.
    useTypeScriptCli: false,
  },
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
