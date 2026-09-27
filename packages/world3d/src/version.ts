// The build's stamp: build.mjs computes it (the git short sha + the UTC build time, "+" appended
// when packages/world3d had uncommitted changes; "dev" under `node build.mjs --dev`) and inlines
// it through esbuild `define` (version.d.ts types the global), and also bakes it into index.html
// (the <html> tag's data-version and the static loading card: main.js hasn't run yet) so a build
// can always be told apart, on screen or from the page source.
//
// Shown muted in a corner (page.css .build-version) on the loading card, the start flow's title
// screen and the in-game HUD; in full on the Settings screen ("Version: …", strings.ts
// "settings-version"); window.world3d.version carries it too (main.ts), for a bug report or a
// screenshot to say which build it was.
export const VERSION: string = __ST_VERSION__;

/** The muted corner tag every screen shows (page.css .build-version): just the version, no label. */
export function versionTag(): HTMLSpanElement {
  const node = document.createElement("span");
  node.className = "build-version";
  node.textContent = VERSION;
  node.setAttribute("aria-hidden", "true");
  return node;
}

/** The Settings screen's full "Version: …" line (page.css .settings-version; strings.ts "settings-version"). */
export function versionLine(s: (id: string, args?: Record<string, string | number>) => string): HTMLParagraphElement {
  const node = document.createElement("p");
  node.className = "settings-version";
  node.textContent = s("settings-version", { version: VERSION });
  return node;
}
