import { describe, expect, it } from "vitest";
import { newGame, PLAYER_MARK, type Course, type WordRecord } from "@silver-tongue/core";
import { formsCourse, spacedCourse } from "@silver-tongue/core/testing";
import { fixtureWithText } from "../src/testing";
import {
  extra,
  joinTilesForDisplay,
  lettersView,
  hasLetters,
  makeText,
  nextRuby,
  paperGlosses,
  paperLabel,
  paperParts,
  papers,
  quietRuby,
  readingsOf,
  tileEcho,
  parseSettings,
  rubyRow,
  lineParts,
  freshMarks,
  glossPolicy,
  heardCount,
  onboarding,
  speakerNamed,
  ONBOARDING_WORDS,
  settingsRows,
  type CourseExtra,
} from "../src/index";

const T0 = 1_000_000;
const known: WordRecord = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0 };

/** A small unspaced course written with spaces between words, like Korean: 저 + 는 + 학생 + 이에요. */
function koLike(tileGap?: string): Course {
  const c = structuredClone(fixtureWithText()) as CourseExtra;
  c.language = { ...c.language, book: true, ...(tileGap !== undefined ? { tileGap } : {}) };
  c.words = {
    k_jeo: { id: "k_jeo", w: "저", lv: "1", gloss: "I", readings: ["jeo"] },
    k_neun: { id: "k_neun", w: "는", lv: "1", gloss: "(topic)", readings: ["neun"], attach: true, alt: ["은"] },
    k_haksaeng: { id: "k_haksaeng", w: "학생", lv: "1", gloss: "student", readings: ["haksaeng"] },
    k_ieyo: { id: "k_ieyo", w: "이에요", lv: "1", gloss: "is", readings: ["ieyo"], attach: true, forms: { 예요: ["yeyo"] } },
    k_i_this: { id: "k_i_this", w: "이", lv: "1", gloss: "this" },
    k_i_subj: { id: "k_i_subj", w: "이", lv: "1", gloss: "(subject)", attach: true },
  };
  return c as unknown as Course;
}

describe("joinTilesForDisplay", () => {
  it("glues attaching words to the tile before, and puts the language's tile gap elsewhere", () => {
    const c = koLike(" ");
    expect(joinTilesForDisplay(c, ["저", "는", "학생", "이에요"])).toBe("저는 학생이에요");
    // alt spellings and forms are found too
    expect(joinTilesForDisplay(c, ["학생", "은", "저", "예요"])).toBe("학생은 저예요");
  });

  it("with no tile gap, joins every tile with nothing, as zh and ja do today", () => {
    expect(joinTilesForDisplay(koLike(), ["저", "는", "학생"])).toBe("저는학생");
    const zh = fixtureWithText();
    expect(joinTilesForDisplay(zh, ["你", "好"])).toBe("你好");
  });

  it("a spelling shared by an attaching and a free word stays apart, unless the tile's word is named", () => {
    const c = koLike(" ");
    expect(joinTilesForDisplay(c, ["학생", "이"])).toBe("학생 이");
    expect(joinTilesForDisplay(c, ["학생", "이"], [undefined, "k_i_subj"])).toBe("학생이");
    expect(joinTilesForDisplay(c, ["학생", "이"], [undefined, "k_i_this"])).toBe("학생 이");
  });

  it("the player's name and unknown tiles get the gap", () => {
    expect(joinTilesForDisplay(koLike(" "), ["Mei", "는"])).toBe("Mei는");
    expect(joinTilesForDisplay(koLike(" "), ["저", "Mei"])).toBe("저 Mei");
  });

  it("a spaced language joins with spaces, as core does, attach or not", () => {
    const c = spacedCourse() as unknown as CourseExtra;
    const [a, b] = Object.values(c.words);
    b.attach = true;
    expect(joinTilesForDisplay(c as unknown as Course, [a.w, b.w])).toBe(`${a.w} ${b.w}`);
  });

  it("an empty list is empty", () => {
    expect(joinTilesForDisplay(koLike(" "), [])).toBe("");
  });
});

