import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirror the app's path aliases so tests can import modules that use them
  // (e.g. a controller importing "@shared/…"), not only alias-free leaf files.
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      server: path.resolve(import.meta.dirname, "server"),
    },
  },
  test: {
    include: ["shared/**/*.test.ts", "server/**/*.test.ts", "client/src/lib/**/*.test.ts"],
    environment: "node",
  },
});
