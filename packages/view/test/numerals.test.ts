import { describe, expect, it } from "vitest";
import type { RenderedLine } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { extra, rubyRow, sentenceCard } from "../src/index";

describe("numerals written together", () => {
  const course = fixtureWithText();
  extra(course).language = { ...extra(course).language, book: true, numerals: { chars: "123", pairs: { "13": "onethree" } } };
  const word = (id: string, w: string, reading: string) => (course.words[id] = { id, w, lv: "1", gloss: id, readings: [reading] });
  word("one", "1", "one");
  word("two", "2", "two");
  word("three", "3", "three");
  word("yen", "y", "yen");
  const line = (text: string): RenderedLine => ({
    text,
    tokens: [...text].map((ch, i) => ({ start: i, end: i + 1, word: { "1": "one", "2": "two", "3": "three", y: "yen" }[ch]! })),
    meaning: "a price",
  });

  it("read as one number, then the next word", () => {
    expect(sentenceCard(course, line("12y"))!.reading).toBe("onetwo yen");
    expect(rubyRow(course, line("12y"), {}, 0, "on").map((r) => r.text)).toEqual(["onetwo", "yen"]);
  });

  it("a pair that reads its own way replaces both readings", () => {
    expect(sentenceCard(course, line("213y"))!.reading).toBe("twoonethree yen");
  });

  it("without numerals, each is read on its own", () => {
    const plain = structuredClone(course);
    delete extra(plain).language.numerals;
    expect(sentenceCard(plain, line("12y"))!.reading).toBe("one two yen");
  });
});
