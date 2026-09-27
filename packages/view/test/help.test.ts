import { describe, expect, it } from "vitest";
import { fixtureWithText } from "../src/testing";
import { firstTimeGloss, firstTimeWords, sentenceCard, shortGloss, wordCard } from "../src/index";

describe("help cards", () => {
  const course = fixtureWithText();
  course.words.w_ni.audio = ["c-ni"];

  it("gives a word's text, readings, gloss and clips", () => {
    expect(wordCard(course, "w_ni")).toEqual({ word: "w_ni", text: "你", readings: ["nǐ"], gloss: "you", clips: ["c-ni"] });
    expect(wordCard(course, "w_cha").readings).toEqual([]);
  });

  it("gives a sentence's meaning and the last reading of each word, only when it has a meaning", () => {
    const line = course.scenes[0].exchanges[0].variants[""].npc;
    expect(sentenceCard(course, { ...line, audio: ["c-line"] })).toEqual({ text: "你好！", reading: "nǐ hǎo", meaning: "Hello!", clips: ["c-line"] });
    expect(sentenceCard(course, { ...line, meaning: undefined })).toBeUndefined();
  });

  it("shortens a gloss to its first sense, dropping trailing asides", () => {
    expect(shortGloss("good; appropriate; proper")).toBe("good");
    expect(shortGloss("you (informal)")).toBe("you");
    expect(shortGloss("what?; something")).toBe("what?");
    expect(shortGloss("right side; right, to the right")).toBe("right side");
    expect(shortGloss("Old Wang (a name: 老 \"old\" + the surname Wang)")).toBe("Old Wang");
    expect(shortGloss("to buy")).toBe("to buy");
  });

  it("glosses words met for the first time, once each, in order, dropping every sense past the first", () => {
    const c = fixtureWithText();
    c.words.w_hao.gloss = "good; appropriate; proper";
    const line = c.scenes[0].exchanges[0].variants[""].npc; // 你好！
    expect(firstTimeWords(c, line, new Set(["w_ni", "w_hao"]))).toEqual([
      { word: "w_ni", text: "你", reading: "nǐ", gloss: "you" },
      { word: "w_hao", text: "好", reading: "hǎo", gloss: "good" }, // not "good; appropriate; proper"
    ]);
    expect(firstTimeWords(c, line, new Set(["w_hao"]))).toEqual([{ word: "w_hao", text: "好", reading: "hǎo", gloss: "good" }]);
    expect(firstTimeWords(c, line, new Set())).toEqual([]);
  });

  it("joins first-time words into one dim line, or gives none when there aren't any", () => {
    const line = course.scenes[0].exchanges[0].variants[""].npc;
    expect(firstTimeGloss(course, line, new Set(["w_ni", "w_hao"]))).toBe("你 nǐ you · 好 hǎo good");
    expect(firstTimeGloss(course, line, new Set())).toBeUndefined();
  });
});
