import { defineConfig } from "vitest/config";

export default defineConfig({
  // world3d's build.mjs inlines these through esbuild `define` (its own build only); vitest never
  // runs that build, so anything importing src/version.ts (most of its UI modules do, for the
  // corner version tag) needs the global defined here too, or it throws at import.
  define: { __ST_VERSION__: JSON.stringify("vtest"), __ST_BUILD__: JSON.stringify("vtest · 0000000 · 2026-01-01 00:00") },
  test: { include: ["packages/*/test/**/*.test.ts", "tools/test/**/*.test.ts"] },
});
