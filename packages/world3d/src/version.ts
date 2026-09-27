// The build's stamp: build.mjs computes it and inlines it through esbuild `define` (globals.d.ts
// types the globals), and also bakes it into index.html (the <html> tag's data-version, the full
// string; the static loading card's corner tag: main.js hasn't run yet).
//
// VERSION, the muted corner tag (page.css .build-version) on the loading card, the start flow's
// title screen and the in-game HUD: "v" + the game's version (packages/tui-node/package.json),
// "+" when packages/world3d had uncommitted changes: "v0.14.0". BUILD, the full string, on the
// Settings screen ("Version: …", strings.ts "settings-version") and window.world3d.version
// (main.ts), for a bug report to say exactly which build it was: the tag, the git short sha and
// the UTC build time, "v0.14.0 · e8dca2a · 2026-09-28 02:00". Both "dev" under
// `node build.mjs --dev`.
export const VERSION: string = __ST_VERSION__;
export const BUILD: string = __ST_BUILD__;

/** The muted corner tag every screen shows (page.css .build-version): just the version, no label. */
export function versionTag(): HTMLSpanElement {
  const node = document.createElement("span");
  node.className = "build-version";
  node.textContent = VERSION;
  node.setAttribute("aria-hidden", "true");
  return node;
}

/** The Settings screen's full "Version: …" line (BUILD) (page.css .settings-version; strings.ts "settings-version"). */
export function versionLine(s: (id: string, args?: Record<string, string | number>) => string): HTMLParagraphElement {
  const node = document.createElement("p");
  node.className = "settings-version";
  node.textContent = s("settings-version", { version: BUILD });
  return node;
}
