import { describe, expect, it } from "vitest";
import type { Course } from "@silver-tongue/core";
import { readFileSync } from "node:fs";
import { fixtureWithText } from "../src/testing";
import {
  emptyProgress, guideView, letterChart, letterCount, letterKey, lettersFollowDesk, lettersView, lineRead, metLetters, paperSyllables,
  parseProgress, readsSyllable, sumTiles, syllableLetters, textLetterKeys, type CourseExtra, type DeskPaper, type LetterGroup,
} from "../src/index";

const letters = JSON.parse(readFileSync(new URL("../../../content/languages/ko/letters.json", import.meta.url), "utf8")) as { groups: LetterGroup[]; guide: { id: string; examples?: string[] }[] };
const chart = letters.groups;
const ch = (s: string) => syllableLetters(chart, s).map((r) => r.letter.ch + (r.group === "finals" ? "_" : ""));

const PAPERS: DeskPaper[] = [
  { id: "idcard", kind: "card", lines: [{ id: "title", text: "주민등록증" }, { id: "name", text: "김민준" }, { id: "born", text: "760314" }] },
  { id: "news", kind: "masthead", lines: [{ id: "date", text: "2000년 9월" }] },
];
const course = (): Course => {
  const c = structuredClone(fixtureWithText()) as unknown as CourseExtra;
  c.language = { ...c.language, book: true };
  c.papers = structuredClone(PAPERS);
  c.letters = { groups: chart, guide: letters.guide } as CourseExtra["letters"];
  return c as unknown as Course;
};

describe("syllableLetters", () => {
  it("takes a block apart into initial, vowel and final, in reading order", () => {
    expect(ch("김")).toEqual(["ㄱ", "ㅣ", "ㅁ_"]);
    expect(ch("이")).toEqual(["ㅇ", "ㅣ"]);
  });
  it("keeps a vowel or double consonant the chart lists as its own letter as one", () => {
    expect(ch("원")).toEqual(["ㅇ", "ㅝ", "ㄴ_"]);
    expect(ch("까")).toEqual(["ㄲ", "ㅏ"]);
  });
  it("a final the chart lacks falls back to the consonant; a compound final it doesn't list splits in two", () => {
    expect(ch("있")).toEqual(["ㅇ", "ㅣ", "ㅆ"]);
    expect(ch("없")).toEqual(["ㅇ", "ㅓ", "ㅂ_", "ㅅ"]);
  });
  it("splits letters the chart doesn't list", () => {
    const bare = chart.map((g) => ({ ...g, letters: g.letters.filter((l) => !["ㅝ", "ㄲ"].includes(l.ch)) }));
    expect(syllableLetters(bare, "원").map((r) => r.letter.ch)).toEqual(["ㅇ", "ㅜ", "ㅓ", "ㄴ"]);
    expect(syllableLetters(bare, "까").map((r) => r.letter.ch)).toEqual(["ㄱ", "ㅏ"]);
  });
  it("is empty for anything that isn't a block", () => {
    expect(ch("7")).toEqual([]);
    expect(ch(",")).toEqual([]);
  });
});

describe("reading a paper", () => {
  it("asks only syllables: digits, spaces and punctuation pass through, a line of digits is skipped", () => {
    const s = paperSyllables(PAPERS[0]);
    expect(s.map((x) => x.ch).join("")).toBe("주민등록증김민준");
    expect(s.every((x) => x.line < 2)).toBe(true);
    expect(paperSyllables(PAPERS[1]).map((x) => x.ch)).toEqual(["년", "월"]);
  });
  it("a line is read once all its syllables are; a line with none never is", () => {
    const s = paperSyllables(PAPERS[0]);
    expect(lineRead(s, 0, 4)).toBe(false);
    expect(lineRead(s, 0, 5)).toBe(true);
    expect(lineRead(s, 1, 7)).toBe(false);
    expect(lineRead(s, 1, 8)).toBe(true);
    expect(lineRead(s, 2, 99)).toBe(false);
  });
  it("checks a syllable's own reading: fold leniency and both spellings of a two-sound letter", () => {
    expect(readsSyllable("gim", "김")).toBe(true);
    expect(readsSyllable("Kim", "김")).toBe(true);
    expect(readsSyllable("gin", "김")).toBe(false);
    expect(readsSyllable("", "김")).toBe(false);
    expect(readsSyllable("a", "7")).toBe(false);
    expect(readsSyllable("min", "민")).toBe(true);
    expect(readsSyllable("ryeok", "력")).toBe(true);
    expect(readsSyllable("lyeok", "력")).toBe(true);
  });
});

