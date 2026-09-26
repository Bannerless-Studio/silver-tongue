import { describe, expect, it } from "vitest";
import { fixtureWithText } from "../src/testing";
import { sentenceCard, wordCard } from "../src/index";

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
});
