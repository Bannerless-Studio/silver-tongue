import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The courses the site offers, in the order a first visit lists them to pick from. */
export const SITE_COURSES = ["ko-seoul", "zh-china", "ja-japan"];

/** The catalog cut down to the site's courses, in their order; throws when one is missing, so a broken site never ships. */
export function siteCatalog<T extends { id: string }>(catalog: T[]): T[] {
  return SITE_COURSES.map((id) => {
    const entry = catalog.find((c) => c.id === id);
    if (!entry) throw new Error(`catalog has no course ${id}`);
    return entry;
  });
}

/** site/: the quiet terminal at / (a first visit picks Korean, Chinese or Japanese) and those courses, ready for GitHub Pages. */
export function buildSite(repo: string): void {
  const out = join(repo, "site");
  const quietDist = join(repo, "packages", "quiet-web", "dist");
  const courses = join(quietDist, "courses");
  const catalog = siteCatalog(JSON.parse(readFileSync(join(courses, "index.json"), "utf8")) as { id: string }[]);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "courses"), { recursive: true });
  cpSync(join(quietDist, "index.html"), join(out, "index.html"));
  writeFileSync(join(out, "courses", "index.json"), JSON.stringify(catalog));
  for (const { id } of catalog) cpSync(join(courses, id), join(out, "courses", id), { recursive: true });
  console.log(`site/: the quiet terminal at /, courses ${SITE_COURSES.join(", ")} at /courses/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildSite(resolve(fileURLToPath(new URL("../..", import.meta.url))));