describe("sumTiles", () => {
  it("a block's own letters in reading order, each with its sound there", () => {
    const t = sumTiles(chart, "김", new Set());
    expect(t.map((x) => [x.letter.ch, x.sound, x.fresh, x.final])).toEqual([["ㄱ", "g", true, false], ["ㅣ", "i", true, false], ["ㅁ", "m", true, true]]);
  });
  it("a letter with two sounds shows the one the block reads with, by where it stands", () => {
    expect(sumTiles(chart, "각", new Set()).map((x) => x.sound)).toEqual(["g", "a", "k"]);
    expect(sumTiles(chart, "갈", new Set()).map((x) => x.sound)).toEqual(["g", "a", "l"]);
  });
  it("letters met before are not fresh; a letter met only as a final is new as an initial", () => {
    const before = new Set(textLetterKeys(chart, "김"));
    expect(sumTiles(chart, "민", before).map((x) => [x.letter.ch, x.fresh])).toEqual([["ㅁ", true], ["ㅣ", false], ["ㄴ", true]]);
  });
  it("never hides a letter, however many were met", () => {
    const before = new Set(textLetterKeys(chart, "주민등록증서울신문"));
    expect(sumTiles(chart, "월", before)).toHaveLength(3);
  });
});

describe("the Book follows the desk", () => {
  it("knows whether the letters follow the desk", () => {
    expect(lettersFollowDesk(course())).toBe(true);
    const c = course() as unknown as CourseExtra;
    c.papers = [];
    expect(lettersFollowDesk(c as unknown as Course)).toBe(false);
    expect(letterChart(c as unknown as Course).length).toBeGreaterThan(0);
  });
  it("met letters: stored ones, plus every letter of a paper already read", () => {
    const c = course();
    expect([...metLetters(c, emptyProgress(), new Set())]).toEqual([]);
    expect(metLetters(c, { at: {}, met: ["vowels:ㅣ"] }, new Set()).has("vowels:ㅣ")).toBe(true);
    const read = metLetters(c, emptyProgress(), new Set(["news"]));
    expect(read.has(letterKey("vowels", "ㅕ"))).toBe(true);
    expect(read.has(letterKey("vowels", "ㅣ"))).toBe(false);
  });
  it("counts and filters the chart; groups with none are hidden", () => {
    const c = course();
    const met = new Set([letterKey("consonants", "ㄱ"), letterKey("vowels", "ㅣ")]);
    expect(letterCount(c, met)).toEqual({ n: 2, total: chart.flatMap((g) => g.letters).length });
    const tf = ((k: string) => k) as never;
    (tf as { has: (k: string) => boolean }).has = () => false;
    expect(lettersView(c, tf, met).map((g) => [g.id, g.letters.length])).toEqual([["consonants", 1], ["vowels", 1]]);
    expect(lettersView(c, tf, new Set())).toEqual([]);
    expect(lettersView(c, tf).length).toBe(chart.length);
  });
  it("shows a guide step only with an example made of met letters, and only those examples", () => {
    const c = course();
    const tf = ((k: string) => k) as never;
    expect(guideView(c, tf, new Set())).toEqual([]);
    const met = new Set(textLetterKeys(chart, "김민준"));
    const g = guideView(c, tf, met);
    expect(g.map((s) => s.id)).toEqual(["blocks"]);
    expect(g[0].examples.map((e) => e.text)).toEqual(["김", "민", "준"]);
    const more = guideView(c, tf, new Set([...met, ...textLetterKeys(chart, "이월")]));
    expect(more.find((s) => s.id === "silent")!.examples.map((e) => e.text)).toEqual(["이", "월", "울"]); // 울 is made of letters met in 준 and 월
    expect(guideView(c, tf).length).toBe(letters.guide.length);
  });
});

describe("progress", () => {
  it("keeps what is well-formed and forgets the rest", () => {
    expect(parseProgress({ at: { a: 2, b: -1, c: "x" }, met: ["k", 3] })).toEqual({ at: { a: 2 }, met: ["k"] });
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress("x")).toEqual(emptyProgress());
  });
});
