import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Replaces one meta's content; throws when the page doesn't have it, so a broken site never ships. */
function setMeta(html: string, name: string, from: string, to: string): string {
  const tag = `name="${name}" content="${from}"`;
  if (!html.includes(tag)) throw new Error(`page has no <meta ${tag}>`);
  return html.replace(tag, `name="${name}" content="${to}"`);
}

/** The two pages as the site serves them: the visual novel at /, the text game at /text/. */
export function sitePages(vnHtml: string, textHtml: string): { vn: string; text: string } {
  return {
    vn: setMeta(vnHtml, "st-text", "", "text/"),
    text: setMeta(setMeta(textHtml, "st-courses", "courses/", "../courses/"), "st-vn", "", "../"),
  };
}

/** site/: both pages and one shared courses folder, ready for GitHub Pages. */
export function buildSite(repo: string): void {
  const out = join(repo, "site");
  const vnDist = join(repo, "packages", "vn-web", "dist");
  const pages = sitePages(readFileSync(join(vnDist, "index.html"), "utf8"), readFileSync(join(repo, "packages", "tui-web", "dist", "index.html"), "utf8"));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "text"), { recursive: true });
  writeFileSync(join(out, "index.html"), pages.vn);
  writeFileSync(join(out, "text", "index.html"), pages.text);
  cpSync(join(vnDist, "courses"), join(out, "courses"), { recursive: true });
  console.log(`site/: the visual novel at /, the text game at /text/, courses at /courses/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildSite(resolve(fileURLToPath(new URL("../..", import.meta.url))));
