import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RenderedLine } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { BOTS } from "../src/bots";
import { buildCourse } from "../src/build-course";
import { learningReport } from "../src/learning";
import { buildSyllabus, grammarCoverage, grammarDetector, grammarRegExp, matchSyllabus, type Grammar } from "../src/syllabus";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));
const KO_GRAMMAR = JSON.parse(readFileSync(`${CONTENT}/languages/ko/grammar.json`, "utf8")) as Grammar;

/** A line with no word tokens: only the patterns can match it. */
const text = (t: string): RenderedLine => ({ text: t, tokens: [] });

describe("grammar detectors", () => {
  const detect = grammarDetector(KO_GRAMMAR);
  const has = (line: string, id: string) => detect(text(line)).includes(id);

  it("every pattern compiles", () => {
    for (const g of KO_GRAMMAR.points) if (g.pattern) expect(() => grammarRegExp(g.pattern!), g.id).not.toThrow();
  });

  it("ids are unique and levels are the syllabus levels", () => {
    const ids = KO_GRAMMAR.points.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of KO_GRAMMAR.points) expect(["A1", "A2", "B1"]).toContain(g.lv);
  });

  it("{ㄹ} stands for any syllable with that final consonant", () => {
    const re = grammarRegExp("^{ㄹ}$");
    for (const s of ["할", "갈", "을", "릴"]) expect(re.test(s), s).toBe(true);
    for (const s of ["하", "간", "읽"]) expect(re.test(s), s).toBe(false);
    expect(() => grammarRegExp("{ㅏ}")).toThrow();
  });

  it("past tense, but not 있어요 or 겠어요", () => {
    expect(has("민준 씨는 삼월까지 냈어요.", "past")).toBe(true);
    expect(has("어제 학교에 갔어요.", "past")).toBe(true);
    expect(has("돈이 있었어요.", "past")).toBe(true);
    expect(has("돈 있어요?", "past")).toBe(false);
    expect(has("맛있겠어요.", "past")).toBe(false);
  });

  it("because -(으)니까, but not a formal question", () => {
    expect(has("비가 오니까 집에 있어요.", "because-nikka")).toBe(true);
    expect(has("학생입니까?", "because-nikka")).toBe(false);
    expect(has("어디에 갑니까?", "because-nikka")).toBe(false);
  });

  it("-기 as a noun, but not 여기가", () => {
    expect(has("요리하기가 어려워요.", "nominal-gi")).toBe(true);
    expect(has("여기가 어디예요?", "nominal-gi")).toBe(false);
  });

  it("polite present, but not the copula or -세요", () => {
    expect(has("떡볶이 먹어요!", "polite-present")).toBe(true);
    expect(has("배고파요?", "polite-present")).toBe(true);
    expect(has("사진이에요?", "polite-present")).toBe(false);
    expect(has("여기 앉으세요.", "polite-present")).toBe(false);
  });

  it("a particle is found by its word id, not its spelling", () => {
    const line: RenderedLine = { text: "이름이 뭐예요?", tokens: [{ start: 0, end: 2, word: "ko-ireum" }, { start: 2, end: 3, word: "ko-i" }] };
    expect(detect(line)).toContain("subject");
    expect(detect(text("이 사과"))).not.toContain("subject");
  });

  it("stage 1 lines use no A2 or B1 grammar", () => {
    const { course } = buildCourse(CONTENT, "ko-seoul");
    const levels = new Map(KO_GRAMMAR.points.map((g) => [g.id, g.lv]));
    for (const s of course!.scenes)
      for (const ex of s.exchanges)
        for (const v of Object.values(ex.variants))
          for (const l of [v.npc, v.reply]) for (const id of detect(l)) expect(levels.get(id), `${s.id}#${ex.id}: ${l.text} -> ${id}`).toBe("A1");
  });
});

describe("grammar coverage", () => {
  it("counts used and undetectable points per level", () => {
    const g: Grammar = {
      note: "",
      points: [
        { id: "a", lv: "A1", label: "a", en: "", pattern: "a" },
        { id: "b", lv: "A1", label: "b", en: "", pattern: "b" },
        { id: "c", lv: "A2", label: "c", en: "" },
      ],
    };
    const c = grammarCoverage(g, { a: 3 });
    expect(c.levels).toEqual([
      { level: "A1", points: 2, used: 1, undetectable: 0 },
      { level: "A2", points: 1, used: 0, undetectable: 1 },
    ]);
    expect(c.unused.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("syllabus matching", () => {
  const syllabus = buildSyllabus(
    { levels: [{ id: "A1" }, { id: "A2" }] },
    [
      { id: "s1", w: "가다", pos: "verb", lv: "A1", en: "to go", forms: ["가요", "가세요", "갔어요"] },
      { id: "s2", w: "이", pos: "det", lv: "A1", en: "this", forms: [] },
      { id: "s3", w: "이", pos: "num", lv: "A1", en: "two (Sino-Korean)", forms: [] },
      { id: "s4", w: "-에", pos: "part", lv: "A1", en: "at, to", forms: [] },
      { id: "s5", w: "회의", pos: "noun", lv: "A2", en: "meeting", forms: [] },
    ],
    "test",
    "test",
  );

  it("matches by spelling or form, strips a particle's dash, and breaks ties by gloss", () => {
    const course = fixtureCourse();
    course.words = {
      go: { id: "go", w: "가요", lv: "T1", gloss: "go", forms: { 가세요: ["gaseyo"] } },
      two: { id: "two", w: "이", lv: "T1", gloss: "two" },
      at: { id: "at", w: "에", lv: "T1", gloss: "at (place)" },
      food: { id: "food", w: "김밥", lv: "T1", gloss: "gimbap" },
    };
    const m = matchSyllabus(course, syllabus);
    expect(m.get("go")?.id).toBe("s1");
    expect(m.get("two")?.id).toBe("s3");
    expect(m.get("at")?.id).toBe("s4");
    expect(m.has("food")).toBe(false);
  });

  it("a learning report counts syllabus words per level", () => {
    const course = fixtureCourse();
    const word = Object.values(course.words)[0];
    const s = buildSyllabus({ levels: [{ id: "A1" }] }, [{ id: "x", w: word.w, pos: "", lv: "A1", en: word.gloss, forms: [] }, { id: "y", w: "없는말", pos: "", lv: "A1", en: "", forms: [] }], "t", "t");
    const r = learningReport(course, BOTS.right, { days: 3, seed: 1, syllabus: s });
    expect(r.syllabus!.levels[0].words).toBe(2);
    expect(r.syllabus!.levels[0].inCourse).toBe(1);
    expect(r.syllabus!.missing.map((m) => m.id)).toEqual(["y"]);
  });
});
