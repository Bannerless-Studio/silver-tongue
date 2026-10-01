import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAY_MS } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { BOTS } from "../src/bots";
import { buildCourse } from "../src/build-course";
import { MAX_NEW_PER_EXCHANGE, formatReport, learningReport } from "../src/learning";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

describe("learning report (fixture course)", () => {
  const course = fixtureCourse();
  const r = learningReport(course, BOTS.right, { days: 3, seed: 1 });

  it("counts every word a line used, heard or said", () => {
    const used = Object.keys(r.words);
    expect(used.length).toBeGreaterThan(0);
    for (const u of Object.values(r.words)) {
      expect(u.heard + u.said).toBeGreaterThan(0);
      expect(u.contexts).toBeGreaterThan(0);
      expect(u.lastDay).toBeGreaterThanOrEqual(u.firstDay);
    }
    expect(r.lines).toBeGreaterThan(0);
    expect(r.linesFamiliar).toBeLessThanOrEqual(r.lines);
  });

  it("the right bot says the replies' words", () => {
    expect(Object.values(r.words).some((u) => u.said > 0)).toBe(true);
  });

  it("flags only exchanges that bring in too many new words", () => {
    for (const b of r.heavyBeats) expect(b.newWords.length).toBeGreaterThan(MAX_NEW_PER_EXCHANGE);
  });

  it("is repeatable with the same seed", () => {
    expect(learningReport(course, BOTS.learner, { days: 3, seed: 2 })).toEqual(learningReport(course, BOTS.learner, { days: 3, seed: 2 }));
  });
});

describe("learning report (real content)", () => {
  for (const id of ["zh-china", "ja-japan", "ko-seoul"]) {
    it(`${id}: a two-week run uses words and formats`, () => {
      const { course } = buildCourse(CONTENT, id);
      const r = learningReport(course!, BOTS.learner, { days: 14, seed: 7, dayMs: DAY_MS });
      expect(Object.keys(r.words).length).toBeGreaterThan(10);
      expect(Object.keys(r.words).length).toBeLessThanOrEqual(r.courseWords);
      expect(formatReport(course!, r, "learner")).toContain(id);
    });
  }
});
