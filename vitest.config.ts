import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "kit-config": path.resolve(__dirname, "kit.config.example.ts"),
      "server-only": path.resolve(__dirname, "__tests__/helpers/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    clearMocks: true,
    restoreMocks: true,
  },
});
