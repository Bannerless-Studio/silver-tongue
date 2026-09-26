// Copies the built courses (catalog, course files, art) and each course's finished clips into a
// page's dist, so the page can fetch them. Shared by the text page and the visual novel.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Replaces `out` with dist/courses plus clips; returns how many clips were copied. */
export function copyCourses(repo, out) {
  rmSync(out, { recursive: true, force: true });
  cpSync(join(repo, "dist", "courses"), out, { recursive: true });
  let clips = 0;
  for (const entry of JSON.parse(readFileSync(join(out, "index.json"), "utf8"))) {
    const src = join(repo, "content", "audio", entry.language);
    if (!existsSync(src)) continue;
    const dest = join(out, entry.id, "audio");
    mkdirSync(dest, { recursive: true });
    // Only finished clips, as the npm bundle copies (bundle-courses.mjs).
    for (const f of readdirSync(src).filter((f) => f.endsWith(".mp3"))) {
      cpSync(join(src, f), join(dest, f));
      clips++;
    }
  }
  return clips;
}
