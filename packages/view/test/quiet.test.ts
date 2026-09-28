import { describe, expect, it } from "vitest";
import { newGame, type GameState, type WordRecord } from "@silver-tongue/core";
import { anchorRow, glossPolicy, makeText, notebookDefault, rentDueInDays, reviewTell, uiTextProblems } from "../src/index";
import { fixtureWithText } from "../src/testing";

const course = fixtureWithText();
const t = makeText(course.learnerFtl, "en");
const NOW = 100 * 86_400_000;
const game = (patch: Partial<GameState>): GameState => ({ ...newGame(course), ...patch });
const rec = (patch: Partial<WordRecord>): WordRecord => ({ right: 0, wrong: 0, streak: 0, helps: 0, lapsed: false, firstSeen: 0, lastSeen: NOW, ...patch });

describe("anchor row", () => {
  it("is place and slot only on an ordinary day", () => {
    const row = anchorRow(course, game({ day: 3, slot: 2, wallet: 500 }), t);
    expect(row).toEqual({ place: "The street", day: 3, slot: 2, slots: 4 });
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
