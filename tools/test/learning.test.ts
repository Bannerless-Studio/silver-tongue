import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAY_MS } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { BOTS } from "../src/bots";
import { buildCourse } from "../src/build-course";
import {
  MAX_NEW_PER_EXCHANGE,
  TARGET_EXPOSURES,
  WINDOW_DAYS,
  formatReport,
  learningCheck,
  learningReport,
  learningWarnings,
  nameWords,
  stageGrammarGaps,
  thinWords,
  type LearningReport,
} from "../src/learning";
import type { Grammar } from "../src/syllabus";

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

describe("learning limits", () => {
  const course = fixtureCourse();

  it("a name is never a new word", () => {
    const all = learningReport(course, BOTS.right, { days: 2, seed: 1 });
    const words = Object.keys(all.words);
    const names = new Set(words);
    const r = learningReport(course, BOTS.right, { days: 2, seed: 1, names });
    expect(r.heavyBeats).toEqual([]);
    expect(r.linesAfterOnboarding).toBe(0); // with every word a name, onboarding never ends
  });

  it("counts a word's uses only in its first days, and only once its window has closed", () => {
    const r = learningReport(course, BOTS.right, { days: WINDOW_DAYS + 2, seed: 1, dayMs: 86_400_000 });
    for (const u of Object.values(r.words)) expect(u.windowUses).toBeLessThanOrEqual(u.heard + u.said);
    const late: LearningReport = { ...r, words: { late: { heard: 1, said: 0, contexts: 1, firstDay: r.days, lastDay: r.days, maxGapDays: 0, windowUses: 1, state: "met" } } };
    expect(thinWords(late)).toEqual([]);
    const early: LearningReport = { ...late, words: { early: { ...late.words.late, firstDay: 1 } } };
    expect(thinWords(early).map(([w]) => w)).toEqual(["early"]);
    expect(thinWords(early, new Set(["early"]))).toEqual([]);
  });

  it("warns once per limit missed, and not at all for a clean report", () => {
    const r = learningReport(course, BOTS.right, { days: 2, seed: 1 });
    const clean: LearningReport = { ...r, words: {}, heavyBeats: [], unusedStageWords: [], linesAfterOnboarding: 10, familiarAfterOnboarding: 10 };
    expect(learningWarnings(course, clean)).toEqual([]);
    const bad: LearningReport = {
      ...clean,
      days: 14, // long enough for the thin word's window to close
      heavyBeats: [{ scene: "intro", exchange: 0, newWords: ["a", "b", "c"] }],
      linesAfterOnboarding: 10,
      familiarAfterOnboarding: 5,
      unusedStageWords: ["x"],
      words: { w: { heard: 1, said: 0, contexts: 1, firstDay: 1, lastDay: 1, maxGapDays: 0, windowUses: 1, state: "met" } },
    };
    const warnings = learningWarnings(course, bad);
    expect(warnings).toHaveLength(4);
    expect(warnings.join("\n")).toContain(`more than ${MAX_NEW_PER_EXCHANGE} new words`);
    expect(warnings.join("\n")).toContain(`fewer than ${TARGET_EXPOSURES} times`);
  });

  it("grammar is due by the stage of its level", () => {
    const g: Grammar = {
      note: "",
      points: [
        { id: "one", lv: "A1", label: "one", en: "", pattern: "." },
        { id: "never", lv: "A1", label: "never", en: "", pattern: "NEVER-MATCHES" },
        { id: "later", lv: "A2", label: "later", en: "", pattern: "NEVER-MATCHES" },
        { id: "undetectable", lv: "A1", label: "undetectable", en: "" },
      ],
    };
    const gaps = stageGrammarGaps(course, g);
    expect(gaps.map((x) => x.level)).toEqual(["A1"]); // the fixture's scenes are all stage 1
    expect(gaps[0].missing.map((p) => p.id)).toEqual(["never"]);
  });
});

describe("learning limits (real content)", () => {
  it("names come from the language's word files", () => {
    expect(nameWords(CONTENT, "ko")).toEqual(new Set(["ko-minjun", "ko-jiu", "ko-bak"]));
    expect(nameWords(CONTENT, "zh").has("x0002")).toBe(true);
  });

  it("the build check runs on every course", () => {
    for (const id of ["zh-china", "ja-japan", "ko-seoul"]) {
      const { course } = buildCourse(CONTENT, id);
      for (const w of learningCheck(CONTENT, course!)) expect(typeof w).toBe("string");
    }
  }, 30_000); // three builds and three two-week runs
});
