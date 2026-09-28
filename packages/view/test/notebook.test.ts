import { describe, expect, it } from "vitest";
import { newGame, PLAYER_MARK, type WordRecord } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { makeText, notebookEntries } from "../src/index";

const T0 = 1_000_000;
const rec = (patch: Partial<WordRecord>): WordRecord => ({ right: 1, wrong: 0, streak: 1, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0, ...patch });

describe("notebook entries", () => {
  const course = fixtureWithText();
  const t = makeText(course.learnerFtl, "en");

  it("is empty for a new game", () => {
    const nb = notebookEntries(course, newGame(course), t, T0);
    expect(nb.empty).toBe(true);
    expect(nb.groups).toEqual([]);
    expect(nb.progress).toHaveLength(1);
  });

  it("groups words by where they were first heard, with the name in the first line", () => {
    const state = newGame(course);
    state.player = "Mei";
    course.words.w_ni.audio = ["c-ni"];
    state.words = { w_ni: rec({ streak: 3, right: 3, first: { line: `你好${PLAYER_MARK}！`, place: "noodle_shop" } }), w_cha: rec({}) };
    state.notes.read = ["hao"];
    const nb = notebookEntries(course, state, t, T0);
    expect(nb.groups.map((g) => [g.place, g.title])).toEqual([["noodle_shop", "Noodle shop"], [null, t("notebook-elsewhere")]]);
    expect(nb.groups[0].words[0]).toEqual({
      id: "w_ni", text: "你", readings: ["nǐ"], gloss: "you", short: "you", state: "known", bar: 3, label: "known", clips: ["c-ni"], first: "你好Mei！",
    });
    expect(nb.groups[1].words[0].first).toBeUndefined();
    expect(nb.notes).toEqual([{ title: "好 means good", text: "On its own, 好 agrees." }]);
  });

  it("files a word under its topic when the learner text names one, before the places", () => {
    const c = { ...course, learnerFtl: course.learnerFtl + "\nnotebook-topic-drinks = Drinks\n" };
    const tt = makeText(c.learnerFtl, "en");
    const state = newGame(c);
    state.words = { w_ni: rec({ first: { line: "你", place: "noodle_shop" } }), w_cha: rec({ first: { line: "茶", place: "noodle_shop" } }) };
    const nb = notebookEntries(c, state, tt, T0);
    expect(nb.groups.map((g) => [g.title, g.words.map((w) => w.id)])).toEqual([["Drinks", ["w_cha"]], ["Noodle shop", ["w_ni"]]]);
  });

  it("gives each word a memory bar and label, and lists the words first heard in the last day as recent", () => {
    const state = newGame(course);
    const day = 86_400_000;
    state.words = {
      w_ni: rec({ streak: 0, right: 0, firstSeen: T0 + day, first: { line: "你", place: "noodle_shop" } }),
      w_cha: rec({ streak: 2, firstSeen: T0 + 2 * day, first: { line: "茶", place: "noodle_shop" } }),
      w_hao: rec({ streak: 7, right: 7, lapsed: true, firstSeen: 0, first: { line: "好", place: "street" } }),
    };
    const nb = notebookEntries(course, state, t, T0 + 2 * day);
    const byId = Object.fromEntries(nb.groups.flatMap((g) => g.words).map((w) => [w.id, w]));
    expect([byId.w_ni.bar, byId.w_ni.label]).toEqual([0, "new"]);
    expect([byId.w_cha.bar, byId.w_cha.label]).toEqual([2, "met"]);
    expect([byId.w_hao.bar, byId.w_hao.label]).toEqual([5, "shaky"]);
    expect(nb.recent.map((w) => w.id)).toEqual(["w_cha", "w_ni"]); // newest first; 好 is days old
  });
});
