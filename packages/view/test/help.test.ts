import { describe, expect, it } from "vitest";
import { newGame, PLAYER_MARK, type WordRecord } from "@silver-tongue/core";
import { formsCourse, line } from "@silver-tongue/core/testing";
import { fixtureWithText, spacedWithText } from "../src/testing";
import { firstTimeGloss, firstTimeWords, readingRow, sentenceCard, shortGloss, wordCard, wordExample } from "../src/index";

describe("help cards", () => {
  const course = fixtureWithText();
  course.words.w_ni.audio = ["c-ni"];

  it("gives a word's text, readings, gloss and clips", () => {
    expect(wordCard(course, "w_ni")).toEqual({ word: "w_ni", text: "你", readings: ["nǐ"], gloss: "you", clips: ["c-ni"] });
    expect(wordCard(course, "w_cha").readings).toEqual([]);
  });

  it("gives the shortest other line with a meaning that uses the word, as an example", () => {
    expect(wordExample(course, "w_ni")).toMatchObject({ text: "你好！", reading: "nǐ hǎo", meaning: "Hello!" });
    expect(wordExample(course, "w_ni", "你好！")).toBeUndefined(); // the line on screen is no example
    expect(wordExample(course, "w_cha")).toBeUndefined(); // its lines have no meaning written
    const c = structuredClone(course);
    const shift = c.scenes.find((s) => s.id === "shift")!.exchanges[0].variants;
    const [a, b] = Object.values(shift);
    a.reply = { ...a.reply, meaning: "Fine, three cups." };
    b.npc = { ...b.npc, meaning: "Three cups of water." };
    expect(wordExample(c, "w_san")?.meaning).toBe("Three cups of water.");
    b.npc = { ...b.npc, text: `${PLAYER_MARK}${b.npc.text}` };
    expect(wordExample(c, "w_san")?.meaning).toBe("Fine, three cups."); // lines with the player's name are left out
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

  it("only treats a sense as a pure aside when its own parens wrap the whole thing (depth-aware)", () => {
    // The leading "(a)" closes before the sense ends, so it isn't a single wrap: real content ("b")
    // outside it survives, instead of the old bug's "a) b (c" (stripping just the outer chars).
    expect(shortGloss("(a) b (c)")).toBe("b");
    // Doesn't end in ")", so it was never a candidate for isPureAside either way.
    expect(shortGloss("(V+好) done")).toBe("done");
    // Nested parens: dropAsides itself doesn't unwrap nesting, a separate, pre-existing limitation;
    // this only checks isPureAside doesn't wrongly swallow the whole sense as one aside.
    expect(shortGloss("((a)) b")).toBe(") b");
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

describe("other forms of a word", () => {
  const c = formsCourse();
  const [id, word] = Object.entries(c.words).find(([, w]) => w.forms)!;
  const [form, formReadings] = Object.entries(word.forms!)[0];
  const lineWith = (text: string) => ({ text, tokens: [{ start: 0, end: text.length, word: id }], meaning: "m" });

  it("sentence help reads the form that is in the line", () => {
    expect(sentenceCard(c, lineWith(form))!.reading).toBe(formReadings.at(-1));
    expect(sentenceCard(c, lineWith(word.w))!.reading).toBe(word.readings!.at(-1));
  });

  it("first-time glosses read the form that is in the line", () => {
    expect(firstTimeWords(c, lineWith(form), new Set([id]))[0].reading).toBe(formReadings.at(-1));
  });

  it("the word card shows the form, its readings and the dictionary form", () => {
    expect(wordCard(c, id, form)).toMatchObject({ text: form, readings: formReadings, base: word.w });
    expect(wordCard(c, id, word.w)).toMatchObject({ text: word.w, readings: word.readings });
    expect(wordCard(c, id, word.w).base).toBeUndefined();
    expect(wordCard(c, id).base).toBeUndefined();
  });

  it("the word card of a form plays no clip, since the word's clip says the dictionary form", () => {
    const withAudio = { ...c, words: { ...c.words, [id]: { ...word, audio: ["clip-of-w"] } } };
    expect(wordCard(withAudio, id, form).clips).toEqual([]);
    expect(wordCard(withAudio, id, word.w).clips).toEqual(["clip-of-w"]);
  });

  it("the reading row under a line reads the form that is in the line", () => {
    expect(readingRow(c, newGame(c), lineWith(form), 0)).toBe(formReadings.at(-1));
  });

  it("keeps the reading row for a known word written in a form, drops it for the word itself", () => {
    const state = newGame(c);
    state.words = { [id]: { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 } };
    expect(readingRow(c, state, lineWith(form), 0)).toBe(formReadings.at(-1));
    expect(readingRow(c, state, lineWith(word.w), 0)).toBeUndefined();
  });
});

describe("reading row", () => {
  const course = fixtureWithText();
  const known: WordRecord = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 };
  const said = line(["你", "w_ni"], ["好", "w_hao"], ["！", null]);

  it("gives the line's reading while any word in it isn't known", () => {
    const state = newGame(course);
    state.words = { w_ni: { ...known } };
    expect(readingRow(course, state, said, 0)).toBe("nǐ hǎo");
  });

  it("drops it once every word is known", () => {
    const state = newGame(course);
    state.words = { w_ni: { ...known }, w_hao: { ...known } };
    expect(readingRow(course, state, said, 0)).toBeUndefined();
  });

  it("has none for words without readings, or when the reading is the words themselves", () => {
    const state = newGame(course);
    expect(readingRow(course, state, line(["茶", "w_cha"]), 0)).toBeUndefined();
    const spaced = spacedWithText();
    expect(readingRow(spaced, newGame(spaced), line(["mi", "w_ni"]), 0)).toBeUndefined();
  });
});
