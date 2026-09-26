import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { actionNarration, introLines, makeText } from "../src/index";

const course = fixtureWithText();
const t = makeText(course.learnerFtl, "en");
const serve = (count: string, item: string) => ({ action: "serve", count, item });

describe("narration", () => {
  it("says what the reply did", () => {
    expect(actionNarration(course, t, { action: serve("three", "tea"), expected: serve("three", "tea"), matched: true, tilesWrong: false })).toEqual([
      { text: "You set down three cups of tea.", tone: "plain" },
    ]);
  });

  it("on a mix-up, also says what was asked", () => {
    expect(actionNarration(course, t, { action: serve("four", "tea"), expected: serve("three", "tea"), matched: false, tilesWrong: false })).toEqual([
      { text: "You set down four cups of tea.", tone: "plain" },
      { text: "They wanted three cups of tea.", tone: "warn" },
    ]);
  });

  it("wrong tiles did nothing recognisable: only what was asked", () => {
    expect(actionNarration(course, t, { action: serve("four", "tea"), expected: serve("three", "tea"), matched: false, tilesWrong: true })).toEqual([
      { text: "They wanted three cups of tea.", tone: "warn" },
    ]);
  });

  it("falls back to the generic mismatch line", () => {
    const greet = { action: "greet" };
    expect(actionNarration(course, t, { action: greet, expected: greet, matched: false, tilesWrong: false })).toEqual([
      { text: t("mismatch"), tone: "warn" },
    ]);
  });

  it("tells the story only for a game that hasn't started", () => {
    const state = newGame(course);
    expect(introLines(course, state, t)).toEqual([
      "You arrive with ¥20 and no words.",
      "An old man on a bench is watching you with open curiosity.",
    ]);
    state.scenesDone.intro = 1;
    expect(introLines(course, state, t)).toEqual([]);
  });
});
