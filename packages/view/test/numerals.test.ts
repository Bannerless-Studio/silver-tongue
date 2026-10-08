import { describe, expect, it } from "vitest";
import type { RenderedLine } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { jaNumeralRomaji, rubyRow, sentenceCard } from "../src/index";

describe("Japanese numbers", () => {
  it("reads a kanji numeral as one number, with its sound changes", () => {
    const cases: Record<string, string> = {
      百五十: "hyakugojū",
      三百: "sanbyaku",
      六百: "roppyaku",
      八百: "happyaku",
      三千: "sanzen",
      八千: "hassen",
      十一: "jūichi",
      二十五: "nijūgo",
      一万: "ichiman",
      三万五千: "sanmangosen",
    };
    for (const [text, reading] of Object.entries(cases)) expect(jaNumeralRomaji(text), text).toBe(reading);
    expect(jaNumeralRomaji("十十")).toBeUndefined();
    expect(jaNumeralRomaji("円")).toBeUndefined();
  });

  it("a line reads a number written as several words as one", () => {
    const course = fixtureWithText();
    course.language = { ...course.language, code: "ja", book: true } as typeof course.language;
    const word = (id: string, w: string, romaji: string) => (course.words[id] = { id, w, lv: "1", gloss: id, readings: [romaji] });
    word("hyaku", "百", "hyaku");
    word("go", "五", "go");
    word("ju", "十", "jū");
    word("en", "円", "en");
    const text = "百五十円";
    const line: RenderedLine = { text, tokens: [...text].map((_, i) => ({ start: i, end: i + 1, word: ["hyaku", "go", "ju", "en"][i] })), meaning: "150 yen" };
    expect(sentenceCard(course, line)!.reading).toBe("hyakugojū en");
    expect(rubyRow(course, line, {}, 0, "on").map((r) => [line.text.slice(r.start, r.end), r.text])).toEqual([["百五十", "hyakugojū"], ["円", "en"]]);
  });
});
