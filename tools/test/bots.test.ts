import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { BOTS, runBot } from "../src/bots";
import { buildCourse } from "../src/build-course";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

describe("course bots (real content)", () => {
  const { course } = buildCourse(CONTENT, "zh-china-en");
  const oneOff = course!.scenes.filter((s) => !s.repeatable).map((s) => s.id);
  const reports = Object.fromEntries(Object.entries(BOTS).map(([name, bot]) => [name, runBot(course!, bot, { days: 14, seed: 7 })]));

  it("the always-right player finishes every one-off scene", () => {
    expect(Object.keys(reports.right.firstDone).sort()).toEqual([...oneOff].sort());
  });

  it("no player ever runs out of scenes to play", () => {
    for (const [name, r] of Object.entries(reports)) expect(r.deadEndDays, name).toBe(0);
  });

  it("a player with no money can always still earn some", () => {
    for (const [name, r] of Object.entries(reports)) expect(r.brokeWithoutWork, name).toBe(0);
  });

  it("every player reads the mentor's notes and meets words", () => {
    for (const [name, r] of Object.entries(reports)) {
      expect(r.notesRead, name).toBe(course!.notes.length);
      expect(r.wordsHeard, name).toBeGreaterThan(10);
    }
  });

  it("the core never refuses a bot's input", () => {
    for (const [name, r] of Object.entries(reports)) expect(r.rejected, name).toBe(0);
  });

  it("is repeatable with the same seed", () => {
    expect(runBot(course!, BOTS.learner, { days: 5, seed: 3 })).toEqual(runBot(course!, BOTS.learner, { days: 5, seed: 3 }));
  });
});

describe("course bots (a world with a home)", () => {
  it("walk home to sleep, so every day ends and nothing is refused", () => {
    const c = fixtureCourse();
    c.world.home = "street";
    for (const [name, bot] of Object.entries(BOTS)) {
      const r = runBot(c, bot, { days: 3, seed: 7 });
      expect(r.rejected, name).toBe(0);
      expect(r.firstDone.intro, name).toBe(1);
    }
  });
});
