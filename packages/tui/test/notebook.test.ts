import { describe, expect, it } from "vitest";
import { newGame, PLAYER_MARK, type WordRecord } from "@silver-tongue/core";
import { notebookLines } from "../src/notebook";
import { plain } from "../src/terminal";
import { makeText } from "@silver-tongue/view";
import { fixtureWithText, spacedWithText } from "./fake-terminal";

const T0 = 1_000_000;
const rec = (patch: Partial<WordRecord>): WordRecord => ({
  right: 1, wrong: 0, streak: 1, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0, ...patch,
});

describe("notebook", () => {
  const course = fixtureWithText();
  course.notes = [{ id: "hao", trigger: { word: "w_hao" } }];
  const t = makeText(course.learnerFtl, "en");

  it("shows every reading of a word", () => {
    const spaced = spacedWithText();
    const state = newGame(spaced);
    state.words = { w_ni: rec({ first: { line: "mi bon!", place: "noodle_shop" } }) };
    const lines = notebookLines(spaced, state, t, T0).map(plain).join("\n");
    expect(lines).toContain("mi mí mi — you");
  });

  it("counts progress on the stage list, groups words by where they were first heard, and lists read notes", () => {
    const state = newGame(course);
    state.words = {
      w_ni: rec({ streak: 3, right: 3, first: { line: "你好！", place: "noodle_shop" } }),
      w_cha: rec({ lapsed: true, first: { line: "茶。", place: "noodle_shop" } }),
      x_bei: rec({ first: { line: "三杯茶。", place: "street" } }),
      w_hao: rec({}),
    };
    state.notes.read = ["hao"];
    const lines = notebookLines(course, state, t, T0).map(plain);
    expect(lines[0]).toBe("Speaks: Pidgin");
    expect(lines[1]).toBe("Stage 1: 1 of 12 words known · 4 heard");
    const text = lines.join("\n");
    expect(text).toMatch(/The street\n○ 杯 — cup\n {4}三杯茶。/); // gloss shortened to its first sense
    expect(text).toMatch(/Noodle shop\n● 你 nǐ — you\n {4}你好！\n◐ 茶 — tea\n {4}茶。/);
    expect(text).toMatch(/Heard elsewhere\n○ 好 hǎo — good/);
    expect(text).toMatch(/Notes\n好 means good\nOn its own, 好 agrees\./);
    expect(text.indexOf("The street")).toBeLessThan(text.indexOf("Noodle shop"));
  });

  it("says the player's name in a first line saved with the name's mark", () => {
    const state = { ...newGame(course), player: "Jamil" };
    state.words = { w_shi: rec({ first: { line: `是${PLAYER_MARK}。`, place: "street" } }) };
    const text = notebookLines(course, state, t, T0).map(plain).join("\n");
    expect(text).toContain("    是Jamil。");
  });

  it("says so when nothing has been heard yet", () => {
    const lines = notebookLines(course, newGame(course), t, T0).map(plain);
    expect(lines).toContain("Nothing yet. Words you hear are written down here.");
  });
});
