import { describe, expect, it } from "vitest";
import { newGame, type Course, type GameState, type RenderedLine, type WordRecord } from "@silver-tongue/core";
import { anchorRow, glossPolicy, makeText, notebookDefault, rentDueInDays, replyMeanings, reviewTell, speakerHue, uiTextProblems, type CourseExtra } from "../src/index";
import { fixtureWithText } from "../src/testing";

const course = fixtureWithText();
const t = makeText(course.learnerFtl, "en");
const NOW = 100 * 86_400_000;
const game = (patch: Partial<GameState>): GameState => ({ ...newGame(course), ...patch });
const rec = (patch: Partial<WordRecord>): WordRecord => ({ right: 0, wrong: 0, streak: 0, helps: 0, lapsed: false, firstSeen: 0, lastSeen: NOW, ...patch });

describe("anchor row", () => {
  it("is place and part of the day only on an ordinary day", () => {
    const row = anchorRow(course, game({ day: 3, slot: 2, wallet: 500 }), t);
    expect(row).toEqual({ place: "The street", day: 3, part: "afternoon" });
  });

  it("rent is due on the sleep ending a day divisible by 7", () => {
    expect([1, 6, 7, 8, 13, 14].map(rentDueInDays)).toEqual([6, 1, 0, 6, 1, 0]);
  });

  it("a wallet well short of rent the day before shows it", () => {
    const row = anchorRow({ ...course, world: { ...course.world, rentPerWeek: 200 } }, game({ day: 6, wallet: 140 }), t);
    expect(row.rent).toEqual({ amount: 200, dueInDays: 1, wallet: 140, late: false });
  });

  it("backstop: on its own, rent that would leave under 3 days of food shows on the last day", () => {
    // day 6: pace needs 50 + 2 nights × 5 = 60, which 60 covers; backstop needs 50 + 3 × 5 = 65
    expect(anchorRow(course, game({ day: 6, wallet: 60 }), t).rent).toEqual({ amount: 50, dueInDays: 1, wallet: 60, late: false });
    expect(anchorRow(course, game({ day: 6, wallet: 65 }), t).rent).toBeUndefined();
    // day 7, due tonight: pace needs 55, backstop 65
    expect(anchorRow(course, game({ day: 7, wallet: 55 }), t).rent).toMatchObject({ dueInDays: 0 });
    // two days out the backstop is off: pace alone decides
    expect(anchorRow(course, game({ day: 5, wallet: 65 }), t).rent).toBeUndefined();
  });

  it("pace: rent shows early when food will eat the wallet below rent by the due night", () => {
    // day 3: rent is charged on day 7's sleep, after that night's food: 5 nights × 5 → 60 - 25 = 35 < 50
    expect(anchorRow(course, game({ day: 3, wallet: 60 }), t).rent).toMatchObject({ dueInDays: 4 });
    // 75 - 25 = 50 covers it
    expect(anchorRow(course, game({ day: 3, wallet: 75 }), t).rent).toBeUndefined();
  });

  it("late rent always shows, due tonight", () => {
    expect(anchorRow(course, game({ day: 9, wallet: 500, rentLate: true }), t).rent).toEqual({ amount: 50, dueInDays: 0, wallet: 500, late: true });
  });

  it("day 1 never shows rent: the opening prose says it", () => {
    expect(anchorRow(course, game({ day: 1, wallet: 20 }), t).rent).toBeUndefined();
  });
});

describe("gloss policy", () => {
  it("glosses only unseen words, marks shaky ones", () => {
    expect(glossPolicy("unseen")).toBe("gloss");
    expect(glossPolicy("shaky")).toBe("mark");
    expect(glossPolicy("met")).toBe("bare");
    expect(glossPolicy("known")).toBe("bare");
  });
});

