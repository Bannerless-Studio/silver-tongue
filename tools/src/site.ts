import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Replaces one meta's content; throws when the page doesn't have it, so a broken site never ships. */
function setMeta(html: string, name: string, from: string, to: string): string {
  const tag = `name="${name}" content="${from}"`;
  if (!html.includes(tag)) throw new Error(`page has no <meta ${tag}>`);
  return html.replace(tag, `name="${name}" content="${to}"`);
}

/** The course the Korean page (/ko/) starts on. */
export const KO_COURSE = "ko-seoul";

/**
 * The pages as the site serves them: the visual novel at /, the text game at /text/, the quiet
 * terminal at /quiet/, and the quiet terminal made for the Korean game at /ko/.
 */
export function sitePages(vnHtml: string, textHtml: string, quietHtml: string): { vn: string; text: string; quiet: string; ko: string } {
  const quiet = setMeta(setMeta(setMeta(quietHtml, "st-courses", "courses/", "../courses/"), "st-text", "", "../text/"), "st-vn", "", "../");
  return {
    vn: setMeta(setMeta(vnHtml, "st-text", "", "text/"), "st-quiet", "", "quiet/"),
    text: setMeta(setMeta(setMeta(textHtml, "st-courses", "courses/", "../courses/"), "st-vn", "", "../"), "st-quiet", "", "../quiet/"),
    quiet,
    ko: setMeta(quiet, "st-course", "", KO_COURSE),
  };
}

/** site/: the three pages and one shared courses folder, ready for GitHub Pages. */
export function buildSite(repo: string): void {
  const out = join(repo, "site");
  const vnDist = join(repo, "packages", "vn-web", "dist");
  const read = (pkg: string) => readFileSync(join(repo, "packages", pkg, "dist", "index.html"), "utf8");
  const pages = sitePages(read("vn-web"), read("tui-web"), read("quiet-web"));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "text"), { recursive: true });
  mkdirSync(join(out, "quiet"), { recursive: true });
  mkdirSync(join(out, "ko"), { recursive: true });
  writeFileSync(join(out, "index.html"), pages.vn);
  writeFileSync(join(out, "text", "index.html"), pages.text);
  writeFileSync(join(out, "quiet", "index.html"), pages.quiet);
  writeFileSync(join(out, "ko", "index.html"), pages.ko);
  cpSync(join(vnDist, "courses"), join(out, "courses"), { recursive: true });
  console.log(`site/: the visual novel at /, the text game at /text/, the quiet terminal at /quiet/, the Korean game at /ko/, courses at /courses/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildSite(resolve(fileURLToPath(new URL("../..", import.meta.url))));
