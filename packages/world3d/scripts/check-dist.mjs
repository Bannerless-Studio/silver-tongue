// The build's last word on dist/ (build.mjs runs it after inlining the preloader): nothing on the
// page's start path may be an unhashed script. GitHub Pages serves every file with
// `cache-control: max-age=600`, so a browser that saw the previous build within 10 minutes still
// holds its files: a plain main.js would come from that cache and import chunks that are gone.
// Only index.html is unhashed (the preloader size-checks the rest, src/preload.js).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** a content-hashed script's name: esbuild's `[name]-[hash]` (8 base32 characters) */
const HASHED = /-[A-Z0-9]{8}\.js$/;

/**
 * The problems with `dist` (none: []): a script at dist/ or dist/chunks/ without a hash; index.html's
 * #ld-text missing, its entry not the first file listed, or a listed file not hashed, not on disk,
 * or not the size listed.
 */
export function checkDist(dist) {
  const bad = [];
  for (const dir of [dist, join(dist, "chunks")]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".js") && !HASHED.test(f)) bad.push(`${join(dir, f)}: a script without a content hash`);
  }
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const m = /<script type="application\/json" id="ld-text">(.*?)<\/script>/s.exec(html);
  if (!m) return [...bad, "index.html: no #ld-text"];
  const cfg = JSON.parse(m[1]);
  if (!cfg.files?.length || cfg.entry !== cfg.files[0][0]) bad.push(`index.html: entry ${cfg.entry} isn't the first file listed`);
  for (const [url, bytes] of cfg.files ?? []) {
    const p = join(dist, url);
    if (!HASHED.test(url)) bad.push(`${url}: listed without a content hash`);
    if (!existsSync(p)) bad.push(`${url}: listed, not in dist/`);
    else if (statSync(p).size !== bytes) bad.push(`${url}: listed at ${bytes} B, ${statSync(p).size} B on disk`);
  }
  return bad;
}
