import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { rightReply, tileEcho } from "../src/index";

const shaky = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: 0, lastSeen: 0 };

/** A game at the tiles exchange of the intro scene (greet answered right, the drink word shaky). */
function atTiles() {
  const course = fixtureWithText();
  const state = newGame(course);
  state.words.w_cha = { ...shaky };
  state.words.w_shui = { ...shaky };
  const core = createCore(course, state, { now: () => 0, rng: mulberry32(1) });
  core.send({ type: "goTo", place: "noodle_shop" });
  core.send({ type: "startScene", scene: "intro" });
  core.send({ type: "reply", choice: core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) });
  return { course, core };
}

describe("replies", () => {
  it("finds the right reply for the exchange being played", () => {
    const { course, core } = atTiles();
    expect(rightReply(course, core.state)!.text).toMatch(/^(茶|水)？$/);
    expect(rightReply(course, newGame(course))).toBeUndefined();
  });

  it("echoes right tiles as the reply itself, wrong ones as placed", () => {
    const { course, core } = atTiles();
    const run = core.state.run!;
    expect(run.mode).toBe("tiles");
    const want = run.combo.item === "tea" ? "茶" : "水";
    const right = tileEcho(course, core.state, run.tiles, [run.tiles.indexOf(want)]);
    expect(right).toMatchObject({ right: true, line: { text: `${want}？` } });
    const wrongIndex = run.tiles.findIndex((x) => x !== want);
    const wrong = tileEcho(course, core.state, run.tiles, [wrongIndex]);
    expect(wrong).toMatchObject({ right: false, line: { text: run.tiles[wrongIndex], tokens: [] } });
  });
});
