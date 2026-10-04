import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Replaces one meta's content; throws when the page doesn't have it, so a broken site never ships. */
function setMeta(html: string, name: string, from: string, to: string): string {
  const tag = `name="${name}" content="${from}"`;
  if (!html.includes(tag)) throw new Error(`page has no <meta ${tag}>`);
  return html.replace(tag, `name="${name}" content="${to}"`);
}

/** The course the site starts on. */
export const KO_COURSE = "ko-seoul";

/** The one page the site serves: the quiet terminal made for the Korean game, at /. */
export function sitePage(quietHtml: string): string {
  return setMeta(quietHtml, "st-course", "", KO_COURSE);
}

/** site/: the Korean game at / and the courses folder, ready for GitHub Pages. */
export function buildSite(repo: string): void {
  const out = join(repo, "site");
  const quietDist = join(repo, "packages", "quiet-web", "dist");
  const page = sitePage(readFileSync(join(quietDist, "index.html"), "utf8"));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), page);
  cpSync(join(quietDist, "courses"), join(out, "courses"), { recursive: true });
  console.log(`site/: the Korean game at /, courses at /courses/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildSite(resolve(fileURLToPath(new URL("../..", import.meta.url))));
