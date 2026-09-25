import { describe, expect, it } from "vitest";
import { plain } from "../src/terminal";
import { fitLine, lineWidth, strWidth, wrapLine } from "../src/width";

describe("width", () => {
  it("counts CJK and full-width punctuation as two cells", () => {
    expect(strWidth("abc")).toBe(3);
    expect(strWidth("三杯茶。")).toBe(8);
    expect(strWidth("好，")).toBe(4);
    expect(strWidth("¥47")).toBe(3);
    expect(strWidth("é")).toBe(1);
  });

  it("fits a line to an exact width without splitting a wide character", () => {
    const fitted = fitLine([{ text: "ab" }, { text: "三杯茶" }], 5);
    expect(lineWidth(fitted)).toBe(5);
    expect(plain(fitted)).toBe("ab三 ");
    expect(plain(fitLine([{ text: "hi" }], 4))).toBe("hi  ");
  });

  it("counts emoji as wide and invisible characters as nothing", () => {
    expect(strWidth("👍")).toBe(2);
    expect(strWidth("a\u200db")).toBe(2);
    expect(strWidth("e\u0301")).toBe(1);
  });

  it("turns control characters into spaces so text can't break the layout", () => {
    expect(plain(fitLine([{ text: "a\tb\x1b[2J" }], 8))).toBe("a b [2J ");
  });

  it("wraps a line at spaces, keeping each span's style", () => {
    const out = wrapLine([{ text: "Old Wang: ", bold: true }, { text: "he says something and you answer" }], 16).map(plain);
    expect(out).toEqual(["Old Wang: he", "says something", "and you answer"]);
    expect(wrapLine([{ text: "a b", bold: true }], 10)[0][0].bold).toBe(true);
  });

  it("wraps CJK text between any two characters and splits a word longer than the line", () => {
    expect(wrapLine([{ text: "Cook: 好，三杯茶。" }], 10).map(plain)).toEqual(["Cook: 好，", "三杯茶。"]);
    expect(wrapLine([{ text: "abcdefghij" }], 4).map(plain)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("keeps an empty line as one empty line", () => {
    expect(wrapLine([], 10)).toEqual([[]]);
  });
});