describe("rubyRow", () => {
  const c = koLike(" ");
  const line = {
    text: "저는 학생이에요",
    tokens: [
      { start: 0, end: 1, word: "k_jeo" },
      { start: 1, end: 2, word: "k_neun" },
      { start: 3, end: 5, word: "k_haksaeng" },
      { start: 5, end: 8, word: "k_ieyo" },
    ],
  };

  it("one reading per word group: a word and the words attached after it, their readings run together", () => {
    expect(rubyRow(c, line, {}, T0, "on")).toEqual([
      { start: 0, end: 2, text: "jeoneun" },
      { start: 3, end: 8, text: "haksaengieyo" },
    ]);
  });

  it("auto: a group's reading while any word in it isn't known yet", () => {
    expect(rubyRow(c, line, { k_jeo: known, k_neun: known }, T0, "auto")).toEqual([{ start: 3, end: 8, text: "haksaengieyo" }]);
    expect(rubyRow(c, line, { k_jeo: known, k_haksaeng: known }, T0, "auto").map((r) => r.text)).toEqual(["jeoneun", "haksaengieyo"]);
    expect(rubyRow(c, line, {}, T0)).toHaveLength(2); // "auto" is the default
  });

  it("on: over every group; off: over none", () => {
    const all = { k_jeo: known, k_neun: known, k_haksaeng: known, k_ieyo: known };
    expect(rubyRow(c, line, all, T0, "on").map((r) => r.text)).toEqual(["jeoneun", "haksaengieyo"]);
    expect(rubyRow(c, line, {}, T0, "off")).toEqual([]);
  });

  it("groups only words written together: an attaching word after a space stands alone, a word that doesn't attach starts a group", () => {
    const l = { text: "저 는 학생", tokens: [{ start: 0, end: 1, word: "k_jeo" }, { start: 2, end: 3, word: "k_neun" }, { start: 4, end: 6, word: "k_haksaeng" }] };
    expect(rubyRow(c, l, {}, T0, "on").map((r) => r.text)).toEqual(["jeo", "neun", "haksaeng"]);
    const joined = { text: "저학생", tokens: [{ start: 0, end: 1, word: "k_jeo" }, { start: 1, end: 3, word: "k_haksaeng" }] };
    expect(rubyRow(c, joined, {}, T0, "on").map((r) => r.text)).toEqual(["jeo", "haksaeng"]);
  });

  it("reads a form as it is written, and a word with no reading adds none to its group", () => {
    const l = { text: "이예요", tokens: [{ start: 0, end: 1, word: "k_i_this" }, { start: 1, end: 3, word: "k_ieyo" }] };
    expect(rubyRow(c, l, {}, T0, "on")).toEqual([{ start: 0, end: 3, text: "yeyo" }]);
    const bare = { text: "이", tokens: [{ start: 0, end: 1, word: "k_i_this" }] };
    expect(rubyRow(c, bare, {}, T0, "on")).toEqual([]);
    const f = formsCourse();
    extra(f).language.book = true;
    const fl = { text: "你了", tokens: [{ start: 0, end: 2, word: "w_ni" }] };
    expect(rubyRow(f, fl, {}, T0, "on")).toEqual([{ start: 0, end: 2, text: "nǐ le" }]);
  });

  it("gives an other spelling (alt) no reading: the word's own would be wrong", () => {
    const l = { text: "학생은", tokens: [{ start: 0, end: 2, word: "k_haksaeng" }, { start: 2, end: 3, word: "k_neun" }] };
    expect(rubyRow(c, l, {}, T0, "on")).toEqual([{ start: 0, end: 3, text: "haksaeng" }]);
    expect(readingsOf(c.words.k_neun, "은")).toEqual([]);
    expect(readingsOf(c.words.k_neun, "는")).toEqual(["neun"]);
    expect(readingsOf(c.words.k_neun)).toEqual(["neun"]);
  });

  it("skips a reading that only repeats the word", () => {
    const k = structuredClone(c) as unknown as CourseExtra;
    k.words.k_jeo.readings = ["저"];
    expect(rubyRow(k as unknown as Course, line, {}, T0, "on").map((r) => r.text)).toEqual(["neun", "haksaengieyo"]);
    const lone = { text: "저", tokens: [{ start: 0, end: 1, word: "k_jeo" }] };
    expect(rubyRow(k as unknown as Course, lone, {}, T0, "on")).toEqual([]);
  });

  it("cycles auto, on, off", () => {
    expect([nextRuby("auto"), nextRuby("on"), nextRuby("off")]).toEqual(["on", "off", "auto"]);
  });
});

