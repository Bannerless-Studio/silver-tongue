// Ambient globals esbuild `define` bakes in (build.mjs) at build time; never a real global at
// runtime outside a build (vitest.config.ts `define`s them too, for the test run). Named
// apart from any .ts file: TS drops a same-named .d.ts from `include`'s wildcard, assuming it's
// that file's own declaration output (it isn't, here).
/** the corner tag, "v0.14.0" (version.ts VERSION) */
declare const __ST_VERSION__: string;
/** the full stamp, "v0.14.0 · e8dca2a · 2026-09-28 02:00" (version.ts BUILD) */
declare const __ST_BUILD__: string;
