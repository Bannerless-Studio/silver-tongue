import { describe, expect, it } from "vitest";
import type { Course, RenderedLine } from "@silver-tongue/core";
import { foldRomanization, readsAs, romanize, soundedTokens } from "../src/desk";
import type { CourseExtra } from "../src/course-extra";

describe("romanize", () => {
  it.each([
    ["주민등록증", "jumindeungnokjeung"],
    ["김민준", "gimminjun"],
    ["760314", "760314"],
    ["서울신문", "seoulsinmun"],
    ["2000년 9월 30일", "2000nyeon 9wol 30il"],
    ["월세 고지서", "wolse gojiseo"],
    ["50,000원", "50,000won"],
    ["한국어", "hangugeo"],
    ["합니다", "hamnida"],
    ["신라", "silla"],
    ["종로", "jongno"],
    ["설날", "seollal"],
    ["좋아", "joa"],
  ])("%s → %s", (ko, rr) => expect(romanize(ko)).toBe(rr));

  it("plain spells each syllable on its own", () => expect(romanize("주민등록증", true)).toBe("jumindeungrokjeung"));
});

describe("readsAs", () => {
  it.each([
    ["kim min jun", "김민준"],
    ["gimminjun", "김민준"],
    ["Kim Minjun", "김민준"],
    ["Kim Min-jun", "김민준"],
    ["jumin deungnok jeung", "주민등록증"],
    ["jumin deungrok jeung", "주민등록증"],
    ["chumin tungnok chung", "주민등록증"],
    ["760314", "760314"],
    ["seoul sinmun", "서울신문"],
    ["seoul shinmun", "서울신문"],
    ["Soul Sinmun", "서울신문"],
    ["2000nyeon 9wol 30il", "2000년 9월 30일"],
    ["2000 nyon 9 wol 30 il", "2000년 9월 30일"],
    ["wolse gojiseo", "월세 고지서"],
    ["wolse kojiso", "월세 고지서"],
    ["50,000won", "50,000원"],
    ["50000 won", "50,000원"],
  ])("%s reads as %s", (typed, ko) => expect(readsAs(typed, ko)).toBe(true));

  it.each([
    ["", "김민준"],
    ["kim", "김민준"],
    ["minjun kim", "김민준"],
    ["seoul", "서울신문"],
    ["5000 won", "50,000원"],
    ["760315", "760314"],
    ["jumindeungnok", "주민등록증"],
  ])("%s does not read as %s", (typed, ko) => expect(readsAs(typed, ko)).toBe(false));

  it("folds spelling variants", () => {
    expect(foldRomanization("Seo-ul")).toBe(foldRomanization("soul"));
    expect(foldRomanization("kkachi")).toBe(foldRomanization("gaji"));
  });
});

describe("soundedTokens", () => {
  const course = { language: { book: true }, papers: [{ id: "idcard", kind: "card", lines: [{ id: "name", text: "김민준" }] }] } as unknown as Course & CourseExtra;
  const line = { text: "민준 씨?", tokens: [{ word: "a", start: 0, end: 2 }, { word: "b", start: 3, end: 4 }] } as unknown as RenderedLine;

  it("marks a word whose text is inside a line of a paper already read", () => {
    expect([...soundedTokens(course, new Set(["idcard"]), line)]).toEqual([0]);
  });
  it("marks nothing before the paper is read", () => {
    expect(soundedTokens(course, new Set(), line).size).toBe(0);
  });
  it("ignores one-syllable words, which turn up inside other words by chance", () => {
    const one = { text: "준", tokens: [{ word: "c", start: 0, end: 1 }] } as unknown as RenderedLine;
    expect(soundedTokens(course, new Set(["idcard"]), one).size).toBe(0);
  });
});