describe("lineParts", () => {
  const line = {
    text: "저는 학생이에요?",
    tokens: [
      { start: 0, end: 1, word: "k_jeo" },
      { start: 1, end: 2, word: "k_neun" },
      { start: 3, end: 5, word: "k_haksaeng" },
      { start: 5, end: 8, word: "k_ieyo" },
    ],
  };

  it("puts a word group under its one reading, with the punctuation written right after it", () => {
    expect(lineParts(line, rubyRow(koLike(" "), line, {}, T0, "on"))).toEqual([
      { tokens: [0, 1], tail: "", reading: "jeoneun" },
      { gap: " " },
      { tokens: [2, 3], tail: "?", reading: "haksaengieyo" },
    ]);
  });

  it("with no readings, every word is a piece of its own and the text between stays as it was", () => {
    expect(lineParts(line, [])).toEqual([
      { tokens: [0], tail: "" },
      { tokens: [1], tail: "" },
      { gap: " " },
      { tokens: [2], tail: "" },
      { tokens: [3], tail: "" },
      { gap: "?" },
    ]);
  });

  it("a reading's tail stops at a space", () => {
    const l = { text: "저? 는", tokens: [{ start: 0, end: 1, word: "k_jeo" }, { start: 3, end: 4, word: "k_neun" }] };
    expect(lineParts(l, [{ start: 0, end: 1, text: "jeo" }])).toEqual([
      { tokens: [0], tail: "?", reading: "jeo" },
      { gap: " " },
      { tokens: [1], tail: "" },
    ]);
  });
});

describe("ruby setting", () => {
  it("reads a known choice and drops anything else", () => {
    expect(parseSettings('{"ruby":"on"}')).toEqual({ ruby: "on" });
    expect(parseSettings('{"ruby":"off","autoAdvance":true}')).toEqual({ ruby: "off", autoAdvance: true });
    expect(parseSettings('{"ruby":"sometimes"}')).toEqual({});
    expect(parseSettings('{"ruby":true}')).toEqual({});
  });

  it("gets a settings row only when the front end passes the choice, and only for a course with the Book", () => {
    const course = fixtureWithText();
    const t = makeText(course.learnerFtl, "en");
    const base = { course, catalog: [], state: newGame(course), t, audioAvailable: true };
    expect(settingsRows("main", { ...base, ruby: "auto" }).some((r) => r.action.kind === "ruby")).toBe(false);
    extra(course).language.book = true;
    expect(settingsRows("main", base).some((r) => r.action.kind === "ruby")).toBe(false);
    const row = settingsRows("main", { ...base, ruby: "auto" }).at(-1)!;
    expect(row).toEqual({ label: "Readings under words: new words only", action: { kind: "ruby" } });
  });

  it("without the Book, no readings whatever the setting", () => {
    const course = fixtureWithText();
    const line = { text: "你好", tokens: [{ start: 0, end: 1, word: "w_ni" }, { start: 1, end: 2, word: "w_hao" }] };
    expect(rubyRow(course, line, {}, T0, "on")).toEqual([]);
    expect(quietRuby(course, line, {}, T0, "on")).toEqual([]);
    extra(course).language.book = true;
    expect(rubyRow(course, line, {}, T0, "on").map((r) => r.text)).toEqual(["nǐ", "hǎo"]);
  });
});

