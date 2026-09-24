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
});
