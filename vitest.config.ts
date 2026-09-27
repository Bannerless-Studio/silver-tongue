import { defineConfig } from "vitest/config";

export default defineConfig({
  // world3d's build.mjs inlines these through esbuild `define` (its own build only); vitest never
  // runs that build, so anything importing src/version.ts (most of its UI modules do, for the
  // corner version tag) needs the global defined here too, or it throws at import.
  define: { __ST_VERSION__: JSON.stringify("test") },
  test: { include: ["packages/*/test/**/*.test.ts", "tools/test/**/*.test.ts"] },
});
