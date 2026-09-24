import { describe, expect, it } from "vitest";
import { plain } from "../src/terminal";
import { fitLine, lineWidth, strWidth } from "../src/width";

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
});
