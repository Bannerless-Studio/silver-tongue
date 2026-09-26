// Copies the built courses into dist/courses for the npm package: the catalog, each course's
// file per reading language, and each course's clips in <course>/audio/.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const from = join(repo, "dist", "courses");
const to = join(here, "dist", "courses");
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
let clips = 0;
for (const entry of JSON.parse(readFileSync(join(from, "index.json"), "utf8"))) {
  const src = join(repo, "content", "audio", entry.language);
  if (!existsSync(src)) continue;
  const out = join(to, entry.id, "audio");
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(src).filter((f) => f.endsWith(".mp3"))) {
    cpSync(join(src, f), join(out, f));
    clips++;
  }
}
console.log(`bundled ${readdirSync(to).filter((f) => f !== "index.json").join(", ")} with ${clips} clips`);
