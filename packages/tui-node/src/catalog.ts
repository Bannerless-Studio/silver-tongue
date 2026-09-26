import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogEntry } from "@silver-tongue/core";

/**
 * Where the built courses are: $SILVER_TONGUE_COURSES (for tests and trying out a catalog), courses/
 * next to the bundle when installed, or the repo's dist/courses when run from source.
 */
export function coursesDir(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.SILVER_TONGUE_COURSES) return env.SILVER_TONGUE_COURSES;
  return [new URL("./courses", import.meta.url), new URL("../../../dist/courses", import.meta.url)]
    .map((u) => fileURLToPath(u))
    .find((p) => existsSync(join(p, "index.json")));
}

export function readCatalog(dir: string): CatalogEntry[] {
  return JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as CatalogEntry[];
}

/** A course's file for one reading language. */
export const courseFile = (dir: string, id: string, learner: string) => join(dir, id, `${learner}.json`);

/** Clips: audio/ beside the course when bundled; the repo's content/audio/<language> from source. */
export function clipsDir(dir: string, entry: { id: string; language: string }): string {
  const beside = join(dir, entry.id, "audio");
  const source = fileURLToPath(new URL(`../../../content/audio/${entry.language}`, import.meta.url));
  return existsSync(beside) || !existsSync(source) ? beside : source;
}
