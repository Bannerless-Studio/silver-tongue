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
      id: "w_ni", text: "你", readings: ["nǐ"], gloss: "you", short: "you", state: "known", clips: ["c-ni"], first: "你好Mei！",
    });
    expect(nb.groups[1].words[0].first).toBeUndefined();
    expect(nb.notes).toEqual([{ title: "好 means good", text: "On its own, 好 agrees." }]);
  });
});