describe("lettersView", () => {
  it("names each group in the learner's language, letters as they are", () => {
    const c = structuredClone(fixtureWithText()) as unknown as CourseExtra;
    c.letters = {
      groups: [
        { id: "consonants", letters: [{ ch: "ㄱ", name: "기역", reading: "g/k", audio: ["c1"] }] },
        { id: "odd", letters: [{ ch: "ㅏ", reading: "a" }] },
      ],
    };
    const course = c as unknown as Course;
    const t = makeText(course.learnerFtl, "en");
    expect(hasLetters(course)).toBe(true);
    expect(lettersView(course, t)).toEqual([
      { id: "consonants", label: "Consonants", letters: [{ ch: "ㄱ", name: "기역", reading: "g/k", audio: ["c1"] }] },
      { id: "odd", label: "odd", letters: [{ ch: "ㅏ", reading: "a" }] },
    ]);
  });

  it("is empty for a course with no letter chart", () => {
    const course = fixtureWithText();
    expect(hasLetters(course)).toBe(false);
    expect(lettersView(course, makeText(course.learnerFtl, "en"))).toEqual([]);
  });
});

describe("papers", () => {
  /** The fixture with its first exchange (intro/greet, no slots) pinned, and a name in the line. */
  function pinned(): Course {
    const c = structuredClone(fixtureWithText());
    const ex = extra(c).scenes[0].exchanges[0];
    ex.pin = true;
    const v = ex.variants[""];
    v.npc = { ...v.npc, text: `${v.npc.text}${PLAYER_MARK}` };
    return c;
  }

  it("keeps nothing until the scene is done", () => {
    const c = pinned();
    const t = makeText(c.learnerFtl, "en");
    expect(papers(c, newGame(c), t, T0)).toEqual([]);
  });

  it("keeps each pinned line of a done scene, with the player's name and how much of it is known", () => {
    const c = pinned();
    const t = makeText(c.learnerFtl, "en");
    const state = newGame(c);
    state.player = "Mei";
    state.scenesDone = { intro: 1 };
    state.words = { w_ni: known };
    const [p, ...rest] = papers(c, state, t, T0);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ scene: "intro", exchange: "greet", npc: "cook", place: "noodle_shop", npcName: "Cook", placeName: "Noodle shop" });
    expect(p.text).toBe("你好！Mei");
    expect(p.tokens.map((tk) => tk.word)).toEqual(["w_ni", "w_hao"]);
    expect([p.known, p.total]).toEqual([1, 2]);
    expect(p.blanks).toEqual([
      { start: 0, end: 1, known: true, reading: "nǐ" },
      { start: 1, end: 2, known: false, reading: "hǎo" },
    ]);
    expect(t("notebook-paper-progress", { known: p.known, total: p.total })).toBe("1 of 2 words known");
    expect(paperLabel(t, p)).toEqual({ npcName: "Cook", placeName: "Noodle shop" });
  });

  it("finds each word after the player's name mid-line, and writes \"?\" as core does before there is a name", () => {
    const c = structuredClone(fixtureWithText());
    const ex = extra(c).scenes[0].exchanges[0];
    ex.pin = true;
    const v = ex.variants[""];
    // 你 + name + 好！: 好 moves along by the name's length
    v.npc = { ...v.npc, text: `你${PLAYER_MARK}好！`, tokens: [{ start: 0, end: 1, word: "w_ni" }, { start: 1 + PLAYER_MARK.length, end: 2 + PLAYER_MARK.length, word: "w_hao" }] };
    const t = makeText(c.learnerFtl, "en");
    const state = newGame(c);
    state.scenesDone = { intro: 1 };
    state.words = { w_hao: known };
    state.player = "Mei";
    const [p] = papers(c, state, t, T0);
    expect(p.text).toBe("你Mei好！");
    expect(p.tokens.map((tk) => p.text.slice(tk.start, tk.end))).toEqual(["你", "好"]);
    expect(p.blanks.map((b) => [p.text.slice(b.start, b.end), b.known])).toEqual([["你", false], ["好", true]]);
    expect(paperParts(p).map((x) => x.text)).toEqual(["你", "Mei", "好", "！"]);
    delete state.player;
    expect(papers(c, state, t, T0)[0].text).toBe("你?好！");
  });

  it("skips a done scene the course no longer has", () => {
    const c = structuredClone(fixtureWithText());
    extra(c).scenes[0].exchanges[0].pin = true;
    const state = newGame(c);
    state.scenesDone = { gone: 3, intro: 1 };
    expect(papers(c, state, makeText(c.learnerFtl, "en"), T0).map((p) => p.scene)).toEqual(["intro"]);
    state.scenesDone = { gone: 3 };
    expect(papers(c, state, makeText(c.learnerFtl, "en"), T0)).toEqual([]);
  });

  it("leaves unpinned exchanges out", () => {
    const c = fixtureWithText();
    const state = newGame(c);
    state.scenesDone = { intro: 1, shift: 2 };
    expect(papers(c, state, makeText(c.learnerFtl, "en"), T0)).toEqual([]);
  });
});

