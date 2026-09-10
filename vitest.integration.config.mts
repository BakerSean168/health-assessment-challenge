import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  test: {
    setupFiles: ["./src/test/setup.ts"],
    environment: "node",
    include: ["src/test/integration/**/*.test.ts"],
    fileParallelism: false,
  },
});
