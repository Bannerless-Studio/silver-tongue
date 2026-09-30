import { describe, expect, it } from "vitest";
import { foldRomanization, readingHint, readsAs, romanize } from "../src/desk";

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

describe("readingHint", () => {
  const rr = (text: string) => readingHint("", text).syllables.map((s) => s.reading);
  it("splits a line into syllables with their readings; digits and punctuation stay whole tokens", () => {
    expect(readingHint("", "김민준").syllables).toEqual([{ ch: "김", reading: "gim" }, { ch: "민", reading: "min" }, { ch: "준", reading: "jun" }]);
    expect(rr("2000년 9월")).toEqual(["2000", "nyeon", "9", "wol"]);
    expect(rr("50,000원")).toEqual(["50,000", "won"]);
  });
  it("marks the first syllable the reading goes wrong at", () => {
    expect(readingHint("gimmanjun", "김민준").firstWrong).toBe(1);
    expect(readingHint("kimminjoon", "김민준").firstWrong).toBe(2);
    expect(readingHint("xim", "김민준").firstWrong).toBe(0);
    expect(readingHint("seoulsinbun", "서울신문").firstWrong).toBe(3);
  });
  it("counts a reading that stops short as wrong where it stops", () => {
    expect(readingHint("gimmin", "김민준").firstWrong).toBe(2);
  });
  it("is -1 for a right reading, either spelling of a sound change", () => {
    expect(readingHint("gim min jun", "김민준").firstWrong).toBe(-1);
    expect(readingHint("deungnok", "등록").firstWrong).toBe(-1);
    expect(readingHint("deungrok", "등록").firstWrong).toBe(-1);
  });
  it("follows the spelling that gets furthest", () => {
    expect(readingHint("jumindeungrokjoung", "주민등록증").firstWrong).toBe(4);
    expect(readingHint("jumindeungnokjoung", "주민등록증").firstWrong).toBe(4);
  });
});
