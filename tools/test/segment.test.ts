import { describe, expect, it } from "vitest";
import { buildLexicon, segment } from "../src/segment";

const lex = buildLexicon([
  { id: "w_bei", w: "杯", lv: "1" },
  { id: "w_beizi", w: "杯子", lv: "1" },
  { id: "w_cha", w: "茶", lv: "1" },
  { id: "w_san", w: "三", lv: "1" },
  { id: "w_hao", w: "好", lv: "1" },
]);

describe("segment", () => {
  it("takes the longest match and skips punctuation", () => {
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

  it("reports characters outside the word list", () => {
    expect(segment("三碗茶", lex).unknown).toEqual(["碗"]);
  });
});
