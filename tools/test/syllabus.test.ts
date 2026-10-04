import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RenderedLine } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { BOTS } from "../src/bots";
import { buildCourse } from "../src/build-course";
import { learningReport } from "../src/learning";
import { buildJlptSyllabus, buildSyllabus, csvFields, masuForms, grammarCoverage, grammarDetector, grammarRegExp, matchSyllabus, type Grammar } from "../src/syllabus";

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

  it("같이 \"like\" right after a noun, but not 같이 \"together\" on its own", () => {
    expect(has("꽃같이 예뻐요.", "like")).toBe(true);
    expect(has("같이 일해요?", "like")).toBe(false);
  });

  it("-아/어 주세요 asks for something (A1)", () => {
    expect(has("천천히 말해 주세요.", "for-someone")).toBe(true);
  });

  it("whether -(으)ㄴ지, but not a noun ending in 지 like 편지", () => {
    expect(has("어디에 있는지 몰라요.", "whether")).toBe(true);
    expect(has("뭐가 좋은지 몰라요.", "whether")).toBe(true);
    expect(has("편지 두 장 복사해 주세요.", "whether")).toBe(false);
  });

  it("a particle is found by its word id, not its spelling", () => {
    const line: RenderedLine = { text: "이름이 뭐예요?", tokens: [{ start: 0, end: 2, word: "ko-ireum" }, { start: 2, end: 3, word: "ko-i" }] };
    expect(detect(line)).toContain("subject");
    expect(detect(text("이 사과"))).not.toContain("subject");
  });

  it("a stage's lines use no grammar above its level (A1 on stage 1, up to A2 on stage 2)", () => {
    const { course } = buildCourse(CONTENT, "ko-seoul");
    const levels = new Map(KO_GRAMMAR.points.map((g) => [g.id, g.lv]));
    const allowed: Record<number, string[]> = { 1: ["A1"], 2: ["A1", "A2"] };
    for (const s of course!.scenes)
      for (const ex of s.exchanges)
        for (const v of Object.values(ex.variants))
          for (const l of [v.npc, v.reply]) for (const id of detect(l)) expect(allowed[s.stage], `${s.id}#${ex.id}: ${l.text} -> ${id}`).toContain(levels.get(id));
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

describe("Chinese and Japanese syllabus sources", () => {
  it("renames a pack's levels and keeps only the renamed ones (HSK 1/2/3 as A1/A2/B1)", () => {
    const s = buildSyllabus(
      { levels: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] },
      [{ id: "a", w: "你", lv: "1", en: "you" }, { id: "b", w: "比", lv: "2", en: "than" }, { id: "c", w: "被", lv: "4", en: "by" }],
      "t",
      "t",
      { "1": "A1", "2": "A2", "3": "B1" },
    );
    expect(s.levels).toEqual(["A1", "A2", "B1"]);
    expect(s.words.map((w) => [w.id, w.lv])).toEqual([["a", "A1"], ["b", "A2"]]);
  });

  it("reads CSV fields, quoted ones with commas and doubled quotes", () => {
    expect(csvFields(`会う,あう,"to meet, to see",JLPT`)).toEqual(["会う", "あう", "to meet, to see", "JLPT"]);
    expect(csvFields(`a,"say ""hi""",`)).toEqual(["a", `say "hi"`, ""]);
  });

  it("JLPT lists: a word keeps its easiest level, and its kana reading is a form", () => {
    const s = buildJlptSyllabus(
      [
        { level: "A1", csv: `expression,reading,meaning,tags\n鍵,かぎ,key,JLPT_N5\nはい,はい,yes,JLPT_N5\n` },
        { level: "A2", csv: `expression,reading,meaning,tags\n鍵,かぎ,key,JLPT_N4\n会議,かいぎ,meeting,JLPT_N4\n` },
      ],
      "t",
      "t",
    );
    expect(s.levels).toEqual(["A1", "A2"]);
    expect(s.words.map((w) => [w.w, w.lv, w.forms])).toEqual([["鍵", "A1", ["かぎ"]], ["はい", "A1", []], ["会議", "A2", ["かいぎ"]]]);
  });

  it("a verb's polite forms; a one-kana reading is not a form", () => {
    expect(masuForms("働く")).toContain("働きます");
    expect(masuForms("食べる")).toEqual(expect.arrayContaining(["食べます", "食べました"]));
    expect(masuForms("勉強する")).toContain("勉強します");
    expect(masuForms("鍵")).toEqual([]);
    const s = buildJlptSyllabus([{ level: "A1", csv: `e,r,m,t\n可,か,passable,x\n分かる,わかる,to understand,x\n` }], "t", "t");
    expect(s.words[0].forms).toEqual([]);
    expect(s.words[1].forms).toEqual(expect.arrayContaining(["わかる", "わかります", "分かります"]));
  });

  for (const lang of ["zh", "ja"]) {
    it(`${lang}: every grammar pattern compiles, ids are unique, levels are A1/A2/B1`, () => {
      const g = JSON.parse(readFileSync(`${CONTENT}/languages/${lang}/grammar.json`, "utf8")) as Grammar;
      for (const p of g.points) if (p.pattern) expect(() => grammarRegExp(p.pattern!), p.id).not.toThrow();
      expect(new Set(g.points.map((p) => p.id)).size).toBe(g.points.length);
      for (const p of g.points) expect(["A1", "A2", "B1"]).toContain(p.lv);
    });
  }

  it("a few Chinese and Japanese detectors on real sentences", () => {
    const zh = grammarDetector(JSON.parse(readFileSync(`${CONTENT}/languages/zh/grammar.json`, "utf8")) as Grammar);
    const ja = grammarDetector(JSON.parse(readFileSync(`${CONTENT}/languages/ja/grammar.json`, "utf8")) as Grammar);
    expect(zh(text("我把书给他了。"))).toEqual(expect.arrayContaining(["ba", "gei", "le"]));
    expect(zh(text("他比我高。"))).toContain("bi");
    expect(zh(text("你好！"))).not.toContain("ba");
    expect(ja(text("明日、行ってもいいですか。"))).toEqual(expect.arrayContaining(["te-mo-ii", "desu", "ka"]));
    expect(ja(text("日本語がわかりません。"))).toContain("masen");
  });
});