describe("notebook default", () => {
  it("lists shaky words with why, shakiest first, and counts every state", () => {
    const state = game({
      words: {
        w_ni: rec({ wrong: 1, lapsed: true, lastSeen: NOW - 5 }),
        w_hao: rec({ wrong: 2, helps: 1, lapsed: true, lastSeen: NOW - 9 }),
        w_cha: rec({ helps: 2, lapsed: true, lastSeen: NOW - 1 }),
        w_shui: rec({ right: 3, streak: 3, lastSeen: 0 }), // decayed: last seen 100 days ago
        w_san: rec({ right: 3, streak: 3 }), // known
        w_si: rec({ right: 1, streak: 1 }), // met
        w_bu: rec({ wrong: 1, helps: 3, lapsed: true, lastSeen: NOW - 2 }),
      },
    });
    const nb = notebookDefault(course, state, NOW);
    expect(nb.shaky.map((w) => [w.word, w.why, w.count])).toEqual([
      ["w_hao", "missed", 2],
      ["w_bu", "helped", undefined], // one miss, but helped more: ties with w_ni on misses, seen later
      ["w_ni", "missed", 1],
      ["w_cha", "helped", undefined],
      ["w_shui", "decayed", undefined],
    ]);
    expect(nb.shaky[0]).toMatchObject({ text: "好", reading: "hǎo", gloss: "good" });
    const total = Object.keys(course.words).length;
    expect(nb.counts).toEqual({ shaky: 5, met: 1, known: 1, unseen: total - 7 });
  });
});

describe("review tell", () => {
  it("a repeatable scene says it repeats and what it pays", () => {
    expect(reviewTell(course, "shift")).toEqual({ repeat: true, pays: 3 });
    expect(reviewTell(course, "intro")).toEqual({ repeat: false });
    expect(reviewTell(course, "nope")).toEqual({ repeat: false });
  });

  it("with the game state, only once it has been done before", () => {
    expect(reviewTell(course, "shift", game({}))).toEqual({ repeat: false });
    expect(reviewTell(course, "shift", game({ scenesDone: { shift: 1 } }))).toEqual({ repeat: true, pays: 3 });
  });
});

describe("quiet text", () => {
  it("the English UI file has every quiet message", () => {
    const withoutQuiet = course.learnerFtl.split("\n").filter((l) => !l.startsWith("quiet-")).join("\n");
    expect(uiTextProblems(withoutQuiet, "en")).toContain('learner text: missing "quiet-anchor"');
    expect(t("quiet-rent", { currency: "¥", rent: 200, days: 1, wallet: 140 })).toBe("rent ¥200 due tomorrow · you have ¥140");
    expect(t("quiet-why-missed", { count: 2 })).toBe("missed ×2");
  });
});

describe("the conversation stage (a course with the Book)", () => {
  const book = (scenes: (s: CourseExtra["scenes"][number]) => void = () => {}): Course => {
    const c = structuredClone(course) as unknown as CourseExtra;
    c.language.book = true;
    c.scenes.forEach(scenes);
    return c as unknown as Course;
  };

  it("keeps rent off the anchor row until the scene that raises it is done, even when short", () => {
    const withRent = book((s) => void (s.id === course.scenes[0].id && (s.rent = true)));
    const short = { day: 6, wallet: 0 };
    expect(anchorRow(withRent, game(short), t).rent).toBeUndefined();
    expect(anchorRow(withRent, game({ ...short, rentLate: true }), t).rent).toBeUndefined();
    expect(anchorRow(withRent, game({ ...short, scenesDone: { [course.scenes[0].id]: 1 } }), t).rent).toMatchObject({ dueInDays: 1 });
  });

  it("gives each NPC a speaker colour by their order in the setting, wrapping after four", () => {
    const npcs = Object.keys(course.world.npcs);
    expect(npcs.map((n) => speakerHue(course, n))).toEqual(npcs.map((_, i) => i % 4));
    expect(speakerHue(course, "nobody")).toBe(0);
  });

  it("gives every reply slip in a set the same meaning row, or none", () => {
    const o = (text: string, word: string, extra: Partial<RenderedLine>): RenderedLine => ({ text, tokens: [{ start: 0, end: text.length, word }], ...extra });
    const opts = [o("a", "w_a", { meaning: "A.", intent: "Say a" }), o("b", "w_b", { meaning: "B." })];
    const heard = { w_a: rec({ right: 1, firstSeen: 1 }), w_b: rec({ right: 1, firstSeen: 1 }) };
    expect(replyMeanings(opts, {}, NOW, true)).toEqual(["A.", "B."]);
    // After onboarding: intents, the meaning where a reply has none, while a word in them is unheard.
    expect(replyMeanings(opts, { w_a: heard.w_a }, NOW, false)).toEqual(["Say a", "B."]);
    expect(replyMeanings(opts, heard, NOW, false)).toBeUndefined();
  });
});