describe("quietRuby", () => {
  const c = koLike(" ");
  const line = {
    text: "저는 학생",
    tokens: [
      { start: 0, end: 1, word: "k_jeo" },
      { start: 1, end: 2, word: "k_neun" },
      { start: 3, end: 5, word: "k_haksaeng" },
    ],
  };

  it("reads every word not known yet: a course with the Book has no gloss rows to share the job with", () => {
    expect(freshMarks(c)).toBe(false);
    expect(freshMarks(fixtureWithText())).toBe(true);
    expect(quietRuby(c, line, {}, T0, "auto").map((r) => r.text)).toEqual(["jeoneun", "haksaeng"]);
    expect(quietRuby(c, line, {}, T0, "off")).toEqual([]);
  });

  it("draws every word bare on a course with the Book: its reading is the one mark", () => {
    for (const s of ["unseen", "met", "shaky", "known"] as const) expect(glossPolicy(s, true)).toBe("bare");
    expect(glossPolicy("unseen")).toBe("gloss");
    expect(glossPolicy("shaky")).toBe("mark");
  });
});

describe("onboarding", () => {
  const heard = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`w${i}`, known]));

  it("counts the words heard at all", () => {
    expect(heardCount(heard(9), T0)).toBe(9);
    expect(heardCount({}, T0)).toBe(0);
  });

  it("lasts until the tenth word is heard, on a course with the Book only", () => {
    const c = koLike(" ");
    expect(ONBOARDING_WORDS).toBe(10);
    expect(onboarding(c, heardCount(heard(9), T0))).toBe(true);
    expect(onboarding(c, heardCount(heard(10), T0))).toBe(false);
    expect(onboarding(fixtureWithText(), 0)).toBe(false);
  });
});

describe("speakerNamed", () => {
  const lines = [
    { speaker: "landlady", run: 1 },
    { speaker: "player" },
    { speaker: "landlady", run: 1 },
    {},
    { speaker: "landlady", run: 1 },
    { speaker: "minjun", run: 1 },
    { speaker: "landlady", run: 1 },
    { speaker: "landlady", run: 9 },
    { speaker: "mentor" },
    { speaker: "mentor" },
  ];

  it("names an NPC on a scene's first line and when the speaker changes, on a course with the Book", () => {
    expect(speakerNamed(koLike(" "), lines)).toEqual([true, true, false, true, false, true, true, true, true, true]);
  });

  it("names every line on a course without the Book", () => {
    expect(speakerNamed(fixtureWithText(), lines)).toEqual(lines.map(() => true));
  });
});

describe("tileEcho", () => {
  it("shows wrong tiles joined for display, glued where a word attaches", () => {
    const c = koLike(" ");
    const said = tileEcho(c, newGame(c), ["저", "는", "학생"], [0, 1, 2]);
    expect(said.right).toBe(false);
    expect(said.line.text).toBe("저는 학생");
  });
});

describe("paperParts and paperGlosses", () => {
  it("cut the line into text and words, and gloss the known words once", () => {
    const c = structuredClone(fixtureWithText());
    extra(c).scenes[0].exchanges[0].pin = true;
    const state = newGame(c);
    state.scenesDone = { intro: 1 };
    state.words = { w_ni: known };
    const [p] = papers(c, state, makeText(c.learnerFtl, "en"), T0);
    expect(paperParts(p).map((x) => ("word" in x ? `[${x.text}${x.blank.known ? "" : "?"}]` : x.text)).join("")).toBe("[你][好?]！");
    expect(paperGlosses(c, p)).toEqual([{ word: "w_ni", text: "你", gloss: "you" }]);
    expect(p.audio).toEqual([]);
  });
});

