import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],

    // Run tests sequentially: one worker, no isolation reset between files.
    // This matters when tests share a database — parallel tests would race
    // for the same rows.
    pool: "forks",
    maxWorkers: 1,
    isolate: false,

    reporters: "verbose",
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});