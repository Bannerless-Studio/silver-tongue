import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAY_MS, serialize, type CatalogEntry, type Course } from "@silver-tongue/core";
import { BOTS, runBot } from "./bots";

/**
 * Saves made with a release's content, kept in tools/test/saves/<version>.json so that a later
 * content change can't strand a player's game: tools/test/saves.test.ts loads each into the current
 * content and plays on. Made at every release (see CLAUDE.md), from the built courses in `dist`.
 */

/** The moments a save is taken: mid-conversation on day 1, two nights in, a week in. */
export const SAVE_POINTS = ["mid-scene", "night-2", "night-7"] as const;

/** course id -> save point -> the save as the game writes it */
export type SaveSet = Record<string, Record<string, string>>;

/** Plays the learner bot through a course and keeps the game at each of SAVE_POINTS. */
export function savesOf(course: Course): Record<string, string> {
  const out: Record<string, string> = {};
  runBot(course, BOTS.learner, {
    days: 7,
    seed: 7,
    dayMs: DAY_MS,
    observe: ({ events, after }) => {
      if (!out["mid-scene"] && after.run && after.run.exchange > 0) out["mid-scene"] = serialize(after);
      if (events.some((e) => e.type === "dayEnded")) {
        if (after.day === 3) out["night-2"] = serialize(after);
        if (after.day === 8) out["night-7"] = serialize(after);
      }
    },
  });
  return out;
}

/** npm run saves -- <version> [dist dir]: writes tools/test/saves/<version>.json from the built courses. */
function main(): void {
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const [version, distArg] = process.argv.slice(2);
  if (!version) throw new Error("usage: npm run saves -- <version> [dist/courses dir]");
  const dist = resolve(distArg ?? join(repo, "dist", "courses"));
  const catalog = JSON.parse(readFileSync(join(dist, "index.json"), "utf8")) as CatalogEntry[];
  const set: SaveSet = {};
  for (const entry of catalog) {
    const course = JSON.parse(readFileSync(join(dist, entry.id, `${entry.learners[0]}.json`), "utf8")) as Course;
    set[entry.id] = savesOf(course);
  }
  const dir = join(repo, "tools", "test", "saves");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${version}.json`), JSON.stringify(set, null, 1) + "\n");
  console.log(`saves: tools/test/saves/${version}.json (${Object.keys(set).join(", ")})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
