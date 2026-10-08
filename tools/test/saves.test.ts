import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAY_MS, parseSave, type Course } from "@silver-tongue/core";
import { BOTS, runBot } from "../src/bots";
import { buildCourse } from "../src/build-course";
import { SAVE_POINTS, type SaveSet } from "../src/saves";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));
const SAVES = fileURLToPath(new URL("./saves", import.meta.url));

// Every release's saves (npm run saves) must load into today's content and play on: a renamed scene,
// a reordered exchange or a removed word mustn't strand a player's game.
const courses = new Map<string, Course>();
const course = (id: string) => {
  if (!courses.has(id)) courses.set(id, buildCourse(CONTENT, id).course!);
  return courses.get(id)!;
};

for (const file of readdirSync(SAVES).filter((f) => f.endsWith(".json"))) {
  const set = JSON.parse(readFileSync(`${SAVES}/${file}`, "utf8")) as SaveSet;
  describe(`saves from ${file.replace(/\.json$/, "")}`, () => {
    for (const [id, saves] of Object.entries(set))
      for (const point of SAVE_POINTS) {
        it(`${id} ${point}: loads and plays on`, () => {
          expect(saves[point], `no ${point} save`).toBeDefined();
          const parsed = parseSave(saves[point], course(id));
          expect(parsed.ok ? "ok" : parsed.reason).toBe("ok");
          if (!parsed.ok) return;
          const r = runBot(course(id), BOTS.learner, { days: 3, seed: 3, dayMs: DAY_MS, from: parsed.state });
          expect(r.rejected).toBe(0);
          expect(r.days).toBe(3);
        });
      }
  });
}
