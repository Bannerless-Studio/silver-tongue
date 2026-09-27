import { describe, expect, it } from "vitest";
import { buildLexicon, segment } from "../src/segment";

const lex = buildLexicon([
  { id: "w_bei", w: "杯", lv: "1" },
  { id: "w_beizi", w: "杯子", lv: "1" },
  { id: "w_cha", w: "茶", lv: "1" },
  { id: "w_san", w: "三", lv: "1" },
  { id: "w_hao", w: "好", lv: "1" },
  { id: "w_ta", w: "他", lv: "1", alt: ["她"] },
]);

describe("segment", () => {
  it("tags words and skips punctuation", () => {
    expect(segment("好，三杯茶。", lex)).toEqual({
      tokens: [
        { start: 0, end: 1, word: "w_hao" },
        { start: 2, end: 3, word: "w_san" },
        { start: 3, end: 4, word: "w_bei" },
        { start: 4, end: 5, word: "w_cha" },
      ],
      unknown: [],
    });
    expect(segment("杯子", lex).tokens).toEqual([{ start: 0, end: 2, word: "w_beizi" }]);
  });

  it("tags alternative forms with the word's id and skips digits", () => {
    expect(segment("她3杯", lex)).toEqual({
      tokens: [
        { start: 0, end: 1, word: "w_ta" },
        { start: 2, end: 3, word: "w_bei" },
      ],
      unknown: [],
    });
  });

  it("prefers the split with fewer words over the greedy one", () => {
    const l = buildLexicon([
      { id: "yanjiu", w: "研究", lv: "1" },
      { id: "yanjiusheng", w: "研究生", lv: "1" },
      { id: "shengming", w: "生命", lv: "1" },
    ]);
    expect(segment("研究生命", l).tokens.map((t) => t.word)).toEqual(["yanjiu", "shengming"]);
  });

  it("reports characters outside the word list with their offsets, as whole code points", () => {
    expect(segment("三碗茶", lex).unknown).toEqual([{ start: 1, end: 2, char: "碗" }]);
    expect(segment("𠀀茶", lex)).toEqual({
      tokens: [{ start: 2, end: 3, word: "w_cha" }],
      unknown: [{ start: 0, end: 2, char: "𠀀" }],
    });
    expect(segment("tea茶", lex).unknown.map((u) => u.char)).toEqual(["t", "e", "a"]);
  });

  it("refuses two words with the same form", () => {
    expect(() => buildLexicon([{ id: "a", w: "行", lv: "1" }, { id: "b", w: "走", lv: "1", alt: ["行"] }])).toThrow(
      /"行" \(a, b\)/,
    );
  });
});

describe("buildLexicon with forms", () => {
  const eat = { id: "eat", w: "食べます", lv: "N5", forms: { "食べました": ["たべました", "tabemashita"] } };
  it("tags a line by a word's other forms", () => {
    const { tokens } = segment("食べました。", buildLexicon([eat]));
    expect(tokens).toEqual([{ start: 0, end: 5, word: "eat" }]);
  });
  it("refuses a spelling listed both as alt and in forms", () => {
    expect(() => buildLexicon([{ ...eat, alt: ["食べました"] }])).toThrow(/食べました.*both alt and forms/);
  });
  it("refuses a form two words share", () => {
    expect(() => buildLexicon([eat, { id: "ate", w: "食べました", lv: "N5" }])).toThrow(/"食べました" \((eat, ate|ate, eat)\)/);
  });
});
