import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

const hasLocalKitConfig = existsSync(path.join(process.cwd(), "kit.config.ts"));
const kitConfigModule = hasLocalKitConfig ? "./kit.config.ts" : "./kit.config.example.ts";

const nextConfig: NextConfig = {
  env: {
    KIT_CONFIG_PRESENT: hasLocalKitConfig ? "true" : "false",
  },
  turbopack: {
    resolveAlias: {
      "kit-config": kitConfigModule,
    },
  },
  webpack(config) {
    config.resolve.alias["kit-config"] = path.resolve(process.cwd(), kitConfigModule);
    return config;
  },
  outputFileTracingIncludes: {
    "/*": ["./templates/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
