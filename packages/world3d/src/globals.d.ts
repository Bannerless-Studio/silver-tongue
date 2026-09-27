// Ambient globals esbuild `define` bakes in (build.mjs) at build time; never a real global at
// runtime outside a build (vitest.config.ts `define`s __ST_VERSION__ too, for the test run). Named
// apart from any .ts file: TS drops a same-named .d.ts from `include`'s wildcard, assuming it's
// that file's own declaration output (it isn't, here).
declare const __ST_VERSION__: string;
