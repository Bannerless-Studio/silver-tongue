import { describe, expect, it } from "vitest";
import type { RenderedLine } from "@silver-tongue/core";
import { dwellMs } from "../src/dwell";

/** A line of `words` tokens, as the controller hands them over. */
const line = (words: number): RenderedLine => ({
  text: "x".repeat(words),
  tokens: Array.from({ length: words }, (_, i) => ({ start: i, end: i + 1, word: `w${i}` })),
});

describe("dwellMs", () => {
  it("gives a line 900ms plus 300ms a word", () => {
    expect(dwellMs({ line: line(3) })).toBe(1800);
    expect(dwellMs({ line: line(9) })).toBe(3600);
  });

  it("gives narration 900ms plus 45ms a character", () => {
    expect(dwellMs({ text: "x".repeat(20) })).toBe(1800);
  });

  it("keeps a line between 1.4 and 7 seconds", () => {
    expect(dwellMs({ line: line(1) })).toBe(1400);
    expect(dwellMs({ line: line(40) })).toBe(7000);
  });

  it("lets narration run past 7 seconds, up to 16", () => {
    expect(dwellMs({ text: "x" })).toBe(1400);
    expect(dwellMs({ text: "x".repeat(200) })).toBe(9900);
    expect(dwellMs({ text: "x".repeat(400) })).toBe(16000);
  });

  it("has nothing to wait for with no text at all", () => {
    expect(dwellMs({})).toBe(1400);
  });

  it("prices a beat that carries a line by the line, and ignores its text", () => {
    expect(dwellMs({ line: line(3), text: "x".repeat(50) })).toBe(1800);
  });
});
